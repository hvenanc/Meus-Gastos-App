import AsyncStorage from "@react-native-async-storage/async-storage";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type Data } from "./finance.ts";
import { financeRecords, restoreFinanceRecords } from "./financeRecords.ts";

type RecordPointer = { path: string; key: string };
type Snapshot = { pages: string[] };
type Manifest = {
  version: 2;
  meta: Record<string, unknown>;
  snapshots: Record<string, Snapshot>;
};
const queues = new Map<string, Promise<unknown>>();

/** Immutable records are written before one atomic manifest switch. Interrupted writes leave the previous version readable. */
export async function writeRecordStore(
  key: string,
  snapshots: Record<string, Data>,
  meta: Record<string, unknown> = {},
) {
  const job = (queues.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const manifest: Manifest = { version: 2, meta, snapshots: {} };
      const values = new Map<string, string>();
      for (const [name, data] of Object.entries(snapshots)) {
        const pointers: RecordPointer[] = financeRecords(data).map((record) => {
          const value = JSON.stringify(record.value);
          const recordKey = `${key}/records/${bytesToHex(sha256(utf8ToBytes(record.path + "\n" + value)))}`;
          values.set(recordKey, value);
          return { path: record.path, key: recordKey };
        });
        const pages: string[] = [];
        for (let offset = 0; offset < pointers.length; offset += 100) {
          const page = JSON.stringify(pointers.slice(offset, offset + 100));
          const pageKey = `${key}/records/page-${bytesToHex(sha256(utf8ToBytes(page)))}`;
          values.set(pageKey, page);
          pages.push(pageKey);
        }
        manifest.snapshots[name] = { pages };
      }
      const entries = [...values];
      for (let offset = 0; offset < entries.length; offset += 100) {
        const chunk = entries.slice(offset, offset + 100);
        const old = new Map(
          await AsyncStorage.multiGet(chunk.map(([recordKey]) => recordKey)),
        );
        await AsyncStorage.multiSet(
          chunk.filter(([recordKey, value]) => old.get(recordKey) !== value),
        );
      }
      const manifestKey = `${key}/manifest`;
      const previous = await AsyncStorage.getItem(manifestKey);
      const preservePrevious =
        previous &&
        (JSON.parse(previous) as Manifest).meta.resetId === meta.resetId;
      if (preservePrevious)
        await AsyncStorage.setItem(`${key}/previous-manifest`, previous);
      else await AsyncStorage.removeItem(`${key}/previous-manifest`);
      await AsyncStorage.setItem(manifestKey, JSON.stringify(manifest));
      // Keep the last committed version as a recovery point. Clean only unreferenced records.
      try {
        const retained = new Set(values.keys());
        if (preservePrevious) {
          const prior = JSON.parse(previous) as Manifest;
          for (const snapshot of Object.values(prior.snapshots)) {
            for (const page of snapshot.pages) retained.add(page);
            for (const record of await readPointers(key, snapshot))
              retained.add(record.key);
          }
        }
        const keys = await AsyncStorage.getAllKeys();
        const garbage = keys.filter(
          (entry) =>
            entry.startsWith(`${key}/records/`) && !retained.has(entry),
        );
        if (garbage.length) await AsyncStorage.multiRemove(garbage);
      } catch {
        /* Cleanup failure does not invalidate the committed data. */
      }
    });
  queues.set(key, job);
  try {
    await job;
  } finally {
    if (queues.get(key) === job) queues.delete(key);
  }
}

export async function readRecordStore(key: string): Promise<{
  snapshots: Record<string, Data>;
  meta: Record<string, unknown>;
} | null> {
  const raw = await AsyncStorage.getItem(`${key}/manifest`);
  if (!raw) return null;
  const manifest = JSON.parse(raw) as Manifest;
  if (manifest.version !== 2 || !manifest.snapshots || !manifest.meta)
    throw new Error("Armazenamento local incompatível.");
  const snapshots: Record<string, Data> = {};
  for (const [name, snapshot] of Object.entries(manifest.snapshots)) {
    const pointers = await readPointers(key, snapshot);
    const values = new Map<string, string | null>();
    for (let offset = 0; offset < pointers.length; offset += 100) {
      const chunk = pointers.slice(offset, offset + 100);
      const entries = await AsyncStorage.multiGet(
        chunk.map((record) => record.key),
      );
      for (const entry of entries) values.set(...entry);
    }
    snapshots[name] = restoreFinanceRecords(
      pointers.map((record) => {
        const value = values.get(record.key);
        if (!record.key.startsWith(`${key}/records/`) || !value)
          throw new Error(
            "Um registro local não foi encontrado. Restaure um backup.",
          );
        if (
          record.key !==
          `${key}/records/${bytesToHex(sha256(utf8ToBytes(record.path + "\n" + value)))}`
        )
          throw new Error("Um registro local está corrompido.");
        return { path: record.path, value: JSON.parse(value) };
      }),
    );
  }
  return { snapshots, meta: manifest.meta };
}

async function readPointers(
  key: string,
  snapshot: Snapshot,
): Promise<RecordPointer[]> {
  if (!Array.isArray(snapshot.pages)) throw new Error("Índice local inválido.");
  const pointers: RecordPointer[] = [];
  for (let offset = 0; offset < snapshot.pages.length; offset += 100) {
    const pages = snapshot.pages.slice(offset, offset + 100);
    const values = await AsyncStorage.multiGet(pages);
    for (const [pageKey, value] of values) {
      if (
        !value ||
        pageKey !==
          `${key}/records/page-${bytesToHex(sha256(utf8ToBytes(value)))}`
      )
        throw new Error("Página do índice local inválida.");
      const page = JSON.parse(value);
      if (
        !Array.isArray(page) ||
        page.some(
          (entry) =>
            typeof entry.path !== "string" || typeof entry.key !== "string",
        )
      )
        throw new Error("Referência local inválida.");
      pointers.push(...page);
    }
  }
  return pointers;
}

export async function removeRecordStore(key: string) {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter(
      (entry) =>
        entry === key ||
        entry === `${key}/manifest` ||
        entry === `${key}/previous-manifest` ||
        entry.startsWith(`${key}/records/`),
    ),
  );
}
