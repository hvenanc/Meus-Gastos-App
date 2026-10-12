import {
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import { type Data, initialData } from "./finance.ts";
import { decodeCloud, equalFinance, mergeFinance } from "./syncMerge.ts";
export async function pushFinance(
  ref: DocumentReference,
  base: Data,
  local: Data,
) {
  return runTransaction(ref.firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists()
      ? decodeCloud(snap.data())
      : { data: JSON.parse(JSON.stringify(initialData)) as Data, revision: 0 };
    const merged = mergeFinance(base, local, current.data);
    if (snap.exists() && equalFinance(merged, current.data)) return current;
    const payload = JSON.stringify(merged);
    const bytes = Array.from(payload).reduce((size, char) => {
      const point = char.codePointAt(0)!;
      return (
        size + (point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4)
      );
    }, 0);
    if (bytes > 900000)
      throw new Error(
        "O histórico excede o limite desta versão de sincronização (900 KB). Os dados locais foram preservados; exporte um backup.",
      );
    const revision = current.revision + 1;
    transaction.set(ref, {
      schemaVersion:
        merged.investmentAccess ||
        merged.investmentAccounts?.length ||
        merged.investmentMovements?.length
          ? 3
          : merged.resetId || merged.transactions.some((t) => t.refundOf)
            ? 2
            : 1,
      revision,
      payload,
      updatedAt: serverTimestamp(),
    });
    return { data: merged, revision };
  });
}

/** Explicit user reset replaces only their financial snapshot, even if this device was stale. */
export async function resetCloudFinance(
  ref: DocumentReference,
  data: Data,
  authorizedInvestmentHash?: string,
) {
  return runTransaction(ref.firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists() ? decodeCloud(snap.data()) : null;
    if (
      current?.data.investmentAccess &&
      current.data.investmentAccess.hash !== authorizedInvestmentHash
    )
      throw new Error(
        "O PIN de investimentos mudou na nuvem. Atualize os dados e desbloqueie novamente antes de zerar.",
      );
    const revision = (current?.revision ?? 0) + 1;
    transaction.set(ref, {
      schemaVersion: 2,
      revision,
      payload: JSON.stringify(data),
      updatedAt: serverTimestamp(),
    });
    return { data, revision };
  });
}
