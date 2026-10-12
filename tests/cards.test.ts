import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  makeInstallments,
  moveCardPurchase,
  refundCardPurchase,
  invoice,
  invoiceIsOpen,
  payInvoice,
  accountBalance,
  totals,
  validateData,
  remainingRefund,
  resetFinance,
} from "../src/lib/finance.ts";
import { mergeFinance, SyncConflict } from "../src/lib/syncMerge.ts";
const fixture = () => {
  const data = structuredClone(initialData);
  data.accounts = [
    { id: "a", name: "A", bank: "other", initialBalance: 100000 },
  ];
  const card = {
    id: "c",
    name: "C",
    bank: "other",
    limit: 100000,
    closingDay: 20,
    dueDay: 27,
    accountId: "a",
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
    1,
    card,
  );
  return data;
};
test("alterar data recalcula fatura antes e depois do fechamento", () => {
  const d = fixture(),
    t = d.transactions[0];
  const moved = moveCardPurchase(d, t, { ...t, date: "2026-10-20" });
  assert.equal(moved.invoiceMonth, "2026-11");
  assert.equal(
    moveCardPurchase(d, t, { ...t, date: "2026-09-15" }).invoiceMonth,
    "2026-09",
  );
  assert.equal(
    moveCardPurchase(d, t, { ...t, title: "Editada" }).invoiceMonth,
    "2026-10",
  );
});
test("vencimento anterior ao fechamento e parcelas preservam regras de ciclo", () => {
  const d = fixture();
  d.cards[0].dueDay = 5;
  const t = d.transactions[0];
  assert.equal(
    moveCardPurchase(d, t, { ...t, date: "2026-10-25" }).invoiceMonth,
    "2026-12",
  );
  assert.equal(invoiceIsOpen(d.cards[0], "2026-11", "2026-10-19"), true);
  assert.equal(invoiceIsOpen(d.cards[0], "2026-11", "2026-10-20"), false);
});
test("estorno parcial abate despesa e fatura sem devolver dinheiro à conta", () => {
  let d = fixture();
  d = refundCardPurchase(d, d.transactions[0].id, 3000, "2026-10-12");
  assert.equal(invoice(d, "c", "2026-10").pending, 9000);
  assert.equal(totals(d, "2026-10").expense, 9000);
  assert.equal(accountBalance(d, "a"), 100000);
  assert.ok(validateData(d));
  d = payInvoice(d, "c", "2026-10");
  assert.equal(accountBalance(d, "a"), 91000);
  assert.equal(invoice(d, "c", "2026-10").pending, 0);
  assert.ok(validateData(d));
});
test("estorno de compra quitada gera crédito na nova fatura e impede excesso", () => {
  let d = fixture();
  const id = d.transactions[0].id;
  d = payInvoice(d, "c", "2026-10");
  d = refundCardPurchase(d, id, 12000, "2026-10-22");
  assert.equal(invoice(d, "c", "2026-11").credit, 12000);
  assert.equal(accountBalance(d, "a"), 88000);
  assert.equal(remainingRefund(d, d.transactions[0]), 0);
  assert.throws(() => refundCardPurchase(d, id, 1, "2026-10-22"));
  assert.ok(validateData(d));
});
test("antecipar quita somente lançamentos existentes e novas compras continuam na fatura", () => {
  let d = fixture();
  assert.ok(invoiceIsOpen(d.cards[0], "2026-10", "2026-10-12"));
  d = payInvoice(d, "c", "2026-10");
  assert.equal(accountBalance(d, "a"), 88000);
  d.transactions.push({
    ...d.transactions[0],
    id: "new",
    amount: 5000,
    paid: false,
  });
  assert.equal(invoice(d, "c", "2026-10").pending, 5000);
  d = payInvoice(d, "c", "2026-10");
  assert.equal(accountBalance(d, "a"), 83000);
  assert.equal(invoice(d, "c", "2026-10").pending, 0);
});
test("compras com estorno não podem ser editadas; estornos concorrentes acima da compra conflitam", () => {
  const d = fixture(),
    id = d.transactions[0].id;
  const a = refundCardPurchase(d, id, 8000, "2026-10-12"),
    b = refundCardPurchase(d, id, 7000, "2026-10-12");
  assert.throws(() =>
    moveCardPurchase(a, a.transactions[0], {
      ...a.transactions[0],
      date: "2026-11-10",
    }),
  );
  assert.throws(() => mergeFinance(d, a, b), SyncConflict);
});
test("zerar remove finanças e restaura categorias; dispositivo antigo não ressuscita dados", () => {
  const d = fixture();
  const empty = resetFinance(d);
  assert.equal(empty.accounts.length, 0);
  assert.equal(empty.transactions.length, 0);
  assert.ok(validateData(empty));
  assert.deepEqual(mergeFinance(d, d, empty), empty);
  const stale = structuredClone(d);
  stale.accounts[0].name = "Antiga";
  assert.throws(() => mergeFinance(d, stale, empty), SyncConflict);
});

test("crédito excedente do estorno acompanha faturas futuras sem ser usado duas vezes", () => {
  let d = fixture();
  const id = d.transactions[0].id;
  d = payInvoice(d, "c", "2026-10");
  d = refundCardPurchase(d, id, 12000, "2026-10-22");
  d.transactions.push({
    ...d.transactions[0],
    id: "nov",
    amount: 5000,
    date: "2026-11-10",
    invoiceMonth: "2026-11",
    paid: false,
  });
  assert.equal(invoice(d, "c", "2026-11").credit, 7000);
  d.transactions.push({
    ...d.transactions[0],
    id: "dec",
    amount: 10000,
    date: "2026-12-10",
    invoiceMonth: "2026-12",
    paid: false,
  });
  assert.equal(invoice(d, "c", "2026-12").pending, 3000);
  d = payInvoice(d, "c", "2026-12");
  assert.equal(accountBalance(d, "a"), 85000);
  assert.equal(invoice(d, "c", "2027-01").credit, 0);
  assert.ok(validateData(d));
});
test("fechamento dia 31 usa o último dia real em fevereiro", () => {
  const d = fixture();
  d.cards[0].closingDay = 31;
  assert.equal(
    moveCardPurchase(d, d.transactions[0], {
      ...d.transactions[0],
      date: "2026-02-28",
    }).invoiceMonth,
    "2026-04",
  );
});
