import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "firebase/app";
import {
  doc,
  getFirestore,
  onSnapshot,
  type DocumentReference,
} from "firebase/firestore";
import {
  type Data,
  initialData,
  validateData,
  upgradeCategories,
  resetFinance,
} from "./finance";
import { loadData } from "./storage";
import { storageKey } from "./storageKey";
import {
  decodeCloud,
  equalFinance,
  mergeFinance,
  SyncConflict,
} from "./syncMerge";
import { pushFinance, resetCloudFinance } from "./firestoreSync";
export type SyncStatus =
  | "local"
  | "connecting"
  | "pending"
  | "syncing"
  | "synced"
  | "error"
  | "conflict";
type Cache = {
  version: 1;
  data: Data;
  base: Data;
  revision: number;
  pending: boolean;
};
export const syncMessage = (error: unknown) => {
  if (error instanceof SyncConflict) return error.message;
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("permission-denied"))
    return "Acesso ao Firestore negado. Confira as regras de acesso do projeto Firebase.";
  if (code.includes("unavailable") || code.includes("deadline-exceeded"))
    return "Sem conexão com o Firebase. Seus dados estão salvos neste aparelho e serão sincronizados quando a conexão voltar.";
  if (code.includes("not-found") || code.includes("failed-precondition"))
    return "Ative o Cloud Firestore no projeto Firebase para sincronizar seus dados.";
  return error instanceof Error
    ? error.message
    : "Não foi possível sincronizar com o Firebase. Seus dados locais estão preservados.";
};
/** Durable local outbox plus Firestore transactions; one atomic snapshot per user's finances. */
export class FinanceSync {
  private cache!: Cache;
  private ref!: DocumentReference;
  private queue: Promise<unknown> = Promise.resolve();
  private active = true;
  private flushing = false;
  private resetting = false;
  private remote: { data: Data; revision: number } | null = null;
  private stopSnapshot?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private key: string;
  private userId: string;
  private onData: (data: Data) => void;
  private onStatus: (status: SyncStatus, message?: string) => void;
  private displayName?: string;
  constructor(
    userId: string,
    onData: (data: Data) => void,
    onStatus: (status: SyncStatus, message?: string) => void,
    displayName?: string,
  ) {
    this.userId = userId;
    this.onData = onData;
    this.onStatus = onStatus;
    this.displayName = displayName;
    this.key = `${storageKey(userId)}/cloud-v1`;
  }
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const job = this.queue.then(task);
    this.queue = job.catch(() => {});
    return job;
  }
  private async persist(next: Cache) {
    await AsyncStorage.setItem(this.key, JSON.stringify(next));
    this.cache = next;
    if (this.active) this.onData(next.data);
  }
  async start() {
    const raw = await AsyncStorage.getItem(this.key);
    if (raw) {
      const cache = JSON.parse(raw) as Cache;
      if (
        cache.version !== 1 ||
        !validateData(cache.data) ||
        !validateData(cache.base) ||
        !Number.isSafeInteger(cache.revision) ||
        cache.revision < 0 ||
        typeof cache.pending !== "boolean"
      )
        throw new Error(
          "A cópia local de sincronização não é válida. Restaure um backup.",
        );
      this.cache = {
        ...cache,
        data: upgradeCategories(cache.data),
        base: upgradeCategories(cache.base),
      };
    } else {
      const cached = await loadData(this.userId);
      this.cache = {
        version: 1,
        data: cached,
        base: upgradeCategories(JSON.parse(JSON.stringify(initialData))),
        revision: 0,
        pending: !equalFinance(cached, upgradeCategories(initialData)),
      };
      await this.persist(this.cache);
    }
    // Older versions queued the auth display name on an empty installation.
    // Repair only that synthetic change; preserve every real offline edit.
    if (
      this.cache.revision === 0 &&
      this.cache.pending &&
      this.cache.data.name === this.displayName &&
      equalFinance(
        { ...this.cache.data, name: this.cache.base.name },
        this.cache.base,
      )
    ) {
      await this.persist({ ...this.cache, pending: false });
    }
    if (!this.active) return;
    this.onData(this.cache.data);
    this.onStatus(this.cache.pending ? "pending" : "connecting");
    this.ref = doc(
      getFirestore(getApp()),
      "users",
      this.userId,
      "finance",
      "state",
    );
    this.watch();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.retry(), 20000);
    if (this.cache.pending) this.flush();
  }
  private watch() {
    this.stopSnapshot?.();
    this.stopSnapshot = onSnapshot(
      this.ref,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          !this.active ||
          snapshot.metadata.hasPendingWrites ||
          snapshot.metadata.fromCache
        )
          return;
        try {
          this.remote = snapshot.exists()
            ? decodeCloud(snapshot.data())
            : { data: JSON.parse(JSON.stringify(initialData)), revision: 0 };
          if (!this.flushing)
            void this.enqueue(async () => {
              if (
                !this.active ||
                !this.remote ||
                this.remote.revision < this.cache.revision
              )
                return;
              if (this.cache.pending) {
                this.flush();
                return;
              }
              // Seed a new user's profile only after the server confirms that
              // no saved document exists. Existing users always adopt the cloud.
              if (this.remote.revision === 0) {
                await this.persist({
                  ...this.cache,
                  data: {
                    ...this.remote.data,
                    name: this.displayName || this.remote.data.name,
                  },
                  base: this.remote.data,
                  pending: true,
                });
                this.flush();
                return;
              }
              await this.persist({
                ...this.cache,
                data: this.remote.data,
                base: this.remote.data,
                revision: this.remote.revision,
              });
              this.onStatus("synced");
            }).catch((error) => this.onStatus("error", syncMessage(error)));
        } catch (error) {
          this.onStatus("error", syncMessage(error));
        }
      },
      (error) => {
        this.stopSnapshot = undefined;
        if (this.active) this.onStatus("error", syncMessage(error));
      },
    );
  }
  async save(data: Data, previous = this.cache?.data) {
    if (this.resetting) throw new Error("Aguarde a limpeza dos dados.");
    if (!validateData(data)) throw new Error("Os dados não são válidos.");
    await this.enqueue(async () => {
      if (!this.cache) {
        const damaged = await AsyncStorage.getItem(this.key);
        if (damaged)
          await AsyncStorage.setItem(`${this.key}/damaged-backup`, damaged);
      }
      await this.persist({
        ...(this.cache ?? {
          version: 1,
          base: JSON.parse(JSON.stringify(initialData)),
          revision: 0,
        }),
        data:
          previous && this.cache
            ? mergeFinance(previous, upgradeCategories(data), this.cache.data)
            : upgradeCategories(data),
        pending: true,
      });
    });
    if (!this.ref && this.active) await this.start();
    if (this.active) {
      this.onStatus("pending");
      this.flush();
    }
  }
  private async flush() {
    if (
      !this.active ||
      this.flushing ||
      this.resetting ||
      !this.ref ||
      !this.cache.pending
    )
      return;
    this.flushing = true;
    const sent = this.cache;
    this.onStatus("syncing");
    try {
      const confirmed = await pushFinance(this.ref, sent.base, sent.data);
      await this.enqueue(async () => {
        // Preserve edits made locally while the request was in flight.
        const data = mergeFinance(sent.data, this.cache.data, confirmed.data);
        await this.persist({
          version: 1,
          data,
          base: confirmed.data,
          revision: confirmed.revision,
          pending: !equalFinance(data, confirmed.data),
        });
      });
      if (this.active) this.onStatus(this.cache.pending ? "pending" : "synced");
    } catch (error) {
      if (this.active)
        this.onStatus(
          error instanceof SyncConflict ? "conflict" : "error",
          syncMessage(error),
        );
    } finally {
      this.flushing = false;
    }
    if (
      this.active &&
      this.cache.pending &&
      !equalFinance(sent.data, this.cache.data)
    )
      this.flush();
    else if (
      this.active &&
      !this.cache.pending &&
      this.remote &&
      this.remote.revision > this.cache.revision
    ) {
      const remote = this.remote;
      void this.enqueue(() =>
        this.persist({
          ...this.cache,
          data: remote.data,
          base: remote.data,
          revision: remote.revision,
        }),
      ).catch((error) => this.onStatus("error", syncMessage(error)));
    }
  }
  retry() {
    if (!this.active || !this.ref || this.flushing || this.resetting) return;
    if (!this.stopSnapshot) this.watch();
    if (this.cache.pending) this.flush();
  }
  async resetAll(authorizedInvestmentHash?: string) {
    if (!this.ref || this.flushing || this.resetting)
      throw new Error("Aguarde a sincronização terminar e tente novamente.");
    this.resetting = true;
    this.stopSnapshot?.();
    this.stopSnapshot = undefined;
    try {
      await this.queue;
      const confirmed = await resetCloudFinance(
        this.ref,
        resetFinance(this.cache.data),
        authorizedInvestmentHash,
      );
      await this.enqueue(async () => {
        await this.persist({
          version: 1,
          data: confirmed.data,
          base: confirmed.data,
          revision: confirmed.revision,
          pending: false,
        });
        await AsyncStorage.multiRemove([
          storageKey(this.userId),
          `${this.key}/conflict-backup`,
          `${this.key}/damaged-backup`,
        ]);
      });
      this.remote = confirmed;
      this.onStatus("synced");
    } finally {
      this.resetting = false;
      if (this.active) this.watch();
    }
  }
  async useCloudVersion() {
    if (!this.remote || this.flushing)
      throw new Error("Aguarde a conexão com o Firebase e tente novamente.");
    const remote = this.remote;
    await this.enqueue(async () => {
      await AsyncStorage.setItem(
        `${this.key}/conflict-backup`,
        JSON.stringify(this.cache.data),
      );
      await this.persist({
        version: 1,
        data: remote.data,
        base: remote.data,
        revision: remote.revision,
        pending: false,
      });
      this.onStatus("synced");
    });
  }
  stop() {
    this.active = false;
    this.stopSnapshot?.();
    if (this.timer) clearInterval(this.timer);
  }
}
