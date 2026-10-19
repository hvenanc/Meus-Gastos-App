import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type Data,
  initialData,
  validateData,
  upgradeCategories,
} from "./finance";
import { readRecordStore, writeRecordStore } from "./recordStorage";
import { storageKey } from "./storageKey";
export { STORAGE_KEY } from "./storageKey";
export async function loadData(userId?: string): Promise<Data> {
  const key = storageKey(userId);
  const normalized = await readRecordStore(key);
  if (normalized) return upgradeCategories(normalized.snapshots.data);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return JSON.parse(JSON.stringify(initialData)) as Data;
  const parsed: unknown = JSON.parse(raw);
  if (!validateData(parsed))
    throw new Error(
      "Os dados locais não puderam ser lidos. Importe um backup válido para recuperá-los.",
    );
  const data = upgradeCategories(parsed);
  await writeRecordStore(key, { data }, { resetId: data.resetId ?? null });
  await AsyncStorage.removeItem(key);
  return data;
}
export async function saveData(data: Data, userId?: string) {
  await writeRecordStore(
    storageKey(userId),
    { data },
    { resetId: data.resetId ?? null },
  );
}
