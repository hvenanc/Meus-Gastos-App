import { strict as assert } from "node:assert";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { persisted } from "./helpers/asyncStorageStub.mjs";
import { AppState } from "./helpers/pinNative.mjs";
import { state as biometrics } from "./helpers/biometricStub.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
registerHooks({
  resolve(specifier, context, next) {
    const mocks = {
      "react-native": "pinNative.mjs",
      "expo-crypto": "pinCrypto.mjs",
      "@react-native-async-storage/async-storage": "asyncStorageStub.mjs",
    };
    if (mocks[specifier])
      return next(
        new URL("./helpers/" + mocks[specifier], import.meta.url).href,
        context,
      );
    if (specifier === "../lib/investmentBiometrics")
      return next(
        new URL("./helpers/biometricStub.mjs", import.meta.url).href,
        context,
      );
    if (
      specifier === "./ui" &&
      context.parentURL?.endsWith("/InvestmentGate.tsx")
    )
      return next(
        new URL("./helpers/pinUI.mjs", import.meta.url).href,
        context,
      );
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".tsx")) {
      const url = new URL(specifier, context.parentURL);
      if (existsSync(fileURLToPath(url) + ".ts"))
        return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("/InvestmentGate.tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.React,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const { InvestmentGate } = await import("../src/components/InvestmentGate.tsx");
const { createInvestmentAccess } = await import("../src/lib/investmentPin.ts");
const credential = await createInvestmentAccess(
  "1234",
  new Uint8Array(16).fill(4),
);
const secret = "INVESTIMENTO_CONFIDENCIAL";
async function mount(access = credential) {
  let root, saved;
  const props = {
    access,
    userId: "test-user",
    onSetup: async (next) => {
      saved = next;
      props.access = next;
      root.update(element());
      return true;
    },
    children: React.createElement("private-data", null, secret),
  };
  const element = () => React.createElement(InvestmentGate, props);
  await act(async () => {
    root = renderer.create(element());
  });
  return {
    get root() {
      return root;
    },
    get saved() {
      return saved;
    },
    async pin(text, label = "PIN de investimentos") {
      await act(async () =>
        root.root
          .findByProps({ accessibilityLabel: label })
          .props.onChangeText(text),
      );
    },
    async press(title) {
      await act(async () => {
        await root.root
          .findAllByType("button")
          .find((b) => b.props.title === title)
          .props.onPress();
      });
    },
    hidden() {
      return !JSON.stringify(root.toJSON()).includes(secret);
    },
    async updateAccess(next) {
      props.access = next;
      await act(async () => root.update(element()));
    },
    async close() {
      await act(async () => root.unmount());
    },
  };
}
test("dados ficam ocultos antes do PIN, após erro, em segundo plano e ao reabrir", async () => {
  persisted.clear();
  const gate = await mount();
  try {
    assert.ok(gate.hidden());
    await gate.pin("0000");
    await gate.press("Desbloquear");
    assert.ok(gate.hidden());
    await gate.pin("1234");
    await gate.press("Desbloquear");
    assert.ok(!gate.hidden());
    await act(async () => AppState.emit("background"));
    assert.ok(gate.hidden());
    await act(async () => AppState.emit("active"));
    assert.ok(gate.hidden());
  } finally {
    await gate.close();
  }
  const reopened = await mount();
  try {
    assert.ok(reopened.hidden());
  } finally {
    await reopened.close();
  }
});
test("configurar PIN exige confirmação e libera somente após salvar o verificador", async () => {
  persisted.clear();
  const gate = await mount(undefined); // undefined is intentionally overridden below to test setup.
  await gate.updateAccess(undefined);
  try {
    await gate.pin("1234", "Novo PIN de investimentos");
    await gate.pin("4321", "Confirmar PIN de investimentos");
    await gate.press("Salvar PIN");
    assert.ok(gate.hidden());
    assert.equal(gate.saved, undefined);
    await gate.pin("1234", "Confirmar PIN de investimentos");
    await gate.press("Salvar PIN");
    assert.ok(gate.saved?.hash);
    assert.notEqual(gate.saved.hash, "1234");
    assert.ok(!gate.hidden());
  } finally {
    await gate.close();
  }
});
test("cinco erros bloqueiam e o bloqueio persiste após fechar a seção", async () => {
  persisted.clear();
  const gate = await mount();
  try {
    for (let i = 0; i < 5; i++) {
      await gate.pin("0000");
      await gate.press("Desbloquear");
    }
    assert.ok(gate.hidden());
    assert.ok(
      gate.root.root
        .findAllByType("button")
        .find((b) => b.props.title === "Desbloquear").props.disabled,
    );
  } finally {
    await gate.close();
  }
  const reopened = await mount();
  try {
    assert.ok(reopened.hidden());
    assert.ok(
      reopened.root.root
        .findAllByType("button")
        .find((b) => b.props.title === "Desbloquear").props.disabled,
    );
  } finally {
    await reopened.close();
  }
});
test("troca de credencial em outro aparelho bloqueia a sessão previamente aberta", async () => {
  persisted.clear();
  const gate = await mount();
  try {
    await gate.pin("1234");
    await gate.press("Desbloquear");
    assert.ok(!gate.hidden());
    const next = await createInvestmentAccess(
      "5678",
      new Uint8Array(16).fill(9),
    );
    await gate.updateAccess(next);
    assert.ok(gate.hidden());
    await gate.pin("5678");
    await gate.press("Desbloquear");
    assert.ok(!gate.hidden());
  } finally {
    await gate.close();
  }
});

test("biometria só é ativada após PIN; cancelamento não desbloqueia e sucesso libera", async () => {
  persisted.clear();
  biometrics.enabled = false;
  biometrics.success = false;
  const gate = await mount();
  try {
    assert.ok(gate.hidden());
    assert.ok(
      !gate.root.root
        .findAllByType("button")
        .some((b) => b.props.title === "Ativar biometria neste aparelho"),
    );
    await gate.pin("1234");
    await gate.press("Desbloquear");
    await gate.press("Ativar biometria neste aparelho");
    assert.equal(biometrics.enabled, true);
    await gate.press("Bloquear");
    await gate.press("Desbloquear com biometria");
    assert.ok(gate.hidden());
    biometrics.success = true;
    await gate.press("Desbloquear com biometria");
    assert.ok(!gate.hidden());
  } finally {
    await gate.close();
    biometrics.enabled = false;
    biometrics.success = true;
  }
});

test("resultado biométrico tardio após segundo plano não reabre investimentos", async () => {
  persisted.clear();
  biometrics.enabled = true;
  const gate = await mount();
  let finish;
  try {
    biometrics.deferred = new Promise((resolve) => {
      finish = resolve;
    });
    const button = gate.root.root
      .findAllByType("button")
      .find((b) => b.props.title === "Desbloquear com biometria");
    let operation;
    await act(async () => {
      operation = button.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      AppState.emit("inactive");
    });
    await act(async () => {
      AppState.emit("background");
      finish(true);
      await operation;
    });
    assert.ok(gate.hidden());
  } finally {
    biometrics.deferred = null;
    biometrics.enabled = false;
    await gate.close();
  }
});
