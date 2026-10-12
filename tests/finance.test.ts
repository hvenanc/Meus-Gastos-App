import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  parseMoney,
  validDate,
  addMonths,
  makeInstallments,
  invoiceMonth,
  accountBalance,
  totals,
  payInvoice,
  invoice,
  validateData,
  demoData,
} from "../src/lib/finance.ts";
const card = {
  id: "card",
  name: "Nubank",
  bank: "nubank",
  limit: 100000,
  closingDay: 20,
  dueDay: 27,
  accountId: "a",
};
const base = {
  ...structuredClone(initialData),
  accounts: [
    { id: "a", name: "Conta A", bank: "nubank", initialBalance: 100000 },
    { id: "b", name: "Conta B", bank: "itau", initialBalance: 0 },
  ],
  cards: [card],
};
test("valores brasileiros são convertidos exatamente em centavos", () => {
  assert.equal(parseMoney("1.234,56"), 123456);
  assert.equal(parseMoney("0,01"), 1);
  assert.throws(() => parseMoney("-20"));
  assert.throws(() => parseMoney("1,234"));
  assert.throws(() => parseMoney("texto"));
});
test("datas inválidas são rejeitadas e parcelas respeitam fim do mês", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});
test("fechamento define fatura e vencimento pode ser no mês seguinte", () => {
  assert.equal(invoiceMonth("2026-10-19", card), "2026-10");
  assert.equal(invoiceMonth("2026-10-20", card), "2026-11");
  assert.equal(invoiceMonth("2026-10-19", { ...card, dueDay: 5 }), "2026-11");
  assert.equal(invoiceMonth("2026-12-25", card), "2027-01");
});
test("parcelas preservam o total sem perder centavos", () => {
  const list = makeInstallments(
    {
      id: "t",
      title: "Compra",
      type: "expense",
      amount: 10000,
      date: "2026-10-10",
      categoryId: "shopping",
      accountId: "a",
      cardId: "card",
      paid: false,
    },
    3,
    card,
  );
  assert.deepEqual(
    list.map((t) => t.amount),
    [3334, 3333, 3333],
  );
  assert.equal(
    list.reduce((n, t) => n + t.amount, 0),
    10000,
  );
  assert.deepEqual(
    list.map((t) => t.invoiceMonth),
    ["2026-10", "2026-11", "2026-12"],
  );
});
test("transferências conservam o saldo total; pendentes não afetam saldo", () => {
  const data = {
    ...base,
    transactions: [
      {
        id: "t",
        title: "Transferência",
        type: "transfer" as const,
        amount: 25000,
        date: "2026-10-10",
        categoryId: "",
        accountId: "a",
        destinationId: "b",
        paid: true,
      },
      {
        id: "p",
        title: "Pendente",
        type: "expense" as const,
        amount: 1000,
        date: "2026-10-10",
        categoryId: "food",
        accountId: "a",
        paid: false,
      },
    ],
  };
  assert.equal(accountBalance(data, "a"), 75000);
  assert.equal(accountBalance(data, "b"), 25000);
  assert.deepEqual(totals(data, "2026-10"), { income: 0, expense: 1000 });
});
test("pagar fatura debita conta uma vez e não duplica despesas", () => {
  const list = makeInstallments(
    {
      id: "t",
      title: "Compra",
      type: "expense",
      amount: 12000,
      date: "2026-10-10",
      categoryId: "shopping",
      accountId: "a",
      cardId: "card",
      paid: false,
    },
    1,
    card,
  );
  const data = { ...base, transactions: list };
  assert.equal(accountBalance(data, "a"), 100000);
  const paid = payInvoice(data, "card", "2026-10");
  assert.equal(accountBalance(paid, "a"), 88000);
  assert.equal(invoice(paid, "card", "2026-10").pending, 0);
  assert.equal(totals(paid, "2026-10").expense, 12000);
  assert.throws(() => payInvoice(paid, "card", "2026-10"));
});
test("backup valida esquema, centavos e vínculos", () => {
  assert.equal(validateData(demoData()), true);
  assert.equal(validateData(initialData), true);
  assert.equal(validateData({ version: 1 }), false);
  assert.equal(
    validateData({
      ...base,
      accounts: [{ ...base.accounts[0], initialBalance: NaN }],
    }),
    false,
  );
  assert.equal(
    validateData({ ...base, cards: [{ ...card, accountId: "missing" }] }),
    false,
  );
});

test("backup rejeita objetos nulos e categoria incompatível", () => {
  assert.equal(validateData({ ...base, accounts: [null] }), false);
  assert.equal(
    validateData({
      ...base,
      transactions: [
        {
          id: "t",
          title: "Teste",
          type: "income",
          amount: 100,
          date: "2026-10-11",
          accountId: "a",
          categoryId: "food",
          paid: true,
        },
      ],
    }),
    false,
  );
});

