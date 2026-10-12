import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  accountBalance,
  totals,
  validateData,
  resetFinance,
  upgradeCategories,
} from "../src/lib/finance.ts";
import {
  investmentBalance,
  investmentValidationError,
} from "../src/lib/investments.ts";
import {
  createInvestmentAccess,
  verifyInvestmentPin,
  validPin,
  failedPinAttempt,
  pinBlocked,
  parsePinAttempts,
} from "../src/lib/investmentPin.ts";
import {
  mergeFinance,
  SyncConflict,
  decodeCloud,
} from "../src/lib/syncMerge.ts";
const fixture = () => {
  const d = structuredClone(initialData);
  d.accounts = [
    { id: "cash", name: "Conta", bank: "other", initialBalance: 100000 },
  ];
  d.investmentAccounts = [
    { id: "cash", name: "CDB", bank: "other", initialBalance: 50000 },
  ];
  d.investmentMovements = [
    {
      id: "deposit",
      accountId: "cash",
      type: "contribution",
      amount: 10000,
      date: "2026-10-01",
      note: "",
    },
    {
      id: "yield",
      accountId: "cash",
      type: "yield",
      amount: 1000,
      date: "2026-10-02",
      note: "",
    },
    {
      id: "out",
      accountId: "cash",
      type: "withdrawal",
      amount: 5000,
      date: "2026-10-03",
      note: "",
    },
  ];
  return d;
};
test("saldo de investimentos e rendimentos não alteram conta comum nem resumo mensal", () => {
  const d = fixture();
  assert.equal(investmentBalance(d, "cash"), 56000);
  assert.equal(accountBalance(d, "cash"), 100000);
  assert.deepEqual(totals(d, "2026-10"), { income: 0, expense: 0 });
  assert.ok(validateData(d));
});
test("retirada, perda e edição com saldo negativo ou vínculo inválido são rejeitadas", () => {
  const d = fixture();
  d.investmentMovements![2].amount = 70000;
  assert.ok(investmentValidationError(d));
  assert.equal(validateData(d), false);
  d.investmentMovements![2].amount = 5000;
  d.investmentMovements![2].accountId = "invalid";
  assert.equal(validateData(d), false);
});
test("data retroativa deve respeitar o saldo disponível antes do aporte", () => {
  const d = fixture();
  d.investmentMovements![2].date = "2026-09-01";
  d.investmentMovements![2].amount = 55000;
  assert.equal(validateData(d), false);
});
test("backups antigos recebem listas vazias; limpar inclui investimentos", () => {
  const d = fixture();
  delete d.investmentAccounts;
  delete d.investmentMovements;
  assert.ok(validateData(d));
  assert.deepEqual(upgradeCategories(d).investmentAccounts, []);
  const cleared = resetFinance(fixture());
  assert.deepEqual(cleared.investmentAccounts, []);
  assert.deepEqual(cleared.investmentMovements, []);
  assert.equal(cleared.investmentAccess, undefined);
});
test("retiradas concorrentes em aparelhos diferentes não geram saldo negativo", () => {
  const base = fixture(),
    a = structuredClone(base),
    b = structuredClone(base);
  a.investmentMovements!.push({
    id: "a",
    accountId: "cash",
    type: "withdrawal",
    amount: 40000,
    date: "2026-10-04",
    note: "",
  });
  b.investmentMovements!.push({
    id: "b",
    accountId: "cash",
    type: "withdrawal",
    amount: 40000,
    date: "2026-10-04",
    note: "",
  });
  assert.ok(validateData(a));
  assert.ok(validateData(b));
  assert.throws(() => mergeFinance(base, a, b), SyncConflict);
});
test("PIN usa quatro dígitos, salt e derivação; acerto e erro são distinguidos", async () => {
  assert.ok(validPin("0123"));
  assert.ok(!validPin("123"));
  assert.ok(!validPin("12345"));
  assert.ok(!validPin("abcd"));
  const salt = Uint8Array.from({ length: 16 }, (_, i) => i);
  const access = await createInvestmentAccess("0123", salt);
  assert.notEqual(access.hash, "0123");
  assert.equal(await verifyInvestmentPin("0123", access), true);
  assert.equal(await verifyInvestmentPin("1234", access), false);
  const other = await createInvestmentAccess(
    "0123",
    new Uint8Array(16).fill(9),
  );
  assert.notEqual(access.hash, other.hash);
  const data = fixture();
  data.investmentAccess = access;
  assert.ok(validateData(data));
  assert.ok(
    decodeCloud({
      schemaVersion: 3,
      revision: 1,
      payload: JSON.stringify(data),
    }).data.investmentAccess,
  );
});
test("tentativas ficam bloqueadas por tempo crescente e estado inválido não desbloqueia", () => {
  let a = { failures: 0, blockedUntil: 0 };
  for (let i = 0; i < 5; i++) a = failedPinAttempt(a, 1000);
  assert.equal(a.blockedUntil, 61000);
  assert.ok(pinBlocked(a, 2000));
  assert.ok(!pinBlocked(a, 61000));
  for (let i = 0; i < 5; i++) a = failedPinAttempt(a, 70000);
  assert.equal(a.blockedUntil, 190000);
  assert.throws(() => parsePinAttempts('{"failures":-1,"blockedUntil":0}'));
  assert.deepEqual(parsePinAttempts(null), { failures: 0, blockedUntil: 0 });
});
test("troca de PIN concorrente não sobrescreve credencial remotamente", async () => {
  const d = fixture(),
    a = structuredClone(d),
    b = structuredClone(d);
  a.investmentAccess = await createInvestmentAccess("1234", new Uint8Array(16));
  b.investmentAccess = await createInvestmentAccess(
    "5678",
    new Uint8Array(16).fill(1),
  );
  assert.throws(() => mergeFinance(d, a, b), SyncConflict);
});

