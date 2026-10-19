import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  makeInstallments,
  anticipateInstallments,
  availableInstallments,
  invoice,
  accountBalance,
  totals,
  validateData,
  payInvoice,
  remainingRefund,
  refundCardPurchase,
  moveCardPurchase,
} from "../src/lib/finance.ts";
import { mergeFinance, SyncConflict } from "../src/lib/syncMerge.ts";

const date = "2026-10-15";
function fixture(amount = 10001) {
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
      title: "Celular",
      type: "expense",
      amount,
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

test("antecipação parcial move somente parcelas selecionadas e preserva origem e centavos", () => {
  const data = fixture();
  const [first, second, third, fourth] = data.transactions;
  const next = anticipateInstallments(
    data,
    "c",
    [second.id, fourth.id],
    "2026-10",
    101,
    date,
  );
  assert.deepEqual(
    data.transactions.map((t) => t.invoiceMonth),
    ["2026-10", "2026-11", "2026-12", "2027-01"],
  );
  assert.equal(
    next.transactions.find((t) => t.id === first.id),
    first,
  );
  assert.equal(
    next.transactions.find((t) => t.id === third.id),
    third,
  );
  for (const original of [second, fourth]) {
    const moved = next.transactions.find((t) => t.id === original.id)!;
    assert.equal(moved.invoiceMonth, "2026-10");
    assert.equal(moved.anticipatedFrom, original.invoiceMonth);
    assert.equal(moved.date, original.date);
    assert.equal(moved.installment, original.installment);
    assert.equal(moved.amount, original.amount);
    assert.equal(moved.paid, false);
  }
  assert.equal(invoice(next, "c", "2026-10").pending, 7400);
  assert.equal(invoice(next, "c", "2026-11").pending, 0);
  assert.equal(invoice(next, "c", "2026-12").pending, third.amount);
  assert.equal(invoice(next, "c", "2027-01").pending, 0);
  assert.equal(totals(next, "2026-10").expense, 7400);
  assert.equal(accountBalance(next, "a"), 100000);
  assert(validateData(JSON.parse(JSON.stringify(next))));
  const paid = payInvoice(next, "c", "2026-10");
  assert.equal(accountBalance(paid, "a"), 92600);
  assert.equal(invoice(paid, "c", "2026-10").pending, 0);
  assert(validateData(paid));
});

test("destino pode ser outra fatura aberta, inclusive após a virada do ano", () => {
  const data = fixture();
  const last = data.transactions[3];
  const next = anticipateInstallments(data, "c", [last.id], "2026-12", 0, date);
  assert.equal(invoice(next, "c", "2026-12").pending, 5000);
  assert.equal(next.transactions.length, data.transactions.length);
  assert.equal(
    availableInstallments(next, "c", "2026-10").some((t) => t.id === last.id),
    false,
  );
  assert(validateData(next));
});

test("desconto integral ou de um centavo não cria valores inválidos nem estornos excedentes", () => {
  for (const discount of [0, 1, 5000]) {
    const data = fixture();
    const selected = data.transactions.slice(2);
    const next = anticipateInstallments(
      data,
      "c",
      selected.map((t) => t.id),
      "2026-11",
      discount,
      date,
    );
    assert.equal(invoice(next, "c", "2026-11").pending, 7500 - discount);
    assert.equal(
      next.transactions
        .filter((t) => t.anticipationDiscount)
        .reduce((sum, t) => sum + t.amount, 0),
      discount,
    );
    for (const installment of selected)
      assert(remainingRefund(next, installment) >= 0);
    assert(validateData(next));
  }
});

test("parcelas pagas, com estorno e já antecipadas ficam indisponíveis", () => {
  const data = fixture();
  data.transactions[1].paid = true;
  const refunded = refundCardPurchase(data, data.transactions[2].id, 1, date);
  assert.deepEqual(
    availableInstallments(refunded, "c", "2026-10").map((t) => t.id),
    [data.transactions[3].id],
  );
  for (const t of data.transactions.slice(0, 3)) {
    assert.throws(() =>
      anticipateInstallments(refunded, "c", [t.id], "2026-10", 0, date),
    );
  }
  const next = anticipateInstallments(
    refunded,
    "c",
    [data.transactions[3].id],
    "2026-10",
    0,
    date,
  );
  assert.throws(() =>
    anticipateInstallments(
      next,
      "c",
      [data.transactions[3].id],
      "2026-10",
      0,
      date,
    ),
  );
  const moved = next.transactions.find(
    (t) => t.id === data.transactions[3].id,
  )!;
  assert.throws(() => moveCardPurchase(next, moved, { ...moved, amount: 1 }));
});

test("recusa descontos inválidos, faturas fechadas, IDs repetidos e compras diferentes", () => {
  const data = fixture();
  const id = data.transactions[1].id;
  for (const discount of [-1, 2501, 0.5, NaN, Infinity])
    assert.throws(() =>
      anticipateInstallments(data, "c", [id], "2026-10", discount, date),
    );
  for (const month of ["2026-13", "2026-09", "2026-11"])
    assert.throws(() =>
      anticipateInstallments(data, "c", [id], month, 0, date),
    );
  assert.throws(() =>
    anticipateInstallments(data, "c", [id], "2026-10", 0, "2026-10-20"),
  );
  for (const ids of [[], [id, id], ["missing"]])
    assert.throws(() =>
      anticipateInstallments(data, "c", ids, "2026-10", 0, date),
    );
  data.transactions[2].groupId = "another-purchase";
  assert.throws(() =>
    anticipateInstallments(
      data,
      "c",
      [id, data.transactions[2].id],
      "2026-10",
      0,
      date,
    ),
  );
});

test("antecipações concorrentes da mesma parcela geram conflito, mesmo sem desconto", () => {
  const base = fixture();
  const id = base.transactions[1].id;
  for (const discount of [0, 100]) {
    const a = anticipateInstallments(
      base,
      "c",
      [id],
      "2026-10",
      discount,
      date,
    );
    const b = anticipateInstallments(
      base,
      "c",
      [id],
      "2026-10",
      discount,
      date,
    );
    assert.throws(() => mergeFinance(base, a, b), SyncConflict);
  }
  const a = anticipateInstallments(
    base,
    "c",
    [base.transactions[1].id],
    "2026-10",
    100,
    date,
  );
  const b = anticipateInstallments(
    base,
    "c",
    [base.transactions[2].id],
    "2026-10",
    100,
    date,
  );
  assert(validateData(mergeFinance(base, a, b)));
});

test("backup rejeita desconto órfão, desconto excessivo e origem adulterada", () => {
  const data = fixture();
  const next = anticipateInstallments(
    data,
    "c",
    [data.transactions[1].id],
    "2026-10",
    100,
    date,
  );
  const orphan = structuredClone(next);
  orphan.transactions.pop();
  // No discount remains a valid anticipation; orphaning the installment is invalid.
  orphan.transactions = next.transactions.filter(
    (t) => t.id !== data.transactions[1].id,
  );
  assert(!validateData(orphan));
  const invalid = structuredClone(next);
  invalid.transactions.at(-1)!.amount = 2501;
  assert(!validateData(invalid));
  const wrongMonth = structuredClone(next);
  wrongMonth.transactions[1].anticipatedFrom = "2026-09";
  assert(!validateData(wrongMonth));
  const wrongDiscountMonth = structuredClone(next);
  wrongDiscountMonth.transactions.at(-1)!.invoiceMonth = "2026-11";
  assert(!validateData(wrongDiscountMonth));
});
