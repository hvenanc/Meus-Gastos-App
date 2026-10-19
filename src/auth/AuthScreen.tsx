import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "./AuthProvider";
import { authError } from "./errors";
import { useUI, Button, Choice, Field, Icon, Panel } from "../components/ui";
export function AuthScreen({ onLocal }: { onLocal: () => void }) {
  const { colors, styles, mode, setMode } = useUI();
  const auth = useAuth();
  const [screen, setScreen] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function change(next: typeof screen) {
    setScreen(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
  }
  async function submit() {
    setError("");
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (screen === "register" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (screen !== "reset" && !password) {
      setError("Informe sua senha.");
      return;
    }
    if (screen === "register" && password.length < 6) {
      setError("Use pelo menos 6 caracteres na senha.");
      return;
    }
    if (screen === "register" && password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      if (screen === "login") await auth.login(email, password);
      else if (screen === "register")
        await auth.register(name, email, password);
      else {
        await auth.reset(email);
        setMessage(
          "Se houver uma conta para este e-mail, você receberá um link para redefinir sua senha.",
        );
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  const passwordField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
  ) => (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.input,
          { flexDirection: "row", alignItems: "center", paddingVertical: 0 },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={setValue}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={screen === "register" ? "newPassword" : "password"}
          style={{
            flex: 1,
            paddingVertical: 15,
            color: colors.text,
            fontSize: 16,
          }}
          placeholder="••••••••"
          placeholderTextColor={colors.placeholder}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "Ocultar senha" : "Mostrar senha"}
          onPress={() => setShow(!show)}
          hitSlop={10}
        >
          <Icon name={show ? "eye-off-outline" : "eye-outline"} />
        </Pressable>
      </View>
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View style={{ maxWidth: 430, width: "100%", alignSelf: "center" }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginBottom: 32,
              }}
            >
              <Choice
                title={mode === "dark" ? "Modo claro" : "Modo escuro"}
                icon={mode === "dark" ? "sunny-outline" : "moon-outline"}
                active={false}
                onPress={() =>
                  setMode(mode === "dark" ? "light" : "dark").catch(() =>
                    setError("Não foi possível salvar o tema."),
                  )
                }
              />
            </View>
            <View
              style={{
                height: 64,
                width: 64,
                borderRadius: 21,
                backgroundColor: colors.green,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Icon name="wallet" color={colors.bg} size={32} />
            </View>
            <Text
              style={{
                color: colors.green,
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              MEUS GASTOS
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 31,
                fontWeight: "700",
                letterSpacing: -1,
              }}
            >
              {screen === "login"
                ? "Bem-vindo de volta."
                : screen === "register"
                  ? "Comece uma nova história."
                  : "Recupere seu acesso."}
            </Text>
            <Text
              style={[
                styles.muted,
                {
                  fontSize: 14,
                  lineHeight: 22,
                  marginTop: 10,
                  marginBottom: 30,
                },
              ]}
            >
              {screen === "login"
                ? "Entre para continuar cuidando das suas finanças."
                : screen === "register"
                  ? "Crie sua conta e dê o primeiro passo para organizar seu dinheiro."
                  : "Informe seu e-mail para receber um link de recuperação."}
            </Text>
            {!auth.configured && (
              <Panel style={{ marginBottom: 22 }}>
                <Text style={[styles.title, { fontSize: 14, marginBottom: 8 }]}>
                  Acesso à nuvem indisponível
                </Text>
                <Text style={styles.muted}>
                  O serviço de acesso ainda não está disponível. Você pode
                  explorar o app com armazenamento local.
                </Text>
              </Panel>
            )}
            {screen === "register" && (
              <Field
                label="Seu nome"
                value={name}
                onChange={setName}
                placeholder="Como podemos chamar você?"
              />
            )}
            <View style={{ gap: 8, marginBottom: 18 }}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                accessibilityLabel="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="voce@exemplo.com"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
              />
            </View>
            {screen !== "reset" &&
              passwordField("Senha", password, setPassword)}
            {screen === "register" &&
              passwordField("Confirmar senha", confirm, setConfirm)}
            {screen === "login" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => change("reset")}
                disabled={busy}
                style={{ alignSelf: "flex-end", marginBottom: 24 }}
              >
                <Text
                  style={{
                    color: colors.green,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Esqueci minha senha
                </Text>
              </Pressable>
            )}
            {!!error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.red, lineHeight: 21, marginBottom: 18 }}
              >
                {error}
              </Text>
            )}
            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{
                  color: colors.green,
                  lineHeight: 21,
                  marginBottom: 18,
                }}
              >
                {message}
              </Text>
            )}
            <Button
              title={
                screen === "login"
                  ? "Entrar"
                  : screen === "register"
                    ? "Criar conta"
                    : "Enviar link de recuperação"
              }
              loading={busy}
              disabled={!auth.configured}
              onPress={submit}
            />
            <View style={{ marginVertical: 24, alignItems: "center", gap: 8 }}>
              <Text style={styles.muted}>
                {screen === "login"
                  ? "Ainda não tem uma conta?"
                  : screen === "register"
                    ? "Já tem uma conta?"
                    : "Lembrou sua senha?"}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  change(screen === "login" ? "register" : "login")
                }
              >
                <Text
                  style={{
                    color: colors.green,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {screen === "login"
                    ? "Criar minha conta"
                    : "Voltar para o login"}
                </Text>
              </Pressable>
            </View>
            {!auth.configured && (
              <Button
                title="Explorar no modo local"
                icon="phone-portrait-outline"
                secondary
                onPress={onLocal}
              />
            )}
            <Text
              style={[
                styles.muted,
                { textAlign: "center", marginTop: 24, fontSize: 11 },
              ]}
            >
              Seus registros têm uma cópia neste aparelho e são sincronizados na
              nuvem quando você entra na sua conta.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
