import { strict as assert } from "node:assert";
import { test } from "node:test";
import { authError } from "../src/auth/errors.ts";
import { storageKey, STORAGE_KEY } from "../src/lib/storageKey.ts";
test("dados locais são separados por usuário, preservando modo local", () => {
  assert.equal(storageKey(), STORAGE_KEY);
  assert.notEqual(storageKey("alice"), storageKey("bob"));
  assert.notEqual(storageKey("alice"), storageKey());
  assert.equal(storageKey("alice"), `${STORAGE_KEY}/alice`);
});
test("erros de credenciais não revelam se a conta existe", () => {
  assert.equal(
    authError({ code: "auth/wrong-password" }),
    authError({ code: "auth/user-not-found" }),
  );
  assert.equal(
    authError({ code: "auth/invalid-credential" }),
    "E-mail ou senha incorretos.",
  );
});
test("falhas de conexão e configuração têm mensagens acionáveis", () => {
  assert.match(
    authError({ code: "auth/network-request-failed" }),
    /conexão|internet/,
  );
  assert.match(
    authError({ code: "auth/operation-not-allowed" }),
    /e-mail|indisponível/,
  );
  assert.match(authError({ code: "auth/invalid-api-key" }), /indisponível/);
  assert.equal(authError(null), "Não foi possível concluir. Tente novamente.");
});
