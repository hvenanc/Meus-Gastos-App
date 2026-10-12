import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  upgradeCategories,
  parseMoney,
  payInvoice,
} from "../src/lib/finance.ts";
import {
  mergeFinance,
  SyncConflict,
  decodeCloud,
} from "../src/lib/syncMerge.ts";
import { maskMoney } from "../src/lib/moneyMask.ts";
const fresh = () => structuredClone(initialData);
test("máscara preserva centavos, milhar, exclusão e colagem brasileira", () => {
  assert.equal(maskMoney("1"), "0,01");
  assert.equal(maskMoney("123456"), "1.234,56");
  assert.equal(maskMoney("R$ 1.234,56"), "1.234,56");
  assert.equal(maskMoney(""), "");
  assert.equal(maskMoney("0,001"), "0,01");
  assert.equal(maskMoney("999999999999999"), "9.999.999.999.999,99");
});
test("máscara não trunca colagens grandes e conversão em centavos preserva o limite seguro", () => {
  assert.equal(maskMoney("9999999999999999"), "99.999.999.999.999,99");
  assert.equal(parseMoney("90.071.992.547.409,91"), Number.MAX_SAFE_INTEGER);
  assert.throws(() => parseMoney(maskMoney("9999999999999999")), /muito alto/);
});
test("novas categorias de receitas preservam personalizações e exclusões posteriores", () => {
  const old = fresh();
  delete old.categoryCatalogVersion;
  old.categories = old.categories.filter((c) =>
    ["salary", "food"].includes(c.id),
  );
  const upgraded = upgradeCategories(old);
  assert.ok(
    upgraded.categories.some(
      (c) => c.id === "investments" && c.type === "income",
    ),
  );
  upgraded.categories = upgraded.categories.filter(
    (c) => c.id !== "investments",
  );
  assert.ok(
    !upgradeCategories(upgraded).categories.some((c) => c.id === "investments"),
  );
});
test("alterações em contas diferentes são combinadas sem perder dados remotos", () => {
  const base = fresh(),
    local = fresh(),
    remote = fresh();
  local.accounts.push({
    id: "local",
    name: "Local",
    bank: "other",
    initialBalance: 100,
  });
  remote.accounts.push({
    id: "remote",
    name: "Remota",
    bank: "itau",
    initialBalance: 200,
  });
  const merged = mergeFinance(base, local, remote);
  assert.deepEqual(
    merged.accounts.map((a) => a.id),
    ["remote", "local"],
  );
});
test("edições concorrentes no mesmo registro são conflitos explícitos", () => {
  const base = fresh(),
    local = fresh(),
    remote = fresh();
  local.name = "Local";
  remote.name = "Remoto";
  assert.throws(() => mergeFinance(base, local, remote), SyncConflict);
  remote.name = "Local";
  assert.equal(mergeFinance(base, local, remote).name, "Local");
});
test("reenvio após reinício é idempotente; alteração durante envio é preservada", () => {
  const base = fresh(),
    sent = fresh();
  sent.accounts.push({
    id: "a",
    name: "A",
    bank: "other",
    initialBalance: 100,
  });
  assert.deepEqual(mergeFinance(base, sent, sent), sent);
  const next = structuredClone(sent),
    confirmed = structuredClone(sent);
  next.accounts[0].name = "Editada";
  confirmed.name = "Remota";
  const merged = mergeFinance(sent, next, confirmed);
  assert.equal(merged.accounts[0].name, "Editada");
  assert.equal(merged.name, "Remota");
});
test("exclusão remota não deixa lançamento local sem conta", () => {
  const base = fresh();
  base.accounts.push({ id: "a", name: "A", bank: "other", initialBalance: 0 });
  const local = structuredClone(base),
    remote = fresh();
  local.transactions.push({
    id: "t",
    type: "income",
    title: "Receita",
    amount: 100,
    date: "2026-10-11",
    categoryId: "salary",
    accountId: "a",
    paid: true,
  });
  assert.throws(() => mergeFinance(base, local, remote), SyncConflict);
});
test("dados remotos inválidos são rejeitados, inclusive vínculos quebrados", () => {
  assert.throws(() =>
    decodeCloud({ schemaVersion: 1, revision: 1, payload: "{}" }),
  );
  assert.throws(() =>
    decodeCloud({
      schemaVersion: 1,
      revision: -1,
      payload: JSON.stringify(fresh()),
    }),
  );
  assert.deepEqual(
    decodeCloud({
      schemaVersion: 1,
      revision: 3,
      payload: JSON.stringify(fresh()),
    }).data,
    fresh(),
  );
});

test("pagamento simultâneo da mesma fatura em dois aparelhos não duplica o débito", () => {
  const base = fresh();
  base.accounts.push({
    id: "a",
    name: "A",
    bank: "other",
    initialBalance: 10000,
  });
  base.cards.push({
    id: "c",
    name: "C",
    bank: "other",
    accountId: "a",
    limit: 10000,
    closingDay: 20,
    dueDay: 27,
  });
  base.transactions.push({
    id: "purchase",
    title: "Compra",
    type: "expense",
    amount: 1000,
    date: "2026-10-11",
    categoryId: "food",
    accountId: "a",
    cardId: "c",
    invoiceMonth: "2026-10",
    paid: false,
  });
  const local = payInvoice(base, "c", "2026-10"),
    remote = payInvoice(base, "c", "2026-10");
  assert.throws(() => mergeFinance(base, local, remote), SyncConflict);
  assert.deepEqual(mergeFinance(base, local, local), local);
});
