import { strict as assert } from "node:assert";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { calls, setFault } from "./helpers/quickCryptoStub.mjs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "react-native-quick-crypto")
      return next(
        new URL("./helpers/quickCryptoStub.mjs", import.meta.url).href,
        context,
      );
    return next(specifier, context);
  },
});
const native = await import("../src/lib/investmentPin.native.ts");
const original = await import("../src/lib/investmentPin.ts");
const salt = Uint8Array.from({ length: 16 }, (_, i) => i);
test("adaptador nativo usa PBKDF2 assíncrono com os parâmetros e credenciais existentes", async () => {
  const legacy = await original.createInvestmentAccess("0123", salt);
  const next = await native.createInvestmentAccess("0123", salt);
  assert.deepEqual(next, legacy);
  assert.equal(await native.verifyInvestmentPin("0123", legacy), true);
  assert.equal(await native.verifyInvestmentPin("1234", legacy), false);
  assert.ok(
    calls.every(
      (call) =>
        call.iterations === 100000 &&
        call.length === 32 &&
        call.digest === "sha256",
    ),
  );
  const before = calls.length;
  assert.equal(await native.verifyInvestmentPin("123", legacy), false);
  assert.equal(calls.length, before);
});
test("falha e resposta vazia da criptografia nativa recusam a autenticação", async () => {
  const access = await original.createInvestmentAccess("0123", salt);
  try {
    setFault("error");
    await assert.rejects(
      native.verifyInvestmentPin("0123", access),
      /Native test failure/,
    );
    setFault("empty");
    await assert.rejects(
      native.verifyInvestmentPin("0123", access),
      /proteção do PIN/,
    );
  } finally {
    setFault(undefined);
  }
});
