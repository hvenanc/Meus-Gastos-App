import type { Data } from "./finance.ts";

export type InvestmentAccount = {
  id: string;
  name: string;
  bank: string;
  initialBalance: number;
  createdAt?: string;
};
/** Older uid() identifiers embed their original creation timestamp. */
export function investmentAccountCreatedDate(
  account: InvestmentAccount,
): string | undefined {
  if (account.createdAt) return account.createdAt;
  const match = /^([a-z0-9]{8,10})-[a-z0-9]+$/.exec(account.id);
  if (!match) return undefined;
  const timestamp = parseInt(match[1], 36);
  if (timestamp < Date.UTC(2020, 0, 1) || timestamp >= Date.UTC(2100, 0, 1))
    return undefined;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export type InvestmentMovement = {
  id: string;
  accountId: string;
  type: "contribution" | "withdrawal" | "yield" | "loss";
  amount: number;
  date: string;
  note: string;
  sourceTransactionId?: string;
};
export type InvestmentAccess = {
  version: 1;
  salt: string;
  hash: string;
  iterations: 100000;
};
export type InvestmentState = {
  investmentAccounts?: InvestmentAccount[];
  investmentMovements?: InvestmentMovement[];
  investmentAccess?: InvestmentAccess;
};
export const investmentAmount = (m: InvestmentMovement) =>
  m.type === "withdrawal" || m.type === "loss" ? -m.amount : m.amount;
export function investmentBalance(state: InvestmentState, accountId: string) {
  return (
    (state.investmentAccounts?.find((a) => a.id === accountId)
      ?.initialBalance ?? 0) +
    (state.investmentMovements ?? [])
      .filter((m) => m.accountId === accountId)
      .reduce((sum, m) => sum + investmentAmount(m), 0)
  );
}
export function validInvestmentAccess(
  value: unknown,
): value is InvestmentAccess {
  const v = value as InvestmentAccess | undefined;
  return Boolean(
    v &&
    v.version === 1 &&
    v.iterations === 100000 &&
    /^[a-f0-9]{32}$/.test(v.salt) &&
    /^[a-f0-9]{64}$/.test(v.hash),
  );
}
const cents = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
const validDate = (iso: unknown) => {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00`);
  return (
    !Number.isNaN(d.getTime()) &&
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` ===
      iso
  );
};
export function investmentValidationError(
  state: InvestmentState,
): string | null {
  if (
    state.investmentAccess !== undefined &&
    !validInvestmentAccess(state.investmentAccess)
  )
    return "Configuração do PIN de investimentos inválida.";
  if (
    (state.investmentAccounts !== undefined &&
      !Array.isArray(state.investmentAccounts)) ||
    (state.investmentMovements !== undefined &&
      !Array.isArray(state.investmentMovements))
  )
    return "Dados de investimentos inválidos.";
  const accounts = state.investmentAccounts ?? [],
    movements = state.investmentMovements ?? [];
  if (!Array.isArray(accounts) || !Array.isArray(movements))
    return "Dados de investimentos inválidos.";
  if (
    !accounts.every(
      (a) =>
        a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        !!a.name.trim() &&
        typeof a.bank === "string" &&
        cents(a.initialBalance) &&
        (a.createdAt === undefined || validDate(a.createdAt)),
    )
  )
    return "Conta de investimentos inválida.";
  if (
    new Set(accounts.map((a) => a.id)).size !== accounts.length ||
    new Set(movements.map((m) => m?.id)).size !== movements.length
  )
    return "Identificadores duplicados nos investimentos.";
  if (
    !movements.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        accounts.some((a) => a.id === m.accountId) &&
        ["contribution", "withdrawal", "yield", "loss"].includes(m.type) &&
        cents(m.amount) &&
        m.amount > 0 &&
        validDate(m.date) &&
        typeof m.note === "string",
    )
  )
    return "Movimentação de investimentos inválida.";
  for (const a of accounts) {
    let balance = a.initialBalance;
    for (const m of movements
      .filter((m) => m.accountId === a.id)
      .sort((a, b) => a.date.localeCompare(b.date))) {
      balance += investmentAmount(m);
      if (!Number.isSafeInteger(balance) || balance < 0)
        return "A retirada ou perda deixaria a conta de investimentos com saldo negativo. Confira os valores e as datas.";
    }
  }
  return null;
}
export const investmentLabels = {
  contribution: "Aporte",
  withdrawal: "Retirada",
  yield: "Rendimento",
  loss: "Perda / ajuste negativo",
};

/** Both entries must remain present and agree; this also protects imports and cloud merges. */
export function investmentTransferValidationError(data: Data): string | null {
  const movements = new Map(
    (data.investmentMovements ?? []).map((m) => [m.id, m]),
  );
  const transactions = new Map(data.transactions.map((t) => [t.id, t]));
  for (const transaction of data.transactions) {
    if (transaction.investmentMovementId === undefined) continue;
    const movement = movements.get(transaction.investmentMovementId);
    if (
      !data.investmentAccess ||
      typeof transaction.investmentMovementId !== "string" ||
      !transaction.investmentMovementId ||
      transaction.type !== "transfer" ||
      !transaction.paid ||
      transaction.destinationId !== undefined ||
      transaction.cardId ||
      transaction.invoicePayment ||
      transaction.refundOf ||
      transaction.recurrenceId ||
      !movement ||
      movement.type !== "contribution" ||
      movement.sourceTransactionId !== transaction.id ||
      movement.amount !== transaction.amount ||
      movement.date !== transaction.date
    )
      return "A transferência para investimentos está incompleta ou tem valores divergentes.";
  }
  for (const movement of movements.values()) {
    if (movement.sourceTransactionId === undefined) continue;
    const transaction = transactions.get(movement.sourceTransactionId);
    if (
      typeof movement.sourceTransactionId !== "string" ||
      !movement.sourceTransactionId ||
      movement.type !== "contribution" ||
      !transaction ||
      transaction.investmentMovementId !== movement.id
    )
      return "O aporte vinculado não tem uma transferência de origem válida.";
  }
  return null;
}
