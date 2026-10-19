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
import {
  pushFinance,
  resetCloudFinance,
  readCloudFinance,
  migrateCloudFinance,
} from "../src/lib/firestoreSync.ts";
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
  assert.equal((await readCloudFinance(own)).data.name, "Alice");
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
  assert.equal(protectedSnapshot.data()!.schemaVersion, 4);
  assert.equal(protectedSnapshot.data()!.payload, undefined);
  const restored = (await readCloudFinance(own)).data;
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
  const { parseBankNotice, notificationTransaction, noticeHash } =
    await import("../src/lib/bankNotifications.ts");
  const notice = {
    id: noticeHash("emulated-notice"),
    packageName: "com.nu.production",
    title: "Pix recebido",
    text: "Você recebeu um Pix de R$ 20,00",
    postedAt: new Date(2026, 9, 13, 12).getTime(),
    context: "test:initial",
    accountId: "a",
    cardId: "",
  };
  const imported = notificationTransaction(
    restored,
    notice,
    parseBankNotice(notice)!,
  )!;
  const withNotice = {
    ...restored,
    transactions: [...restored.transactions, imported],
  };
  const written = await pushFinance(own, restored, withNotice);
  const again = await pushFinance(own, restored, withNotice);
  assert.equal(again.revision, written.revision);
  assert.equal(
    (await readCloudFinance(own)).data.transactions.filter(
      (t) => t.notificationImportId === notice.id,
    ).length,
    1,
  );
  console.log(
    "✓ transação importada da notificação é sincronizada sem duplicar reenvios",
  );

  assert.equal(restored.investmentAccounts![0].initialBalance, 20000);
  assert.equal(restored.investmentMovements![0].amount, 1000);
  assert.ok(restored.investmentAccess?.hash);
  assert.equal(protectedSnapshot.data()!.payload, undefined);
  await assert.rejects(() => getDocFromServer(doc(dbs[1], own.path)), {
    code: "permission-denied",
  });
  console.log(
    "✓ investimentos e verificador do PIN usam protocolo 4 e permanecem isolados por usuário",
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
  const accountRecord = doc(
    own.parent.parent!,
    "financeGenerations",
    protectedSnapshot.data()!.generation,
    "profile",
    "main",
  );
  await assert.rejects(
    () => getDocFromServer(doc(dbs[1], accountRecord.path)),
    { code: "permission-denied" },
  );
  await assert.rejects(
    () =>
      setDoc(own, {
        schemaVersion: 1,
        revision: cleared.revision + 1,
        payload: JSON.stringify(base),
        updatedAt: serverTimestamp(),
      }),
    { code: "permission-denied" },
  );
  console.log(
    "✓ registros separados são privados e clientes antigos não podem reverter a migração",
  );
  const legacyUser = await createUserWithEmailAndPassword(
    auths[0],
    `legacy-${Date.now()}@test.local`,
    "Test-only-123!",
  );
  const legacyRef = doc(
    dbs[0],
    "users",
    legacyUser.user.uid,
    "finance",
    "state",
  );
  const legacyData = structuredClone(initialData);
  legacyData.name = "Legado";
  legacyData.accounts = [
    {
      id: "legacy",
      name: "Conta antiga",
      bank: "other",
      initialBalance: 12345,
    },
  ];
  await setDoc(legacyRef, {
    schemaVersion: 1,
    revision: 1,
    payload: JSON.stringify(legacyData),
    updatedAt: serverTimestamp(),
  });
  const migrated = await migrateCloudFinance(legacyRef);
  assert.equal(migrated.revision, 2);
  assert.equal(migrated.data.accounts[0].initialBalance, 12345);
  assert.equal((await getDocFromServer(legacyRef)).data()!.payload, undefined);
  assert(
    (
      await getDocFromServer(
        doc(legacyRef.parent.parent!, "financeBackups", "legacy-1"),
      )
    ).exists(),
  );
  assert.deepEqual((await readCloudFinance(legacyRef)).data, migrated.data);
  console.log(
    "✓ migração preserva valores, separa registros e guarda recuperação do legado",
  );
  const large = structuredClone(migrated.data);
  large.transactions = Array.from({ length: 410 }, (_, index) => ({
    id: `large-${index}`,
    title: "Histórico",
    type: "expense" as const,
    amount: 100,
    date: "2026-10-16",
    categoryId: "food",
    accountId: "legacy",
    paid: false,
    note: "a".repeat(3000),
  }));
  const big = await pushFinance(legacyRef, migrated.data, large);
  assert.equal(
    (await readCloudFinance(legacyRef)).data.transactions.length,
    410,
  );
  assert.equal((await getDocFromServer(legacyRef)).data()!.payload, undefined);
  console.log(
    "✓ histórico acima de 900 KB e mais de 400 registros é publicado sem snapshot parcial",
  );
  const activeHead = (await getDocFromServer(legacyRef)).data()!;
  const activeRecord = doc(
    legacyRef.parent.parent!,
    "financeGenerations",
    activeHead.generation,
    "accounts",
    "id-legacy",
  );
  await assert.rejects(
    () =>
      setDoc(activeRecord, {
        ...large.accounts[0],
        _position: 0,
        name: "Sem revisão",
      }),
    { code: "permission-denied" },
  );
  const edited = structuredClone(big.data);
  edited.accounts[0].name = "Atualizada";
  const updated = await pushFinance(legacyRef, big.data, edited);
  assert.equal(
    (await getDocFromServer(legacyRef)).data()!.generation,
    activeHead.generation,
  );
  assert.equal(updated.data.accounts[0].name, "Atualizada");
  console.log(
    "✓ alteração normal atualiza documentos individuais e exige revisão coordenada",
  );
  const raceA = structuredClone(updated.data),
    raceB = structuredClone(updated.data);
  raceA.accounts.push({
    id: "race-a",
    name: "A",
    bank: "other",
    initialBalance: 0,
  });
  raceB.accounts.push({
    id: "race-b",
    name: "B",
    bank: "other",
    initialBalance: 0,
  });
  await Promise.all([
    pushFinance(legacyRef, updated.data, raceA),
    pushFinance(legacyRef, updated.data, raceB),
  ]);
  const afterRace = await readCloudFinance(legacyRef);
  assert.equal(afterRace.data.accounts.length, 3);
  const deleted = structuredClone(afterRace.data);
  const removedId = deleted.transactions.pop()!.id;
  const afterDelete = await pushFinance(legacyRef, afterRace.data, deleted);
  assert.equal(
    (await readCloudFinance(legacyRef)).data.transactions.length,
    409,
  );
  const deleteHead = (await getDocFromServer(legacyRef)).data()!;
  assert(
    !(
      await getDocFromServer(
        doc(
          legacyRef.parent.parent!,
          "financeGenerations",
          deleteHead.generation,
          "transactions",
          `id-${encodeURIComponent(removedId)}`,
        ),
      )
    ).exists(),
  );
  assert.equal(afterDelete.data.accounts.length, 3);
  console.log(
    "✓ gravações concorrentes preservam registros distintos e exclusões removem os documentos corretos",
  );
} finally {
  await Promise.all(dbs.map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
}
