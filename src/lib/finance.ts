import {
  investmentValidationError,
  type InvestmentAccount,
  type InvestmentMovement,
  type InvestmentAccess,
} from "./investments.ts";
export type Account = {
  id: string;
  name: string;
  bank: string;
  initialBalance: number;
};
export type Card = {
  id: string;
  name: string;
  bank: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  accountId: string;
};
export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
};
export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  title: string;
  amount: number;
  date: string;
  categoryId: string;
  accountId: string;
  destinationId?: string;
  cardId?: string;
  paid: boolean;
  installment?: string;
  groupId?: string;
  invoiceMonth?: string;
  invoicePayment?: boolean;
  refundOf?: string;
  note?: string;
  recurrenceId?: string;
  recurrenceIndex?: number;
  recurrenceCount?: number;
};
export type Goal = { id: string; name: string; target: number; saved: number };
export type Budget = { id: string; categoryId: string; amount: number };
export type Data = {
  version: 1;
  categoryCatalogVersion?: 1;
  resetId?: string;
  name: string;
  investmentAccounts?: InvestmentAccount[];
  investmentMovements?: InvestmentMovement[];
  investmentAccess?: InvestmentAccess;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
};
export const initialData: Data = {
  version: 1,
  categoryCatalogVersion: 1,
  name: "Você",
  investmentAccounts: [],
  investmentMovements: [],
  accounts: [],
  cards: [],
  transactions: [],
  goals: [],
  budgets: [],
  categories: [
    {
      id: "food",
      name: "Alimentação",
      icon: "restaurant-outline",
      color: "#f5a65b",
      type: "expense",
    },
    {
      id: "home",
      name: "Moradia",
      icon: "home-outline",
      color: "#ad91ff",
      type: "expense",
    },
    {
      id: "transport",
      name: "Transporte",
      icon: "car-outline",
      color: "#65b5ff",
      type: "expense",
    },
    {
      id: "shopping",
      name: "Compras",
      icon: "bag-outline",
      color: "#ed84b5",
      type: "expense",
    },
    {
      id: "health",
      name: "Saúde",
      icon: "heart-outline",
      color: "#fa8585",
      type: "expense",
    },
    {
      id: "fun",
      name: "Lazer",
      icon: "game-controller-outline",
      color: "#71c9bc",
      type: "expense",
    },
    {
      id: "education",
      name: "Educação",
      icon: "school-outline",
      color: "#e4cd73",
      type: "expense",
    },
    {
      id: "other",
      name: "Outros",
      icon: "ellipsis-horizontal",
      color: "#929ba8",
      type: "expense",
    },
    {
      id: "salary",
      name: "Salário",
      icon: "briefcase-outline",
      color: "#29d899",
      type: "income",
    },
    {
      id: "extra",
      name: "Renda extra",
      icon: "sparkles-outline",
      color: "#87c86c",
      type: "income",
    },
    {
      id: "freelance",
      name: "Freelance / serviços",
      icon: "laptop-outline",
      color: "#65b5ff",
      type: "income",
    },
    {
      id: "investments",
      name: "Rendimentos",
      icon: "trending-up-outline",
      color: "#ad91ff",
      type: "income",
    },
    {
      id: "rent-income",
      name: "Aluguéis",
      icon: "home-outline",
      color: "#e4cd73",
      type: "income",
    },
    {
      id: "sales-income",
      name: "Vendas",
      icon: "storefront-outline",
      color: "#f5a65b",
      type: "income",
    },
    {
      id: "refund-income",
      name: "Reembolsos",
      icon: "return-down-back-outline",
      color: "#71c9bc",
      type: "income",
    },
    {
      id: "other-income",
      name: "Outras receitas",
      icon: "ellipsis-horizontal",
      color: "#929ba8",
      type: "income",
    },
  ],
};
/** Add new income defaults once, preserving custom categories and future deletions. */
export function upgradeCategories(data: Data): Data {
  data = {
    ...data,
    investmentAccounts: data.investmentAccounts ?? [],
    investmentMovements: data.investmentMovements ?? [],
  };
  if (data.categoryCatalogVersion === 1) return data;
  const missing = initialData.categories.filter(
    (c) =>
      c.type === "income" &&
      !data.categories.some((existing) => existing.id === c.id),
  );
  return {
    ...data,
    categoryCatalogVersion: 1,
    categories: [...data.categories, ...missing],
  };
}
export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function parseMoney(value: string): number {
  const clean = value
    .trim()
    .replace(/R\$\s?/g, "")
    .replace(/\s/g, "");
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(clean))
    throw new Error("Use um valor válido, como 150,00.");
  const [whole, fraction = ""] = clean.replace(/\./g, "").split(",");
  const valueNumber = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(valueNumber)) throw new Error("Valor muito alto.");
  return valueNumber;
}
export const inputMoney = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00`);
  return (
    !isNaN(d.getTime()) &&
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` ===
      date
  );
}
export function addMonths(date: string, offset: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1 + offset, 1, 12);
  const day = Math.min(
    d,
    new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(),
  );
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
export function accountBalance(data: Data, id: string) {
  return (
    (data.accounts.find((a) => a.id === id)?.initialBalance ?? 0) +
    data.transactions.reduce((n, t) => {
      if (!t.paid || t.cardId) return n;
      if (t.type === "transfer")
        return (
          n +
          (t.destinationId === id ? t.amount : 0) -
          (t.accountId === id ? t.amount : 0)
        );
      return (
        n +
        (t.accountId === id ? (t.type === "income" ? t.amount : -t.amount) : 0)
      );
    }, 0)
  );
}
export const transactionMonth = (t: Transaction) =>
  t.cardId && t.type === "expense"
    ? (t.invoiceMonth ?? t.date.slice(0, 7))
    : t.date.slice(0, 7);
