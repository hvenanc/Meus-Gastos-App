import React, { useEffect, useRef, useState } from "react";
import { AppState, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRandomBytesAsync } from "expo-crypto";
import { Button, Icon, Panel, useUI } from "./ui";
import { type InvestmentAccess } from "../lib/investments";
import {
  createInvestmentAccess,
  verifyInvestmentPin,
  failedPinAttempt,
  pinBlocked,
  validPin,
  type PinAttempts,
  parsePinAttempts,
} from "../lib/investmentPin";
export function InvestmentGate({
  access,
  userId,
  onSetup,
  onUnlocked,
  children,
  onClose,
}: {
  access?: InvestmentAccess;
  userId?: string;
  onSetup: (access: InvestmentAccess) => Promise<boolean>;
  onUnlocked?: () => void;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const { colors, styles } = useUI();
  const [accepted, setAccepted] = useState(""),
    [changing, setChanging] = useState(false),
    [pin, setPin] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [now, setNow] = useState(Date.now());
  const [attempts, setAttempts] = useState<PinAttempts>({
    failures: 0,
    blockedUntil: 0,
  });
  const generation = useRef(0),
    callbackRun = useRef(false);
  const key = `@meus-gastos/investment-pin/${userId ?? "local"}/${access?.salt ?? "setup"}`;
  const unlocked = Boolean(access && accepted === access.hash);
  const lock = () => {
    generation.current++;
    callbackRun.current = false;
    setAccepted("");
    setPin("");
    setConfirm("");
    setChanging(false);
    setError("");
  };
  useEffect(() => {
    let active = true;
    setReady(false);
    setPin("");
    setConfirm("");
    setChanging(false);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active) return;
        const parsed = parsePinAttempts(raw);
        setAttempts(parsed);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(
            "Não foi possível ler a proteção do PIN. Feche a seção e tente novamente.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") lock();
    });
    return () => {
      generation.current++;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!pinBlocked(attempts, Date.now())) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempts.blockedUntil]);
  useEffect(() => {
    if (unlocked && onUnlocked && !callbackRun.current) {
      callbackRun.current = true;
      onUnlocked();
    }
  }, [unlocked, onUnlocked]);
  async function submit() {
    if (busy || !ready) return;
    const stamp = generation.current;
    setBusy(true);
    setError("");
    try {
      if (!validPin(pin)) throw new Error("Digite exatamente 4 dígitos.");
      if (!access || (changing && unlocked)) {
        if (pin !== confirm) throw new Error("Os PINs não coincidem.");
        const credential = await createInvestmentAccess(
          pin,
          await getRandomBytesAsync(16),
        );
        if (stamp !== generation.current) return;
        if (await onSetup(credential)) {
          setPin("");
          setConfirm("");
          setChanging(false);
          if (stamp === generation.current) setAccepted(credential.hash);
        } else
          throw new Error("Não foi possível salvar o PIN. Tente novamente.");
      } else {
        const raw = await AsyncStorage.getItem(key);
        const current = parsePinAttempts(raw);
        if (pinBlocked(current, Date.now())) {
          setAttempts(current);
          throw new Error(
            "Aguarde o bloqueio terminar antes de tentar novamente.",
          );
        }
        const valid = await verifyInvestmentPin(pin, access);
        if (!valid) {
          const next = failedPinAttempt(current, Date.now());
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setAttempts(next);
          setPin("");
          throw new Error("PIN incorreto.");
        }
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ failures: 0, blockedUntil: 0 }),
        );
        setAttempts({ failures: 0, blockedUntil: 0 });
        if (stamp === generation.current) setAccepted(access.hash);
        setPin("");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (unlocked && !changing)
    return (
      <>
        {!onUnlocked && (
          <View
            style={[
              styles.row,
              { justifyContent: "space-between", marginBottom: 18 },
            ]}
          >
            <Button
              title="Bloquear"
              icon="lock-closed-outline"
              secondary
              onPress={lock}
            />
            <Button
              title="Alterar PIN"
              secondary
              onPress={() => {
                setChanging(true);
                setPin("");
                setConfirm("");
                setError("");
              }}
            />
          </View>
        )}
        {children}
      </>
    );
  const setup = !access || (changing && unlocked),
    blocked = !setup && pinBlocked(attempts, now);
  return (
    <Panel>
      <View style={{ alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Icon name="lock-closed-outline" size={34} color={colors.green} />
        <Text style={styles.title}>
          {setup
            ? changing
              ? "Alterar PIN de investimentos"
              : "Criar PIN de investimentos"
            : "Investimentos protegidos"}
        </Text>
        <Text style={[styles.muted, { textAlign: "center", lineHeight: 21 }]}>
          {setup
            ? "Escolha um PIN de 4 dígitos para acessar esta seção. Ele será exigido em todos os aparelhos da sua conta."
            : "Digite seu PIN de 4 dígitos para continuar."}
        </Text>
      </View>
      <Text style={styles.label}>{setup ? "Novo PIN" : "PIN"}</Text>
      <TextInput
        accessibilityLabel={
          setup ? "Novo PIN de investimentos" : "PIN de investimentos"
        }
        secureTextEntry
        keyboardType="number-pad"
        maxLength={4}
        value={pin}
        onChangeText={(text) => setPin(text.replace(/\D/g, ""))}
        style={[
          styles.input,
          {
            fontSize: 24,
            letterSpacing: 8,
            textAlign: "center",
            marginVertical: 12,
          },
        ]}
        autoComplete="off"
        editable={!busy && !blocked && ready}
      />
      {setup && (
        <>
          <Text style={styles.label}>Confirmar PIN</Text>
          <TextInput
            accessibilityLabel="Confirmar PIN de investimentos"
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            value={confirm}
            onChangeText={(text) => setConfirm(text.replace(/\D/g, ""))}
            style={[
              styles.input,
              {
                fontSize: 24,
                letterSpacing: 8,
                textAlign: "center",
                marginVertical: 12,
              },
            ]}
            autoComplete="off"
            editable={!busy && ready}
          />
        </>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.red, marginBottom: 12 }}
        >
          {error}
        </Text>
      )}
      {blocked && (
        <Text style={[styles.muted, { marginBottom: 12 }]}>
          Muitas tentativas. Tente novamente em{" "}
          {Math.max(1, Math.ceil((attempts.blockedUntil - now) / 1000))}{" "}
          segundos.
        </Text>
      )}
      <Button
        title={setup ? "Salvar PIN" : "Desbloquear"}
        onPress={submit}
        loading={busy}
        disabled={!ready || blocked}
      />
      {(onClose || changing) && (
        <View style={{ marginTop: 12 }}>
          <Button
            title="Cancelar"
            secondary
            onPress={() => {
              if (changing) setChanging(false);
              else onClose?.();
            }}
            disabled={busy}
          />
        </View>
      )}
    </Panel>
  );
}
