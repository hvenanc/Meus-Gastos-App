import { strict as assert } from "node:assert";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  terminate,
} from "firebase/firestore";
import {
  initialData,
  resetFinance,
  makeRecurringExpenses,
} from "../src/lib/finance.ts";
import { pushFinance, resetCloudFinance } from "../src/lib/firestoreSync.ts";
import { SyncConflict, decodeCloud } from "../src/lib/syncMerge.ts";
const apps = ["alice", "bob", "guest"].map((name) =>
  initializeApp(
    {
      apiKey: "demo-key",
      projectId: "demo-meus-gastos",
      appId: `demo-${name}`,
    },
    name,
  ),
);
const auths = apps.map((app) => {
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  return auth;
});
const dbs = apps.map((app) => {
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8086);
  return db;
});
try {
  const alice = await createUserWithEmailAndPassword(
    auths[0],
    `alice-${Date.now()}@test.local`,
    "Test-only-123!",
  );
  await createUserWithEmailAndPassword(
    auths[1],
    `bob-${Date.now()}@test.local`,
    "Test-only-123!",
  );
  const own = doc(dbs[0], "users", alice.user.uid, "finance", "state");
  const base = structuredClone(initialData),
    local = structuredClone(base);
  local.name = "Alice";
  let confirmed = await pushFinance(own, base, local);
  assert.equal(confirmed.revision, 1);
  assert.equal(
    decodeCloud((await getDocFromServer(own)).data()).data.name,
    "Alice",
  );
  console.log("✓ dados financeiros são gravados e lidos pelo proprietário");
  await assert.rejects(() => getDocFromServer(doc(dbs[1], own.path)), {
    code: "permission-denied",
  });
  await assert.rejects(() => getDocFromServer(doc(dbs[2], own.path)), {
    code: "permission-denied",
  });
  await assert.rejects(() => pushFinance(doc(dbs[1], own.path), base, local), {
    code: "permission-denied",
  });
  console.log("✓ outro usuário e visitante não podem ler/gravar os dados");
  await assert.rejects(
    () =>
      setDoc(own, {
        schemaVersion: 1,
        revision: 99,
        payload: "{}",
        updatedAt: serverTimestamp(),
      }),
    { code: "permission-denied" },
  );
  console.log("✓ revisão incorreta é rejeitada pelas regras");
  const a = structuredClone(confirmed.data),
    b = structuredClone(confirmed.data),
    origin = structuredClone(confirmed.data);
  a.accounts.push({
    id: "a",
    name: "Conta A",
    bank: "other",
    initialBalance: 100,
  });
  b.accounts.push({
    id: "b",
    name: "Conta B",
    bank: "itau",
    initialBalance: 200,
  });
  await pushFinance(own, origin, a);
  confirmed = await pushFinance(own, origin, b);
  assert.equal(confirmed.data.accounts.length, 2);
  console.log("✓ alterações em registros diferentes são mescladas no servidor");
  const previous = structuredClone(confirmed.data),
    edit1 = structuredClone(previous),
    edit2 = structuredClone(previous);
  edit1.name = "Nome 1";
  edit2.name = "Nome 2";
  await pushFinance(own, previous, edit1);
  await assert.rejects(() => pushFinance(own, previous, edit2), SyncConflict);
  console.log("✓ conflito no mesmo registro preserva a versão confirmada");
  const resent = await pushFinance(own, previous, edit1);
  assert.equal(resent.revision, 4);
  console.log("✓ reenvio não duplica dados ou incrementa a revisão");
  const investBase = structuredClone(resent.data),
    invested = structuredClone(investBase);
  invested.categories.push({
    id: "custom-icon",
    name: "Internet",
    icon: "wifi-outline",
    color: "#123456",
    type: "expense",
  });
  invested.transactions = makeRecurringExpenses(
    {
      id: "recurring",
      title: "Internet",
      type: "expense",
      amount: 5000,
      date: "2026-11-01",
      categoryId: "custom-icon",
      accountId: "a",
      paid: false,
    },
    3,
  );
  invested.investmentAccounts = [
    { id: "investment", name: "CDB", bank: "other", initialBalance: 20000 },
  ];
  invested.investmentMovements = [
    {
      id: "yield",
      accountId: "investment",
      type: "yield",
      amount: 1000,
      date: "2026-10-12",
      note: "",
    },
  ];
  const { createInvestmentAccess } =
    await import("../src/lib/investmentPin.ts");
  invested.investmentAccess = await createInvestmentAccess(
    "1234",
    new Uint8Array(16).fill(8),
  );
  await pushFinance(own, investBase, invested);
  const protectedSnapshot = await getDocFromServer(own);
  assert.equal(protectedSnapshot.data()!.schemaVersion, 3);
  const restored = decodeCloud(protectedSnapshot.data()).data;
  assert.equal(
    restored.categories.find((c) => c.id === "custom-icon")!.icon,
    "wifi-outline",
  );
  assert.equal(restored.transactions.length, 3);
  assert.equal(restored.transactions[2].recurrenceIndex, 3);
  assert.equal(restored.transactions[2].date, "2027-01-01");
  console.log(
    "✓ despesas fixas e ícone personalizado são recuperados do Firestore",
  );
  assert.equal(restored.investmentAccounts![0].initialBalance, 20000);
  assert.equal(restored.investmentMovements![0].amount, 1000);
  assert.ok(restored.investmentAccess?.hash);
  assert.ok(!protectedSnapshot.data()!.payload.includes('"pin":"1234"'));
  await assert.rejects(() => getDocFromServer(doc(dbs[1], own.path)), {
    code: "permission-denied",
  });
  console.log(
    "✓ investimentos e verificador do PIN usam protocolo 3 e permanecem isolados por usuário",
  );
  await assert.rejects(
    () => resetCloudFinance(own, resetFinance(restored), "wrong"),
    /PIN de investimentos mudou/,
  );
  const cleared = await resetCloudFinance(
    own,
    resetFinance(restored),
    restored.investmentAccess!.hash,
  );
  assert.equal(cleared.data.investmentAccounts?.length, 0);
  assert.equal(cleared.data.investmentAccess, undefined);
  console.log(
    "✓ limpeza exige a credencial de investimento que foi autorizada e ainda é atual",
  );
} finally {
  await Promise.all(dbs.map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
}