export const inMonth = (t: Transaction, month: string) =>
  !t.invoicePayment && t.type !== "transfer" && transactionMonth(t) === month;
export function totals(data: Data, month: string) {
  const ts = data.transactions.filter((t) => inMonth(t, month));
  return {
    income: ts
      .filter((t) => t.type === "income")
      .reduce((n, t) => n + t.amount, 0),
    expense: ts
      .filter((t) => t.type === "expense")
      .reduce((n, t) => n + transactionAmount(t), 0),
  };
}
export function invoiceMonth(date: string, card: Card) {
  const [year, month, day] = date.split("-").map(Number);
  const closingDay = Math.min(
    card.closingDay,
    new Date(year, month, 0).getDate(),
  );
  return addMonths(
    date,
    (day >= closingDay ? 1 : 0) + (card.dueDay <= card.closingDay ? 1 : 0),
  ).slice(0, 7);
}
export function makeInstallments(
  transaction: Transaction,
  count: number,
  card: Card,
): Transaction[] {
  const base = Math.floor(transaction.amount / count),
    remainder = transaction.amount % count;
  const firstInvoice = invoiceMonth(transaction.date, card);
  return Array.from({ length: count }, (_, i) => ({
    ...transaction,
    id: uid(),
    groupId: transaction.id,
    amount: base + (i < remainder ? 1 : 0),
    date: addMonths(transaction.date, i),
    installment: count > 1 ? `${i + 1}/${count}` : undefined,
    invoiceMonth: addMonths(`${firstInvoice}-01`, i).slice(0, 7),
    paid: false,
  }));
}
export function makeRecurringExpenses(
  transaction: Transaction,
  count: number,
  card?: Card,
): Transaction[] {
  if (
    transaction.type !== "expense" ||
    transaction.refundOf ||
    transaction.invoicePayment ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 120 ||
    !validDate(transaction.date) ||
    !Number.isSafeInteger(transaction.amount) ||
    transaction.amount <= 0 ||
    (transaction.cardId && (!card || card.id !== transaction.cardId))
  )
    throw new Error(
      "Use de 1 a 120 repetições mensais com uma despesa válida.",
    );
  return Array.from({ length: count }, (_, i) => {
    const date = addMonths(transaction.date, i);
    return {
      ...transaction,
      id: uid(),
      date,
      recurrenceId: transaction.id,
      recurrenceIndex: i + 1,
      recurrenceCount: count,
      paid: card ? false : i === 0 && transaction.paid,
      ...(card
        ? { accountId: card.accountId, invoiceMonth: invoiceMonth(date, card) }
        : {}),
    };
  });
}
export const transactionAmount = (t: Transaction) =>
  t.refundOf ? -t.amount : t.amount;