test("coleções e metadados de investimentos inválidos não passam pelo backup", () => {
  const d = fixture();
  assert.equal(validateData({ ...d, investmentAccounts: null }), false);
  assert.equal(validateData({ ...d, investmentMovements: null }), false);
  assert.equal(
    validateData({
      ...d,
      investmentAccess: {
        version: 1,
        salt: "bad",
        hash: "bad",
        iterations: 100000,
      },
    }),
    false,
  );
});

test("data de cadastro é preservada, inferida de identificadores antigos e validada", async () => {
  const { investmentAccountCreatedDate } =
    await import("../src/lib/investments.ts");
  const timestamp = new Date(2026, 9, 3, 12).getTime();
  const oldAccount = {
    id: `${timestamp.toString(36)}-abc123`,
    name: "Antiga",
    bank: "other",
    initialBalance: 0,
  };
  assert.equal(investmentAccountCreatedDate(oldAccount), "2026-10-03");
  assert.equal(
    investmentAccountCreatedDate({ ...oldAccount, createdAt: "2026-10-01" }),
    "2026-10-01",
  );
  assert.equal(
    investmentAccountCreatedDate({ ...oldAccount, id: "legacy-id" }),
    undefined,
  );
  const d = fixture();
  d.investmentAccounts![0].createdAt = "2026-02-30";
  assert.equal(validateData(d), false);
  d.investmentAccounts![0].createdAt = "2026-10-03";
  const restored = decodeCloud({
    schemaVersion: 3,
    revision: 1,
    payload: JSON.stringify(d),
  }).data;
  assert.equal(restored.investmentAccounts![0].createdAt, "2026-10-03");
});

test("PBKDF2 nativo mantém compatibilidade com PINs existentes e zeros iniciais", async () => {
  const { pbkdf2 } = await import("node:crypto");
  const nativeEquivalent = (pin: string, salt: Uint8Array) =>
    new Promise<Uint8Array>((resolve, reject) => {
      pbkdf2(pin, salt, 100000, 32, "sha256", (error, key) =>
        error ? reject(error) : resolve(new Uint8Array(key)),
      );
    });
  const salt = Uint8Array.from({ length: 16 }, (_, i) => i);
  const original = await createInvestmentAccess("0123", salt);
  const optimized = await createInvestmentAccess(
    "0123",
    salt,
    nativeEquivalent,
  );
  assert.deepEqual(optimized, original);
  assert.equal(
    await verifyInvestmentPin("0123", original, nativeEquivalent),
    true,
  );
  assert.equal(
    await verifyInvestmentPin("1234", original, nativeEquivalent),
    false,
  );
  assert.equal(await verifyInvestmentPin("0123", optimized), true);
  await assert.rejects(
    createInvestmentAccess("0123", salt, async () => new Uint8Array(0)),
  );
});
