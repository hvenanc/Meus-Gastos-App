import { strict as assert } from "node:assert";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { persisted } from "./helpers/asyncStorageStub.mjs";
import { state } from "./helpers/secureBiometricStub.mjs";
registerHooks({
  resolve(specifier, context, next) {
    if (["expo-secure-store", "expo-local-authentication"].includes(specifier))
      return next(
        new URL("./helpers/secureBiometricStub.mjs", import.meta.url).href,
        context,
      );
    if (specifier === "@react-native-async-storage/async-storage")
      return next(
        new URL("./helpers/asyncStorageStub.mjs", import.meta.url).href,
        context,
      );
    return next(specifier, context);
  },
});
const bio = await import("../src/lib/investmentBiometrics.native.ts");
const hash = "a".repeat(64),
  next = "b".repeat(64);
test("marcador local não autoriza biometria sem credencial protegida; usuário e PIN são isolados", async () => {
  persisted.clear();
  state.data.clear();
  state.calls.length = 0;
  persisted.set("@meus-gastos/biometrics/alice", hash);
  assert.equal(await bio.authenticateBiometrics("alice", hash), false);
  await bio.enableBiometrics("alice", hash);
  assert.equal(await bio.authenticateBiometrics("alice", hash), true);
  assert.equal(await bio.authenticateBiometrics("bob", hash), false);
  assert.equal(await bio.authenticateBiometrics("alice", next), false);
  assert.ok(
    state.calls.every(
      (c) =>
        c.options.requireAuthentication === true &&
        c.options.keychainAccessible === 7,
    ),
  );
  state.allow = false;
  await assert.rejects(bio.authenticateBiometrics("alice", hash), /Cancelled/);
  state.allow = true;
  await bio.disableBiometrics("alice", hash);
  assert.equal(await bio.biometricEnabled("alice", hash), false);
});
test("mudança de PIN substitui credencial e biometria não cadastrada impede ativação", async () => {
  await bio.enableBiometrics("alice", hash);
  await bio.enableBiometrics("alice", next);
  assert.equal(await bio.biometricEnabled("alice", hash), false);
  assert.equal(state.data.size, 1);
  state.enrolled = false;
  try {
    assert.equal(await bio.biometricAvailable(), false);
    await assert.rejects(bio.enableBiometrics("bob", hash), /biometria/);
  } finally {
    state.enrolled = true;
  }
});