export function invoiceIsOpen(card: Card, month: string, date = today()) {
  const closingMonth = addMonths(
    `${month}-01`,
    card.dueDay <= card.closingDay ? -1 : 0,
  ).slice(0, 7);
  const [year, m] = closingMonth.split("-").map(Number);
  const day = Math.min(card.closingDay, new Date(year, m, 0).getDate());
  return date < `${closingMonth}-${String(day).padStart(2, "0")}`;
}
export function invoice(data: Data, cardId: string, month: string) {
  const current = data.transactions.filter(
    (t) => t.cardId === cardId && t.invoiceMonth === month,
  );
  const previous = data.transactions.filter(
    (t) => t.cardId === cardId && !t.paid && t.invoiceMonth! < month,
  );
  const previousNet = previous.reduce(
    (sum, t) => sum + transactionAmount(t),
    0,
  );
  // Only a net credit is carried. Overdue positive invoices remain payable in their own month.
  const carried = previousNet <= 0 ? previous : [];
  const items = [...carried, ...current];
  const pendingNet = items
    .filter((t) => !t.paid)
    .reduce((sum, t) => sum + transactionAmount(t), 0);
  return {
    items,
    total: items.reduce((sum, t) => sum + transactionAmount(t), 0),
    pending: Math.max(0, pendingNet),
    credit: Math.max(0, -pendingNet),
    carriedCredit: Math.max(0, -previousNet),
  };
}

