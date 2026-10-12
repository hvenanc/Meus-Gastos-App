import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type Data,
  initialData,
  validateData,
  upgradeCategories,
} from "./finance";
import { storageKey } from "./storageKey";
export { STORAGE_KEY } from "./storageKey";
export async function loadData(userId?: string): Promise<Data> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return JSON.parse(JSON.stringify(initialData)) as Data;
  const parsed: unknown = JSON.parse(raw);
  if (!validateData(parsed))
    throw new Error(
      "Os dados locais não puderam ser lidos. Importe um backup válido para recuperá-los.",
    );
  return upgradeCategories(parsed);
}
export async function saveData(data: Data, userId?: string) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(data));
}
