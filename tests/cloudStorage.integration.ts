import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  disableNetwork,
  enableNetwork,
  terminate,
  doc,
  getDocFromServer,
} from "firebase/firestore";
import { persisted } from "./helpers/asyncStorageStub.mjs";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@react-native-async-storage/async-storage")
      return nextResolve(
        new URL("./helpers/asyncStorageStub.mjs", import.meta.url).href,
        context,
      );
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const url = new URL(specifier, context.parentURL);
      if (
        !url.pathname.endsWith(".ts") &&
        existsSync(fileURLToPath(url) + ".ts")
      )
        return nextResolve(url.href + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});
const { readRecordStore } = await import("../src/lib/recordStorage.ts");
const { readCloudFinance } = await import("../src/lib/firestoreSync.ts");
const { FinanceSync } = await import("../src/lib/cloudStorage.ts");
const app = initializeApp({
  apiKey: "demo-key",
  projectId: "demo-meus-gastos",
  appId: "demo-outbox",
});
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8086);
const { storageKey } = await import("../src/lib/storageKey.ts");
let service: InstanceType<typeof FinanceSync> | undefined;
async function waitFor(predicate: () => boolean) {
  const end = Date.now() + 15000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("Timeout no teste de sincronização");
    await new Promise((r) => setTimeout(r, 50));
  }
}
try {
  const alice = await createUserWithEmailAndPassword(
    auth,
    `outbox-${Date.now()}@test.local`,
    "Test-only-123!",
  );
  let data: any,
    status = "";
  service = new FinanceSync(
    alice.user.uid,
    (d) => {
      data = d;
    },
    (s) => {
      status = s;
    },
    "Alice",
  );
  await service.start();
  await waitFor(() => status === "synced");
  await disableNetwork(db);
  const edited = structuredClone(data);
  edited.accounts.push({
    id: "offline-account",
    name: "Offline",
    bank: "other",
    initialBalance: 123456,
  });
  await service.save(edited);
  const cache = (await readRecordStore(
    `${storageKey(alice.user.uid)}/cloud-v1`,
  ))!;
  assert.equal(cache.meta.pending, true);
  assert.equal(cache.snapshots.data.accounts[0].initialBalance, 123456);
  console.log(
    "✓ mudança offline é salva na fila local antes de qualquer resposta do servidor",
  );
  service.stop();
  status = "";
  await enableNetwork(db);
  service = new FinanceSync(
    alice.user.uid,
    (d) => {
      data = d;
    },
    (s) => {
      status = s;
    },
  );
  await service.start();
  await waitFor(() => status === "synced");
  assert.equal(data.accounts[0].id, "offline-account");
  assert.equal(
    (await readRecordStore(`${storageKey(alice.user.uid)}/cloud-v1`))!.meta
      .pending,
    false,
  );
  console.log(
    "✓ reinício recupera alterações pendentes e confirma o envio ao Firestore",
  );
  const first = structuredClone(data);
  first.accounts[0].name = "Primeira";
  await service.save(first);
  const second = structuredClone(first);
  second.accounts[0].name = "Segunda";
  await service.save(second);
  await waitFor(() => status === "synced");
  assert.equal(data.accounts[0].name, "Segunda");
  console.log("✓ alteração feita durante envio não é perdida");
  const staleView = structuredClone(data);
  const remoteEdit = structuredClone(data);
  remoteEdit.accounts.push({
    id: "remote-later",
    name: "Remota",
    bank: "itau",
    initialBalance: 100,
  });
  await service.save(remoteEdit);
  await waitFor(() => status === "synced");
  const editedStale = structuredClone(staleView);
  editedStale.accounts[0].name = "Formulário anterior";
  await service.save(editedStale, staleView);
  await waitFor(() => status === "synced");
  assert.ok(
    data.accounts.some(
      (account: { id: string }) => account.id === "remote-later",
    ),
  );
  assert.equal(data.accounts[0].name, "Formulário anterior");
  console.log(
    "✓ formulário aberto antes de atualização remota preserva novos registros",
  );

  const customProfile = structuredClone(data);
  customProfile.name = "Nome personalizado";
  await service.save(customProfile);
  await waitFor(() => status === "synced");
  async function reinstall(legacyNameOnly = false) {
    service!.stop();
    const ref = doc(db, "users", alice.user.uid, "finance", "state");
    const before = (await getDocFromServer(ref)).data()!;
    const beforeData = (await readCloudFinance(ref)).data;
    const key = `${storageKey(alice.user.uid)}/cloud-v1`;
    for (const stored of persisted.keys())
      if (stored.startsWith(key)) persisted.delete(stored);
    if (legacyNameOnly) {
      const { initialData, upgradeCategories } =
        await import("../src/lib/finance.ts");
      const base = upgradeCategories(structuredClone(initialData));
      persisted.set(
        key,
        JSON.stringify({
          version: 1,
          base,
          data: { ...base, name: "Alice" },
          revision: 0,
          pending: true,
        }),
      );
    }
    status = "";
    service = new FinanceSync(
      alice.user.uid,
      (d) => {
        data = d;
      },
      (s) => {
        status = s;
      },
      "Alice",
    );
    await service.start();
    await waitFor(() => status === "synced");
    assert.deepEqual(data, beforeData);
    assert.equal(
      (await getDocFromServer(ref)).data()!.revision,
      before.revision,
    );
  }
  await reinstall();
  console.log(
    "✓ instalação nova recupera a mesma conta e nome personalizado sem escrever na nuvem",
  );
  await reinstall(true);
  console.log(
    "✓ cache antigo com apenas nome de autenticação recupera dados sem conflito",
  );

  await service.resetAll();
  assert.equal(data.accounts.length, 0);
  assert.equal(data.transactions.length, 0);
  assert.ok(data.resetId);
  assert.equal(
    (await readRecordStore(`${storageKey(alice.user.uid)}/cloud-v1`))!.meta
      .pending,
    false,
  );
  console.log(
    "✓ limpeza substitui o snapshot Firebase e cache somente do usuário atual",
  );
  const afterReset = structuredClone(data);
  afterReset.accounts.push({
    id: "after-reset",
    name: "Após limpeza",
    bank: "other",
    initialBalance: 500,
  });
  await service.save(afterReset);
  await waitFor(() => status === "synced");
  await reinstall();
  assert.equal(data.accounts[0].id, "after-reset");
  console.log(
    "✓ outro aparelho recupera dados criados depois de uma limpeza do banco",
  );
  service.stop();
  const bob = await createUserWithEmailAndPassword(
    auth,
    `outbox-bob-${Date.now()}@test.local`,
    "Test-only-123!",
  );
  status = "";
  service = new FinanceSync(
    bob.user.uid,
    (d) => {
      data = d;
    },
    (s) => {
      status = s;
    },
    "Bob",
  );
  await service.start();
  await waitFor(() => status === "synced");
  assert.equal(data.accounts.length, 0);
  assert.equal(data.name, "Bob");
  console.log("✓ troca de usuário preserva isolamento dos caches e dados");
} finally {
  service?.stop();
  await terminate(db);
  await deleteApp(app);
}
