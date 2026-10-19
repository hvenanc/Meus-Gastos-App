import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  makeInstallments,
  anticipateInstallments,
  invoice,
  payInvoice,
  accountBalance,
  validateData,
  refundCardPurchase,
} from "../src/lib/finance.ts";
import {
  deleteCardPurchase,
  purchaseDeletionPlan,
} from "../src/lib/purchaseDeletion.ts";
import { mergeFinance, SyncConflict } from "../src/lib/syncMerge.ts";
function fixture() {
  const data = structuredClone(initialData);
  data.accounts = [
    { id: "a", name: "Conta", bank: "other", initialBalance: 100000 },
  ];
  const card = {
    id: "c",
    name: "Cartão",
    bank: "other",
    accountId: "a",
    limit: 100000,
    closingDay: 20,
    dueDay: 27,
  };
  data.cards = [card];
  data.transactions = makeInstallments(
    {
      id: "purchase",
      title: "Compra",
      type: "expense",
      amount: 12000,
      date: "2026-10-10",
      categoryId: "food",
      accountId: "a",
      cardId: "c",
      paid: false,
    },
    4,
    card,
  );
  return data;
}
test("exclui uma parcela antecipada junto com seu desconto, preservando as demais", () => {
  const base = fixture();
  const ids = base.transactions.slice(1, 3).map((t) => t.id);
  const moved = anticipateInstallments(
    base,
    "c",
    ids,
    "2026-10",
    300,
    "2026-10-15",
  );
  const next = deleteCardPurchase(moved, ids[0], "installment");
  assert(
    !next.transactions.some((t) => t.id === ids[0] || t.refundOf === ids[0]),
  );
  assert(next.transactions.some((t) => t.id === ids[1] && t.anticipatedFrom));
  assert.equal(invoice(next, "c", "2026-10").pending, 5850);
  assert.equal(accountBalance(next, "a"), 100000);
  assert(validateData(next));
  assert(validateData(moved));
});
test("exclusão da compra remove parcelas em aberto, antecipações e estornos; mantém parcelas pagas e débito da fatura", () => {
  const base = fixture();
  const paid = payInvoice(base, "c", "2026-10");
  const moved = anticipateInstallments(
    paid,
    "c",
    base.transactions.slice(1, 3).map((t) => t.id),
    "2026-10",
    300,
    "2026-10-15",
  );
  const withRefund = refundCardPurchase(
    moved,
    base.transactions[3].id,
    100,
    "2026-10-15",
  );
  const plan = purchaseDeletionPlan(
    withRefund,
    base.transactions[1].id,
    "purchase",
  );
  assert.equal(plan.paidCount, 1);
  assert.equal(plan.installments.length, 3);
  assert.equal(plan.credit, 400);
  const next = deleteCardPurchase(
    withRefund,
    base.transactions[1].id,
    "purchase",
  );
  assert.deepEqual(
    next.transactions,
    paid.transactions.filter((t) => t.paid),
  );
  assert.equal(accountBalance(next, "a"), 97000);
  assert(validateData(next));
});
test("pagamentos e créditos já quitados não podem ser apagados por exclusão de compra", () => {
  const base = fixture();
  const paid = payInvoice(base, "c", "2026-10");
  assert.throws(() =>
    deleteCardPurchase(paid, base.transactions[0].id, "purchase"),
  );
  assert.throws(() =>
    deleteCardPurchase(paid, paid.transactions.at(-1)!.id, "installment"),
  );
  const refunded = refundCardPurchase(
    base,
    base.transactions[1].id,
    100,
    "2026-10-15",
  );
  refunded.transactions.at(-1)!.paid = true;
  assert.throws(() =>
    deleteCardPurchase(refunded, base.transactions[1].id, "installment"),
  );
});
test("exclusão concorrente com pagamento ou novo estorno gera conflito", () => {
  const base = fixture();
  const id = base.transactions[0].id;
  const deleted = deleteCardPurchase(base, id, "installment");
  assert.throws(
    () => mergeFinance(base, deleted, payInvoice(base, "c", "2026-10")),
    SyncConflict,
  );
  assert.throws(
    () =>
      mergeFinance(
        base,
        deleted,
        refundCardPurchase(base, id, 100, "2026-10-15"),
      ),
    SyncConflict,
  );
});