test("pagamento de fatura mantém backup válido sem categoria Outros", () => {
  const list = makeInstallments(
    {
      id: "t",
      title: "Compra",
      type: "expense",
      amount: 5000,
      date: "2026-10-10",
      categoryId: "shopping",
      accountId: "a",
      cardId: "card",
      paid: false,
    },
    1,
    card,
  );
  const data = {
    ...base,
    categories: base.categories.filter((c) => c.id !== "other"),
    transactions: list,
  };
  assert.equal(validateData(payInvoice(data, "card", "2026-10")), true);
});

test("despesa futura pertence ao mês informado e mudança de data transfere o total", () => {
  const data = structuredClone(base);
  data.transactions = [
    {
      id: "future",
      title: "Novembro",
      type: "expense",
      amount: 15000,
      date: "2026-11-01",
      categoryId: "food",
      accountId: "a",
      paid: false,
    },
  ];
  assert.deepEqual(totals(data, "2026-10"), { income: 0, expense: 0 });
  assert.deepEqual(totals(data, "2026-11"), { income: 0, expense: 15000 });
  data.transactions[0].paid = true;
  assert.equal(totals(data, "2026-11").expense, 15000);
  data.transactions[0].date = "2026-12-01";
  assert.equal(totals(data, "2026-11").expense, 0);
  assert.equal(totals(data, "2026-12").expense, 15000);
});

test("despesa fixa repete o valor integral, preserva o dia-base e deixa próximas pendentes", async () => {
  const { makeRecurringExpenses, moveCardPurchase } =
    await import("../src/lib/finance.ts");
  const d = structuredClone(base);
  const template = {
    id: "fixed",
    title: "Aluguel",
    type: "expense" as const,
    amount: 10000,
    date: "2026-01-31",
    categoryId: "food",
    accountId: "a",
    paid: true,
  };
  d.transactions = makeRecurringExpenses(template, 3);
  assert.deepEqual(
    d.transactions.map((t) => t.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.deepEqual(
    d.transactions.map((t) => t.amount),
    [10000, 10000, 10000],
  );
  assert.deepEqual(
    d.transactions.map((t) => t.paid),
    [true, false, false],
  );
  assert.equal(new Set(d.transactions.map((t) => t.id)).size, 3);
  assert.equal(totals(d, "2026-02").expense, 10000);
  assert.equal(accountBalance(d, "a"), 90000);
  assert.ok(validateData(d));
  const edited = moveCardPurchase(d, d.transactions[1], {
    ...template,
    id: d.transactions[1].id,
    date: "2026-02-20",
  });
  assert.equal(edited.recurrenceIndex, 2);
  assert.throws(() => makeRecurringExpenses(template, 0));
  assert.throws(() => makeRecurringExpenses(template, 121));
  d.transactions[1].recurrenceIndex = 4;
  assert.equal(validateData(d), false);
});

test("compras e despesas fixas no cartão entram no mês de vencimento da fatura", async () => {
  const { makeRecurringExpenses, transactionMonth, moveCardPurchase } =
    await import("../src/lib/finance.ts");
  let d = structuredClone(base);
  d.cards[0].dueDay = 5;
  const c = d.cards[0];
  d.transactions = makeRecurringExpenses(
    {
      id: "subscription",
      title: "Assinatura",
      type: "expense",
      amount: 5000,
      date: "2026-10-25",
      categoryId: "food",
      accountId: "a",
      cardId: c.id,
      paid: true,
    },
    3,
    c,
  );
  assert.deepEqual(d.transactions.map(transactionMonth), [
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
  assert.ok(d.transactions.every((t) => !t.paid));
  assert.equal(totals(d, "2026-10").expense, 0);
  assert.equal(totals(d, "2026-12").expense, 5000);
  assert.ok(validateData(d));
  d = payInvoice(d, c.id, "2026-12");
  assert.equal(totals(d, "2026-12").expense, 5000);
  assert.equal(accountBalance(d, "a"), 95000);
  const before = d.transactions[1];
  const moved = moveCardPurchase(d, before, { ...before, date: "2026-11-10" });
  assert.equal(transactionMonth(moved), "2026-12");
  assert.equal(moved.recurrenceIndex, 2);
});

test("ícone escolhido da categoria e repetições sobrevivem ao backup e mesclagem", async () => {
  const { makeRecurringExpenses } = await import("../src/lib/finance.ts");
  const { decodeCloud, mergeFinance } = await import("../src/lib/syncMerge.ts");
  const before = structuredClone(base),
    local = structuredClone(before);
  local.categories.push({
    id: "custom",
    name: "Internet",
    icon: "wifi-outline",
    color: "#12ab34",
    type: "expense",
  });
  local.transactions = makeRecurringExpenses(
    {
      id: "internet",
      title: "Internet",
      type: "expense",
      amount: 10000,
      date: "2026-11-01",
      categoryId: "custom",
      accountId: "a",
      paid: false,
    },
    2,
  );
  const merged = mergeFinance(before, local, before);
  const restored = decodeCloud({
    schemaVersion: 1,
    revision: 1,
    payload: JSON.stringify(merged),
  }).data;
  assert.equal(
    restored.categories.find((c) => c.id === "custom")!.icon,
    "wifi-outline",
  );
  assert.equal(restored.transactions[1].recurrenceIndex, 2);
  assert.equal(totals(restored, "2026-12").expense, 10000);
});
