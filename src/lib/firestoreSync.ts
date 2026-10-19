import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { type Data, initialData, uid, upgradeCategories } from "./finance.ts";
import { decodeCloud, equalFinance, mergeFinance, same } from "./syncMerge.ts";
import {
  financeRecords,
  recordCounts,
  recordFields,
  restoreFinanceRecords,
  type FinanceRecord,
} from "./financeRecords.ts";

type Head = {
  schemaVersion: 4;
  revision: number;
  generation: string;
  counts: Record<string, number>;
};
export type CloudFinance = { data: Data; revision: number };
class RevisionChanged extends Error {}
function decodeHead(value: unknown): Head {
  const head = value as Head;
  if (
    head?.schemaVersion !== 4 ||
    !Number.isSafeInteger(head.revision) ||
    head.revision < 1 ||
    typeof head.generation !== "string" ||
    !/^[\w-]+$/.test(head.generation) ||
    !head.counts ||
    !recordFields.every(
      (field) =>
        Number.isSafeInteger(head.counts[field]) && head.counts[field] >= 0,
    )
  )
    throw new Error("O índice do banco financeiro não é válido.");
  return head;
}
const generationRef = (ref: DocumentReference, generation: string) =>
  doc(ref.parent.parent!, "financeGenerations", generation);
async function removeGeneration(ref: DocumentReference, generation: string) {
  const root = generationRef(ref, generation);
  const groups = await Promise.all(
    ["profile", ...recordFields].map((field) =>
      getDocsFromServer(collection(root, field)),
    ),
  );
  const records = groups.flatMap((group) => group.docs);
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(ref.firestore);
    for (const record of records.slice(offset, offset + 400))
      batch.delete(record.ref);
    await batch.commit();
  }
}
/** Fence all queries with a revision check, never exposing half an update. */
export async function readCloudFinance(
  ref: DocumentReference,
): Promise<CloudFinance> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const snapshot = await getDocFromServer(ref);
    if (!snapshot.exists())
      return {
        data: upgradeCategories(JSON.parse(JSON.stringify(initialData))),
        revision: 0,
      };
    if (snapshot.data().schemaVersion !== 4)
      return decodeCloud(snapshot.data());
    const head = decodeHead(snapshot.data());
    const root = generationRef(ref, head.generation);
    const profile = await getDocFromServer(doc(root, "profile", "main"));
    const collections = await Promise.all(
      recordFields.map((field) => getDocsFromServer(collection(root, field))),
    );
    const after = await getDocFromServer(ref);
    if (
      !after.exists() ||
      after.data().revision !== head.revision ||
      after.data().generation !== head.generation
    )
      continue;
    const records: FinanceRecord[] = [];
    if (profile.exists())
      records.push({ path: "profile/main", value: profile.data() });
    recordFields.forEach((field, index) => {
      const docs = collections[index].docs;
      if (docs.length !== head.counts[field])
        throw new Error(
          "O banco financeiro está incompleto. Os dados locais foram preservados.",
        );
      for (const entry of docs)
        records.push({ path: `${field}/${entry.id}`, value: entry.data() });
    });
    return { data: restoreFinanceRecords(records), revision: head.revision };
  }
  throw new Error(
    "O banco está sendo atualizado em outro aparelho. Tente novamente.",
  );
}
async function stage(ref: DocumentReference, data: Data) {
  const generation = uid();
  const root = generationRef(ref, generation);
  const records = financeRecords(data);
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(ref.firestore);
    for (const record of records.slice(offset, offset + 400))
      batch.set(doc(root, record.path), record.value);
    await batch.commit();
  }
  return generation;
}
async function writeFinance(
  ref: DocumentReference,
  transform: (current: CloudFinance) => Data,
  forceNewGeneration = false,
): Promise<CloudFinance> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readCloudFinance(ref);
    const merged = transform(current);
    const observed = await getDocFromServer(ref);
    if ((observed.data()?.revision ?? 0) !== current.revision) continue;
    const normalized = observed.data()?.schemaVersion === 4;
    if (normalized && equalFinance(merged, current.data)) return current;
    const before = new Map(
      financeRecords(current.data).map((record) => [record.path, record.value]),
    );
    const next = new Map(
      financeRecords(merged).map((record) => [record.path, record.value]),
    );
    const changed = [...new Set([...before.keys(), ...next.keys()])].filter(
      (path) => !same(before.get(path), next.get(path)),
    );
    const useStage = !normalized || forceNewGeneration || changed.length > 400;
    const generation = useStage
      ? await stage(ref, merged)
      : decodeHead(observed.data()).generation;
    try {
      await runTransaction(ref.firestore, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if ((snapshot.data()?.revision ?? 0) !== current.revision)
          throw new RevisionChanged();
        if (snapshot.exists() && snapshot.data().schemaVersion !== 4)
          transaction.set(
            doc(
              ref.parent.parent!,
              "financeBackups",
              `legacy-${current.revision}`,
            ),
            snapshot.data(),
          );
        if (!useStage) {
          const root = generationRef(ref, generation);
          for (const path of changed) {
            const value = next.get(path);
            if (value) transaction.set(doc(root, path), value);
            else transaction.delete(doc(root, path));
          }
        }
        transaction.set(ref, {
          schemaVersion: 4,
          revision: current.revision + 1,
          generation,
          counts: recordCounts(merged),
          updatedAt: serverTimestamp(),
        });
      });
      if (useStage && normalized) {
        try {
          await removeGeneration(ref, decodeHead(observed.data()).generation);
        } catch {
          /* Active data is already committed; retrying a save must not duplicate it. */
        }
      }
      if (forceNewGeneration) {
        try {
          const backups = await getDocsFromServer(
            collection(ref.parent.parent!, "financeBackups"),
          );
          for (const backup of backups.docs) {
            const batch = writeBatch(ref.firestore);
            batch.delete(backup.ref);
            await batch.commit();
          }
        } catch {
          /* Cleanup failure does not invalidate the committed reset. */
        }
      }
      return { data: merged, revision: current.revision + 1 };
    } catch (error) {
      if (!(error instanceof RevisionChanged)) {
        // Rules can observe the competing commit before the SDK reports a stale transaction.
        // Retry permission errors only when the readable head proves a newer revision exists.
        if (
          (error as { code?: string }).code !== "permission-denied" ||
          ((await getDocFromServer(ref)).data()?.revision ?? 0) ===
            current.revision
        )
          throw error;
      }
      if (useStage) {
        try {
          await removeGeneration(ref, generation);
        } catch {
          /* Unpublished records can be cleaned on retry. */
        }
      }
      // Unpublished generations cannot affect the active database.
    }
  }
  throw new Error(
    "Muitas alterações simultâneas. Seus dados locais estão preservados; tente sincronizar novamente.",
  );
}
export const pushFinance = (ref: DocumentReference, base: Data, local: Data) =>
  writeFinance(ref, (current) => mergeFinance(base, local, current.data));
export const migrateCloudFinance = (ref: DocumentReference) =>
  writeFinance(ref, (current) => current.data);
export const resetCloudFinance = (
  ref: DocumentReference,
  data: Data,
  authorizedInvestmentHash?: string,
) =>
  writeFinance(
    ref,
    (current) => {
      if (
        current.data.investmentAccess &&
        current.data.investmentAccess.hash !== authorizedInvestmentHash
      )
        throw new Error(
          "O PIN de investimentos mudou na nuvem. Atualize os dados e desbloqueie novamente antes de zerar.",
        );
      return data;
    },
    true,
  );
