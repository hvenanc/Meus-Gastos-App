import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  accountBalance,
  validateData,
  totals,
} from "../src/lib/finance.ts";
import { investmentBalance } from "../src/lib/investments.ts";
import { createInvestmentAccess } from "../src/lib/investmentPin.ts";
import {
  transferToInvestment,
  deleteInvestmentTransfer,
} from "../src/lib/investmentTransfers.ts";
import { mergeFinance, SyncConflict } from "../src/lib/syncMerge.ts";
import {
  financeRecords,
  restoreFinanceRecords,
} from "../src/lib/financeRecords.ts";
const access = await createInvestmentAccess("1234", new Uint8Array(16));
function fixture() {
  const data = structuredClone(initialData);
  data.transactions = [];
  data.cards = [];
  data.accounts = [
    { id: "same", name: "Conta", bank: "other", initialBalance: 10000 },
  ];
  data.investmentAccounts = [
    { id: "same", name: "Reserva secreta", bank: "other", initialBalance: 0 },
  ];
  data.investmentMovements = [];
  data.investmentAccess = access;
  return data;
}
const input = {
  sourceAccountId: "same",
  investmentAccountId: "same",
  amount: 6000,
  date: "2026-10-01",
  note: "Nota privada",
};
const transfer = (data = fixture(), values = {}) =>
  transferToInvestment(data, { ...input, ...values }, "2026-10-19");
test("transferência conserva patrimônio, mantém notas privadas e não vira despesa", () => {
  const base = fixture(),
    next = transfer(base);
  assert.equal(validateData(next), true);
  assert.equal(accountBalance(next, "same"), 4000);
  assert.equal(investmentBalance(next, "same"), 6000);
  assert.deepEqual(totals(next, "2026-10"), totals(base, "2026-10"));
  assert.equal(
    JSON.stringify(next.transactions).includes("Nota privada"),
    false,
  );
  assert.equal(
    JSON.stringify(next.transactions).includes("Reserva secreta"),
    false,
  );
  assert.equal(validateData(JSON.parse(JSON.stringify(next))), true);
  assert.deepEqual(restoreFinanceRecords(financeRecords(next)), next);
  assert.equal(base.transactions.length, 0);
});
test("edição e exclusão atualizam os dois lados e preservam identificadores", () => {
  const original = transfer(),
    movementId = original.investmentMovements![0].id;
  const edited = transfer(original, { amount: 9000, movementId });
  assert.equal(accountBalance(edited, "same"), 1000);
  assert.equal(investmentBalance(edited, "same"), 9000);
  assert.equal(edited.transactions[0].id, original.transactions[0].id);
  const deleted = deleteInvestmentTransfer(edited, movementId);
  assert.equal(accountBalance(deleted, "same"), 10000);
  assert.equal(investmentBalance(deleted, "same"), 0);
  assert.equal(deleted.transactions.length, 0);
});
test("recusa saldo insuficiente, data futura, origem ausente e área sem PIN", () => {
  for (const values of [
    { amount: 10001 },
    { amount: 0 },
    { amount: 1.5 },
    { date: "2026-10-20" },
    { sourceAccountId: "missing" },
    { investmentAccountId: "missing" },
  ])
    assert.throws(() => transfer(fixture(), values));
  const data = fixture();
  delete data.investmentAccess;
  assert.throws(() => transfer(data));
  const pending = fixture();
  pending.accounts[0].initialBalance = 0;
  pending.transactions = [
    {
      id: "income",
      type: "income",
      title: "Receita",
      amount: 10000,
      date: "2026-10-01",
      accountId: "same",
      categoryId: pending.categories.find((c) => c.type === "income")!.id,
      paid: false,
    },
  ];
  assert.throws(() => transfer(pending));
  pending.transactions[0].paid = true;
  pending.transactions[0].date = "2026-10-10";
  assert.throws(() => transfer(pending));
});
test("importação não aceita vínculos incompletos ou divergentes", () => {
  const original = transfer();
  for (const mutate of [
    (d: typeof original) => {
      d.transactions = [];
    },
    (d: typeof original) => {
      d.investmentMovements = [];
    },
    (d: typeof original) => {
      d.transactions[0].amount++;
    },
    (d: typeof original) => {
      d.transactions[0].paid = false;
    },
  ]) {
    const copy = structuredClone(original);
    mutate(copy);
    assert.equal(validateData(copy), false);
  }
});
test("exclusão não pode deixar retirada sem saldo", () => {
  const data = transfer();
  data.investmentMovements!.push({
    id: "withdraw",
    type: "withdrawal",
    accountId: "same",
    amount: 5000,
    date: "2026-10-02",
    note: "",
  });
  assert.equal(validateData(data), true);
  assert.throws(() =>
    deleteInvestmentTransfer(data, data.investmentMovements![0].id),
  );
});
test("sincronização recusa transferências concorrentes sem saldo e combina valores cobertos", () => {
  const base = fixture();
  assert.throws(
    () => mergeFinance(base, transfer(base), transfer(base)),
    SyncConflict,
  );
  const merged = mergeFinance(
    base,
    transfer(base, { amount: 4000 }),
    transfer(base, { amount: 3000 }),
  );
  assert.equal(accountBalance(merged, "same"), 3000);
  assert.equal(investmentBalance(merged, "same"), 7000);
});
