import { strict as assert } from "node:assert";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initialData, demoData, resetFinance } from "../src/lib/finance.ts";
import {
  financeRecords,
  restoreFinanceRecords,
} from "../src/lib/financeRecords.ts";
import { persisted } from "./helpers/asyncStorageStub.mjs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@react-native-async-storage/async-storage")
      return next(
        new URL("./helpers/asyncStorageStub.mjs", import.meta.url).href,
        context,
      );
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const url = new URL(specifier, context.parentURL);
      if (
        !url.pathname.endsWith(".ts") &&
        existsSync(fileURLToPath(url) + ".ts")
      )
        return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  },
});
const { readRecordStore, writeRecordStore } =
  await import("../src/lib/recordStorage.ts");
const { loadData, saveData } = await import("../src/lib/storage.ts");
const { storageKey } = await import("../src/lib/storageKey.ts");
const { default: storage } = await import("./helpers/asyncStorageStub.mjs");
test("conversão em registros preserva parcelas, categorias, ordem e IDs com barras", () => {
  const data = demoData();
  data.accounts[0].id = "with/slash";
  for (const t of data.transactions)
    if (t.accountId === "wallet") t.accountId = "with/slash";
  const records = financeRecords(data);
  assert(records.some((record) => record.path.includes("id-with%2Fslash")));
  assert.deepEqual(restoreFinanceRecords(records), data);
  assert.throws(() =>
    restoreFinanceRecords(
      records.filter((record) => record.path !== "profile/main"),
    ),
  );
});
test("migração local troca JSON legado por registros e mantém isolamento entre usuários", async () => {
  persisted.clear();
  const data = demoData();
  persisted.set(storageKey("alice"), JSON.stringify(data));
  assert.deepEqual(await loadData("alice"), data);
  assert(!persisted.has(storageKey("alice")));
  const manifest = JSON.parse(
    persisted.get(`${storageKey("alice")}/manifest`)!,
  );
  assert.equal(manifest.version, 2);
  assert.equal(manifest.data, undefined);
  assert(manifest.snapshots.data.pages.length > 0);
  assert.equal((await loadData("bob")).accounts.length, 0);
});
test("interrupção de escrita mantém a versão confirmada e nova gravação recupera a fila", async () => {
  persisted.clear();
  const data = demoData();
  await writeRecordStore("test", { data });
  const changed = structuredClone(data);
  changed.name = "Editado";
  const previousMultiSet = storage.multiSet;
  storage.multiSet = async () => {
    throw new Error("disk full");
  };
  await assert.rejects(
    () => writeRecordStore("test", { data: changed }),
    /disk full/,
  );
  storage.multiSet = previousMultiSet;
  assert.deepEqual((await readRecordStore("test"))!.snapshots.data, data);
  await writeRecordStore("test", { data: changed });
  assert.equal((await readRecordStore("test"))!.snapshots.data.name, "Editado");
});
test("fila offline separa base e alterações; reset remove também registros e versão anterior", async () => {
  persisted.clear();
  const data = demoData();
  await writeRecordStore(
    "outbox",
    { data, base: initialData },
    { pending: true, revision: 2, resetId: null },
  );
  const restored = (await readRecordStore("outbox"))!;
  assert.equal(restored.meta.pending, true);
  assert.deepEqual(restored.snapshots.data, data);
  assert.equal(restored.snapshots.base.accounts.length, 0);
  await saveData(data, "alice");
  const cleared = resetFinance(data);
  await saveData(cleared, "alice");
  assert.equal((await loadData("alice")).transactions.length, 0);
  assert(!persisted.has(`${storageKey("alice")}/previous-manifest`));
  const values = [...persisted].filter(([key]) =>
    key.startsWith(`${storageKey("alice")}/records/`),
  );
  assert(
    !values.some(([, value]) => value.includes('"title":"Fone de ouvido"')),
  );
});
