import { type Data, validateData, upgradeCategories } from "./finance.ts";
import { investmentTransferAvailable } from "./investmentTransfers.ts";
const fields = [
  "accounts",
  "cards",
  "categories",
  "transactions",
  "goals",
  "budgets",
  "investmentAccounts",
  "investmentMovements",
] as const;
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
};
export const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export class SyncConflict extends Error {
  constructor(
    message = "O mesmo registro foi alterado em outro aparelho. Exporte um backup das alterações locais antes de usar a versão da nuvem.",
  ) {
    super(message);
  }
}
/** Three-way merge: different records merge; concurrent edits of the same record are explicit conflicts. */
export function mergeFinance(base: Data, local: Data, remote: Data): Data {
  if (base.resetId !== remote.resetId && !equalFinance(base, local))
    throw new SyncConflict();
  const originalIds = new Set(base.transactions.map((t) => t.id));
  const localIds = new Set(local.transactions.map((t) => t.id));
  const remoteIds = new Set(remote.transactions.map((t) => t.id));
  // Different phones can receive the same bank event with different Android IDs.
  const newLocalNotices = local.transactions.filter(
    (t) =>
      t.notificationImportId && !originalIds.has(t.id) && !remoteIds.has(t.id),
  );
  const newRemoteNotices = remote.transactions.filter(
    (t) =>
      t.notificationImportId && !originalIds.has(t.id) && !localIds.has(t.id),
  );
  if (
    newLocalNotices.some((a) =>
      newRemoteNotices.some(
        (b) =>
          a.id !== b.id &&
          a.type === b.type &&
          a.amount === b.amount &&
          a.date === b.date &&
          a.accountId === b.accountId &&
          a.cardId === b.cardId &&
          Math.abs(a.notificationImportedAt! - b.notificationImportedAt!) <=
            120000,
      ),
    )
  )
    throw new SyncConflict(
      "Duas importações de notificações podem representar a mesma transação. Revise os lançamentos antes de usar a versão da nuvem.",
    );
  const independentLocalPayment = local.transactions.some(
    (t) => t.invoicePayment && !originalIds.has(t.id) && !remoteIds.has(t.id),
  );
  const independentRemotePayment = remote.transactions.some(
    (t) => t.invoicePayment && !originalIds.has(t.id) && !localIds.has(t.id),
  );
  if (independentLocalPayment && independentRemotePayment) {
    const localPaid = new Set(
      local.transactions.filter((t) => t.cardId && t.paid).map((t) => t.id),
    );
    const remotePaid = new Set(
      remote.transactions.filter((t) => t.cardId && t.paid).map((t) => t.id),
    );
    // Two devices paying the same invoice must not create two account debits.
    if (
      base.transactions.some(
        (t) =>
          t.cardId && !t.paid && localPaid.has(t.id) && remotePaid.has(t.id),
      )
    )
      throw new SyncConflict();
  }
  const result: Data = { ...remote };
  if (!same(base.name, local.name)) {
    if (!same(base.name, remote.name) && !same(local.name, remote.name))
      throw new SyncConflict();
    result.name = local.name;
  }
  if (!same(base.investmentAccess, local.investmentAccess)) {
    if (
      !same(base.investmentAccess, remote.investmentAccess) &&
      !same(local.investmentAccess, remote.investmentAccess)
    )
      throw new SyncConflict();
    if (local.investmentAccess)
      result.investmentAccess = local.investmentAccess;
    else delete result.investmentAccess;
  }
  for (const field of fields) {
    const old = new Map((base[field] ?? []).map((x) => [x.id, x]));
    const next = new Map((local[field] ?? []).map((x) => [x.id, x]));
    const cloud = new Map((remote[field] ?? []).map((x) => [x.id, x]));
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const before = old.get(id),
        after = next.get(id),
        elsewhere = cloud.get(id);
      if (same(before, after)) continue;
      if (!same(before, elsewhere) && !same(after, elsewhere))
        throw new SyncConflict();
      if (after) cloud.set(id, after);
      else cloud.delete(id);
    }
    (result[field] as unknown[]) = [...cloud.values()];
  }
  // Account/category deletion on another device must never orphan local transactions.
  if (!validateData(result)) throw new SyncConflict();
  const changedTransfers = result.transactions.filter(
    (t) =>
      t.investmentMovementId &&
      !same(
        base.transactions.find((b) => b.id === t.id),
        t,
      ),
  );
  for (const transfer of changedTransfers) {
    if (
      investmentTransferAvailable(result, transfer.accountId, transfer.date) < 0
    )
      throw new SyncConflict(
        "As transferências entre aparelhos excedem o saldo da conta de origem. Revise os lançamentos antes de sincronizar.",
      );
  }
  return result;
}
export const equalFinance = (a: Data, b: Data) => same(a, b);
export function decodeCloud(value: unknown): { data: Data; revision: number } {
  const v = value as {
    schemaVersion?: number;
    revision?: number;
    payload?: string;
  } | null;
  if (
    !v ||
    ![1, 2, 3].includes(v.schemaVersion ?? 0) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 1 ||
    typeof v.payload !== "string"
  )
    throw new Error(
      "Os dados da nuvem têm um formato incompatível. Exporte seus dados locais antes de tentar recuperar.",
    );
  const data: unknown = JSON.parse(v.payload);
  if (!validateData(data))
    throw new Error("Os dados da nuvem não são válidos.");
  return { data: upgradeCategories(data), revision: v.revision! };
}
