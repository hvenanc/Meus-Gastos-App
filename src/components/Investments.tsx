import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type Data,
  money,
  inputMoney,
  parseMoney,
  today,
  uid,
} from "../lib/finance";
import {
  type InvestmentAccount,
  type InvestmentMovement,
  investmentBalance,
  investmentAmount,
  investmentLabels,
  investmentValidationError,
  investmentAccountCreatedDate,
} from "../lib/investments";
import { formatBrazilianDate, parseBrazilianDate } from "../lib/dates";
import { maskMoney } from "../lib/moneyMask";
import {
  Button,
  Panel,
  Field,
  Choice,
  BankIcon,
  Icon,
  Section,
  Empty,
  useUI,
} from "./ui";
import { MoneyField } from "./MoneyField";
import { DateField } from "./DateField";
import { InvestmentGate } from "./InvestmentGate";
import { banks, getBank } from "../data/banks";
type Kind = "account" | InvestmentMovement["type"];
type Form = { kind: Kind; item?: InvestmentAccount | InvestmentMovement };
export function Investments({
  data,
  userId,
  onSave,
  onBack,
}: {
  data: Data;
  userId?: string;
  onSave: (data: Data) => Promise<boolean>;
  onBack: () => void;
}) {
  return (
    <>
      <View style={{ marginBottom: 16 }}>
        <Button
          title="Voltar"
          secondary
          icon="arrow-back-outline"
          onPress={onBack}
        />
      </View>
      <InvestmentGate
        access={data.investmentAccess}
        userId={userId}
        onSetup={(access) => onSave({ ...data, investmentAccess: access })}
        onClose={onBack}
      >
        <InvestmentWorkspace data={data} onSave={onSave} />
      </InvestmentGate>
    </>
  );
}
function InvestmentWorkspace({
  data,
  onSave,
}: {
  data: Data;
  onSave: (data: Data) => Promise<boolean>;
}) {
  const { colors, styles } = useUI();
  const accounts = data.investmentAccounts ?? [],
    movements = data.investmentMovements ?? [];
  const [form, setForm] = useState<Form | null>(null),
    [name, setName] = useState(""),
    [amount, setAmount] = useState("0,00"),
    [bank, setBank] = useState("other"),
    [account, setAccount] = useState(""),
    [date, setDate] = useState(formatBrazilianDate(today())),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deletePrompt, setDeletePrompt] = useState(false),
    [filter, setFilter] = useState("");
  const total = accounts.reduce(
    (sum, a) => sum + investmentBalance(data, a.id),
    0,
  );
  const contributions = movements
    .filter((m) => m.type === "contribution")
    .reduce((sum, m) => sum + m.amount, 0);
  const returns = movements
    .filter((m) => m.type === "yield" || m.type === "loss")
    .reduce((sum, m) => sum + investmentAmount(m), 0);
  function open(kind: Kind, item?: InvestmentAccount | InvestmentMovement) {
    setForm({ kind, item });
    setError("");
    setDeletePrompt(false);
    setName(item && "name" in item ? item.name : "");
    setAmount(
      maskMoney(
        inputMoney(
          item
            ? "initialBalance" in item
              ? item.initialBalance
              : item.amount
            : 0,
        ),
      ),
    );
    setBank(item && "bank" in item ? item.bank : "other");
    setAccount(
      item && "accountId" in item ? item.accountId : (accounts[0]?.id ?? ""),
    );
    setDate(formatBrazilianDate(item && "date" in item ? item.date : today()));
    setNote(item && "note" in item ? item.note : "");
  }
  async function save(remove = false) {
    if (!form || busy) return;
    setBusy(true);
    setError("");
    try {
      let next = { ...data };
      const id = form.item?.id ?? uid();
      if (form.kind === "account") {
        if (remove) {
          if (movements.some((m) => m.accountId === id))
            throw new Error(
              "Esta conta tem movimentações. Exclua ou transfira os registros para outra conta antes de remover.",
            );
          next.investmentAccounts = accounts.filter((a) => a.id !== id);
        } else {
          if (!name.trim()) throw new Error("Informe o nome da conta.");
          const createdAt =
            form.item && "initialBalance" in form.item
              ? investmentAccountCreatedDate(form.item)
              : today();
          const value: InvestmentAccount = {
            id,
            name: name.trim(),
            bank,
            initialBalance: parseMoney(amount || "0,00"),
            ...(createdAt ? { createdAt } : {}),
          };
          next.investmentAccounts = form.item
            ? accounts.map((a) => (a.id === id ? value : a))
            : [...accounts, value];
        }
      } else {
        if (remove)
          next.investmentMovements = movements.filter((m) => m.id !== id);
        else {
          const value: InvestmentMovement = {
            id,
            accountId: account,
            type: form.kind,
            amount: parseMoney(amount || "0,00"),
            date: parseBrazilianDate(date),
            note: note.trim(),
          };
          next.investmentMovements = form.item
            ? movements.map((m) => (m.id === id ? value : m))
            : [...movements, value];
        }
      }
      const validation = investmentValidationError(next);
      if (validation) throw new Error(validation);
      if (await onSave(next)) setForm(null);
      else throw new Error("Não foi possível salvar. Tente novamente.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel>
        <Text style={styles.muted}>Saldo dos investimentos</Text>
        <Text style={[styles.amount, { fontSize: 30, marginVertical: 12 }]}>
          {money(total)}
        </Text>
        <Text style={[styles.muted, { lineHeight: 21 }]}>
          Este patrimônio fica separado do saldo geral. Aportes e retiradas
          registrados aqui não movimentam suas contas comuns.
        </Text>
        <View style={{ marginTop: 18, gap: 10 }}>
          <Text style={styles.title}>
            Aportes registrados: {money(contributions)}
          </Text>
          <Text style={styles.title}>
            Rendimentos líquidos: {money(returns)}
          </Text>
        </View>
      </Panel>
      <Section
        title="Contas de investimentos"
        action="Adicionar"
        onPress={() => open("account")}
      />
      {!accounts.length ? (
        <Empty
          icon="trending-up-outline"
          title="Comece seus investimentos"
          description="Cadastre uma conta para acompanhar aportes, retiradas e rendimentos."
          action="Cadastrar conta"
          onPress={() => open("account")}
        />
      ) : (
        accounts.map((a) => (
          <Panel key={a.id} style={{ padding: 22, marginBottom: 16 }}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <BankIcon bank={a.bank} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={styles.title}>{a.name}</Text>
                <Text style={styles.muted}>{getBank(a.bank).name}</Text>
              </View>
              <Button
                title="Editar"
                secondary
                onPress={() => open("account", a)}
              />
            </View>
            <Text style={[styles.amount, { fontSize: 24, marginTop: 18 }]}>
              {money(investmentBalance(data, a.id))}
            </Text>
            <Text style={[styles.muted, { marginTop: 10, lineHeight: 20 }]}>
              {investmentAccountCreatedDate(a)
                ? `Cadastrada em ${formatBrazilianDate(investmentAccountCreatedDate(a)!)}`
                : "Data de cadastro não disponível"}
            </Text>
          </Panel>
        ))
      )}
      <Section title="Registrar movimentação" />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {(["contribution", "withdrawal", "yield", "loss"] as const).map(
          (kind) => (
            <Button
              key={kind}
              title={investmentLabels[kind]}
              secondary
              disabled={!accounts.length}
              onPress={() => open(kind)}
            />
          ),
        )}
      </View>
      <Section title="Histórico de investimentos" />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <Choice
          title="Todas as contas"
          active={!filter}
          onPress={() => setFilter("")}
        />
        {accounts.map((a) => (
          <Choice
            key={a.id}
            title={a.name}
            active={filter === a.id}
            onPress={() => setFilter(a.id)}
          />
        ))}
      </View>
      {movements.filter((m) => !filter || m.accountId === filter).length ===
        0 && (
        <Text style={styles.muted}>
          Nenhuma movimentação registrada nesta seleção.
        </Text>
      )}
      {movements
        .filter((m) => !filter || m.accountId === filter)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((m) => (
          <Panel key={m.id}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Icon
                name={
                  m.type === "withdrawal" || m.type === "loss"
                    ? "arrow-down-outline"
                    : "arrow-up-outline"
                }
                color={investmentAmount(m) < 0 ? colors.red : colors.green}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.title}>{investmentLabels[m.type]}</Text>
                <Text style={styles.muted}>
                  {accounts.find((a) => a.id === m.accountId)?.name} ·{" "}
                  {formatBrazilianDate(m.date)}
                </Text>
                {!!m.note && <Text style={styles.muted}>{m.note}</Text>}
                <Text
                  style={{
                    color: investmentAmount(m) < 0 ? colors.red : colors.green,
                    fontWeight: "700",
                  }}
                >
                  {investmentAmount(m) < 0 ? "−" : "+"} {money(m.amount)}
                </Text>
              </View>
              <Button
                title="Editar"
                secondary
                onPress={() => open(m.type, m)}
              />
            </View>
          </Panel>
        ))}
      <Modal
        visible={!!form}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setForm(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              maxWidth: 580,
              width: "100%",
              alignSelf: "center",
              gap: 10,
            }}
          >
            <Text style={[styles.title, { fontSize: 22, marginBottom: 12 }]}>
              {form?.kind === "account"
                ? "Conta de investimentos"
                : form
                  ? investmentLabels[form.kind]
                  : ""}
            </Text>
            {form?.kind === "account" ? (
              <>
                <Field
                  label="Nome da conta"
                  value={name}
                  onChange={setName}
                  placeholder="Ex.: Reserva · CDB"
                />
                <MoneyField
                  label="Saldo inicial (R$)"
                  value={amount}
                  onChange={setAmount}
                />
                <Text style={styles.label}>Banco / instituição</Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  {banks
                    .filter((b) => b.id !== "wallet")
                    .map((b) => (
                      <Choice
                        key={b.id}
                        title={b.name}
                        active={bank === b.id}
                        onPress={() => setBank(b.id)}
                      />
                    ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Conta de investimentos</Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  {accounts.map((a) => (
                    <Choice
                      key={a.id}
                      title={a.name}
                      active={account === a.id}
                      onPress={() => setAccount(a.id)}
                    />
                  ))}
                </View>
                <MoneyField
                  label="Valor (R$)"
                  value={amount}
                  onChange={setAmount}
                />
                <DateField label="Data" value={date} onChange={setDate} />
                <Field
                  label="Observações (opcional)"
                  value={note}
                  onChange={setNote}
                  multiline
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
            {deletePrompt ? (
              <>
                <Text style={styles.muted}>
                  Excluir este registro? O saldo será recalculado e a alteração
                  será sincronizada. A exclusão pode ser recusada se deixar
                  alguma retirada sem saldo.
                </Text>
                <Button
                  title="Confirmar exclusão"
                  danger
                  loading={busy}
                  onPress={() => save(true)}
                />
                <Button
                  title="Cancelar exclusão"
                  secondary
                  disabled={busy}
                  onPress={() => setDeletePrompt(false)}
                />
              </>
            ) : (
              <>
                <Button title="Salvar" loading={busy} onPress={() => save()} />
                <Button
                  title="Cancelar"
                  secondary
                  disabled={busy}
                  onPress={() => setForm(null)}
                />
                {form?.item && (
                  <Button
                    title="Excluir registro"
                    danger
                    disabled={busy}
                    onPress={() => setDeletePrompt(true)}
                  />
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