export function payInvoice(data: Data, cardId: string, month: string): Data {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card) throw new Error("Cartão não encontrado.");
  const bill = invoice(data, cardId, month);
  if (bill.pending <= 0)
    throw new Error("Não há valores em aberto nesta fatura.");
  const payment: Transaction = {
    id: uid(),
    type: "expense",
    title: `Fatura · ${card.name} · ${monthLabel(month)}`,
    amount: bill.pending,
    date: today(),
    categoryId:
      data.categories.find((c) => c.id === "other" && c.type === "expense")
        ?.id ?? bill.items[0].categoryId,
    accountId: card.accountId,
    paid: true,
    invoicePayment: true,
  };
  return {
    ...data,
    transactions: [
      ...data.transactions.map((t) =>
        bill.items.some((item) => item.id === t.id) ? { ...t, paid: true } : t,
      ),
      payment,
    ],
  };
}
export function remainingRefund(data: Data, original: Transaction) {
  return (
    original.amount -
    data.transactions
      .filter((t) => t.refundOf === original.id)
      .reduce((sum, t) => sum + t.amount, 0)
  );
}
export function refundCardPurchase(
  data: Data,
  purchaseId: string,
  amount: number,
  date: string,
): Data {
  const purchase = data.transactions.find((t) => t.id === purchaseId);
  if (!purchase?.cardId || purchase.refundOf || purchase.invoicePayment)
    throw new Error("Escolha uma compra no cartão.");
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > remainingRefund(data, purchase)
  )
    throw new Error(
      "O estorno deve ser maior que zero e não pode superar o valor ainda disponível da compra.",
    );
  if (!validDate(date)) throw new Error("Data inválida.");
  const card = data.cards.find((c) => c.id === purchase.cardId)!;
  const credit: Transaction = {
    id: uid(),
    title: `Estorno · ${purchase.title}`,
    type: "expense",
    amount,
    date,
    categoryId: purchase.categoryId,
    accountId: purchase.accountId,
    cardId: card.id,
    invoiceMonth: invoiceMonth(date, card),
    paid: false,
    refundOf: purchase.id,
  };
  return { ...data, transactions: [...data.transactions, credit] };
}
export function moveCardPurchase(
  data: Data,
  original: Transaction,
  edited: Transaction,
): Transaction {
  const recurrence = original.recurrenceId
    ? {
        recurrenceId: original.recurrenceId,
        recurrenceIndex: original.recurrenceIndex,
        recurrenceCount: original.recurrenceCount,
      }
    : {};
  if (!original.cardId) return { ...edited, ...recurrence };
  if (
    original.paid ||
    original.refundOf ||
    data.transactions.some((t) => t.refundOf === original.id)
  )
    throw new Error(
      "Compras quitadas ou com estorno registrado não podem ser alteradas.",
    );
  const card = data.cards.find((c) => c.id === original.cardId);
  if (!card) throw new Error("Cartão não encontrado.");
  return {
    ...edited,
    ...recurrence,
    cardId: original.cardId,
    accountId: card.accountId,
    installment: original.installment,
    groupId: original.groupId,
    invoiceMonth:
      edited.date === original.date
        ? original.invoiceMonth
        : invoiceMonth(edited.date, card),
    paid: false,
  };
}
export function resetFinance(data: Data): Data {
  return {
    ...JSON.parse(JSON.stringify(initialData)),
    name: data.name,
    resetId: uid(),
  };
}
export function validateData(value: unknown): value is Data {
  if (!value || typeof value !== "object") return false;
  const d = value as Data;
  if (investmentValidationError(d)) return false;
  const str = (v: unknown) => typeof v === "string";
  const cents = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  if (
    d.version !== 1 ||
    !str(d.name) ||
    ![
      "accounts",
      "cards",
      "categories",
      "transactions",
      "goals",
      "budgets",
    ].every((k) => Array.isArray((d as any)[k]))
  )
    return false;
  if (
    ![
      d.accounts,
      d.cards,
      d.categories,
      d.transactions,
      d.goals,
      d.budgets,
    ].every((list) =>
      list.every((item) => item !== null && typeof item === "object"),
    )
  )
    return false;
  if (
    !d.accounts.every(
      (a) => str(a.id) && str(a.name) && str(a.bank) && cents(a.initialBalance),
    )
  )
    return false;
  if (
    !d.categories.every(
      (c) =>
        str(c.id) &&
        str(c.name) &&
        str(c.icon) &&
        /^#[\da-fA-F]{6}$/.test(c.color) &&
        ["income", "expense"].includes(c.type),
    )
  )
    return false;
  if (
    !d.cards.every(
      (c) =>
        str(c.id) &&
        str(c.name) &&
        str(c.bank) &&
        cents(c.limit) &&
        Number.isInteger(c.closingDay) &&
        c.closingDay >= 1 &&
        c.closingDay <= 31 &&
        Number.isInteger(c.dueDay) &&
        c.dueDay >= 1 &&
        c.dueDay <= 31 &&
        d.accounts.some((a) => a.id === c.accountId),
    )
  )
    return false;
  if (
    !d.transactions.every(
      (t) =>
        str(t.id) &&
        str(t.title) &&
        cents(t.amount) &&
        t.amount > 0 &&
        validDate(t.date) &&
        ["income", "expense", "transfer"].includes(t.type) &&
        typeof t.paid === "boolean" &&
        (t.recurrenceId === undefined
          ? t.recurrenceIndex === undefined && t.recurrenceCount === undefined
          : t.type === "expense" &&
            !t.refundOf &&
            !t.invoicePayment &&
            str(t.recurrenceId) &&
            Number.isSafeInteger(t.recurrenceCount) &&
            t.recurrenceCount! >= 1 &&
            t.recurrenceCount! <= 120 &&
            Number.isSafeInteger(t.recurrenceIndex) &&
            t.recurrenceIndex! >= 1 &&
            t.recurrenceIndex! <= t.recurrenceCount!) &&
        d.accounts.some((a) => a.id === t.accountId) &&
        (t.type === "transfer" ||
          d.categories.some(
            (c) => c.id === t.categoryId && c.type === t.type,
          )) &&
        (!t.cardId || d.cards.some((c) => c.id === t.cardId)) &&
        (t.type !== "transfer" ||
          (d.accounts.some((a) => a.id === t.destinationId) &&
            t.destinationId !== t.accountId)) &&
        (!t.cardId ||
          (t.type === "expense" &&
            typeof t.invoiceMonth === "string" &&
            /^\d{4}-(0[1-9]|1[0-2])$/.test(t.invoiceMonth))),
    )
  )
    return false;
  if (
    !d.goals.every(
      (g) =>
        str(g.id) &&
        str(g.name) &&
        cents(g.target) &&
        g.target > 0 &&
        cents(g.saved),
    ) ||
    !d.budgets.every(
      (b) =>
        str(b.id) &&
        cents(b.amount) &&
        b.amount > 0 &&
        d.categories.some((c) => c.id === b.categoryId),
    )
  )
    return false;
  if (d.resetId !== undefined && !str(d.resetId)) return false;
  for (const credit of d.transactions.filter((t) => t.refundOf !== undefined)) {
    const original = d.transactions.find((t) => t.id === credit.refundOf);
    if (
      !original ||
      !original.cardId ||
      original.refundOf ||
      original.invoicePayment ||
      credit.type !== "expense" ||
      credit.cardId !== original.cardId ||
      credit.categoryId !== original.categoryId ||
      credit.accountId !== original.accountId
    )
      return false;
    if (remainingRefund(d, original) < 0) return false;
  }
  return [
    d.accounts,
    d.cards,
    d.categories,
    d.transactions,
    d.goals,
    d.budgets,
  ].every((list) => new Set(list.map((x) => x.id)).size === list.length);
}
export function demoData(): Data {
  const date = today();
  return {
    ...initialData,
    name: "Henrique",
    accounts: [
      { id: "wallet", name: "Carteira", bank: "wallet", initialBalance: 15000 },
      {
        id: "nubank",
        name: "Minha conta",
        bank: "nubank",
        initialBalance: 245000,
      },
      {
        id: "itau",
        name: "Conta principal",
        bank: "itau",
        initialBalance: 100000,
      },
    ],
    cards: [
      {
        id: "nu-card",
        name: "Nubank Platinum",
        bank: "nubank",
        limit: 500000,
        closingDay: 20,
        dueDay: 27,
        accountId: "nubank",
      },
    ],
    transactions: [
      {
        id: "sal",
        title: "Salário",
        type: "income",
        amount: 580000,
        date,
        categoryId: "salary",
        accountId: "itau",
        paid: true,
      },
      {
        id: "market",
        title: "Compras do mercado",
        type: "expense",
        amount: 18690,
        date,
        categoryId: "food",
        accountId: "nubank",
        paid: true,
      },
      {
        id: "coffee",
        title: "Café da tarde",
        type: "expense",
        amount: 2450,
        date,
        categoryId: "food",
        accountId: "wallet",
        paid: true,
      },
      {
        id: "uber",
        title: "Uber",
        type: "expense",
        amount: 3280,
        date,
        categoryId: "transport",
        accountId: "nubank",
        paid: true,
      },
      {
        id: "net",
        title: "Internet",
        type: "expense",
        amount: 11990,
        date,
        categoryId: "home",
        accountId: "itau",
        paid: false,
      },
      ...makeInstallments(
        {
          id: "headphones",
          title: "Fone de ouvido",
          type: "expense",
          amount: 29990,
          date,
          categoryId: "shopping",
          accountId: "nubank",
          cardId: "nu-card",
          paid: false,
        },
        3,
        {
          id: "nu-card",
          name: "Nubank",
          bank: "nubank",
          limit: 500000,
          closingDay: 20,
          dueDay: 27,
          accountId: "nubank",
        },
      ),
    ],
    goals: [
      {
        id: "reserve",
        name: "Reserva de emergência",
        target: 2000000,
        saved: 450000,
      },
    ],
    budgets: [{ id: "food-budget", categoryId: "food", amount: 90000 }],
  };
}
