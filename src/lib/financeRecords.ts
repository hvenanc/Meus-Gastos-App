import { type Data, validateData } from "./finance.ts";

export const recordFields = [
  "accounts",
  "cards",
  "categories",
  "transactions",
  "goals",
  "budgets",
  "investmentAccounts",
  "investmentMovements",
] as const;
export type RecordField = (typeof recordFields)[number];
export type FinanceRecord = { path: string; value: Record<string, unknown> };

export function financeRecords(data: Data): FinanceRecord[] {
  if (!validateData(data))
    throw new Error("Os dados financeiros não são válidos.");
  const profile = { ...data } as Record<string, unknown>;
  for (const field of recordFields) delete profile[field];
  const records: FinanceRecord[] = [{ path: "profile/main", value: profile }];
  for (const field of recordFields) {
    (data[field] ?? []).forEach((record, index) => {
      records.push({
        path: `${field}/id-${encodeURIComponent(record.id)}`,
        value: { ...record, _position: index },
      });
    });
  }
  // Firestore does not accept undefined, including optional fields in records.
  return JSON.parse(JSON.stringify(records));
}

export function restoreFinanceRecords(records: FinanceRecord[]): Data {
  const profile = records.find((record) => record.path === "profile/main");
  if (!profile) throw new Error("O perfil financeiro não foi encontrado.");
  const data = { ...profile.value } as unknown as Data;
  for (const field of recordFields) {
    const items = records.filter((record) =>
      record.path.startsWith(`${field}/`),
    );
    items.sort((a, b) => Number(a.value._position) - Number(b.value._position));
    (data[field] as unknown[]) = items.map(({ value }, index) => {
      if (value._position !== index)
        throw new Error("A sequência de registros está incompleta.");
      const { _position, ...record } = value;
      return record;
    });
  }
  if (!validateData(data))
    throw new Error("Os registros financeiros estão incompletos ou inválidos.");
  return data;
}

export const recordCounts = (data: Data) =>
  Object.fromEntries(
    recordFields.map((field) => [field, (data[field] ?? []).length]),
  );
