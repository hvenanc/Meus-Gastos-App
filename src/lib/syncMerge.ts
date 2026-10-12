import { type Data, validateData, upgradeCategories } from "./finance.ts";
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
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export class SyncConflict extends Error {
  constructor() {
    super(
      "O mesmo registro foi alterado em outro aparelho. Exporte um backup das alterações locais antes de usar a versão da nuvem.",
    );
  }
}
/** Three-way merge: different records merge; concurrent edits of the same record are explicit conflicts. */
export function mergeFinance(base: Data, local: Data, remote: Data): Data {
  if (base.resetId !== remote.resetId && !equalFinance(base, local))
    throw new SyncConflict();
  const originalIds = new Set(base.transactions.map((t) => t.id));
  const localIds = new Set(local.transactions.map((t) => t.id));
  const remoteIds = new Set(remote.transactions.map((t) => t.id));
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
      "Os dados do Firebase têm um formato incompatível. Exporte seus dados locais antes de tentar recuperar.",
    );
  const data: unknown = JSON.parse(v.payload);
  if (!validateData(data))
    throw new Error("Os dados do Firebase não são válidos.");
  return { data: upgradeCategories(data), revision: v.revision! };
}
