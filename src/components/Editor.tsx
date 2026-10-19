import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Data,
  Account,
  Card,
  Transaction,
  Goal,
  Budget,
  Category,
  uid,
  today,
  inputMoney,
  parseMoney,
  makeInstallments,
  makeRecurringExpenses,
  moveCardPurchase,
  refundCardPurchase,
  remainingRefund,
} from "../lib/finance";
import { formatBrazilianDate, parseBrazilianDate } from "../lib/dates";
import { DateField } from "./DateField";
import { MoneyField } from "./MoneyField";
import { maskMoney } from "../lib/moneyMask";
import { BankPicker } from "./BankPicker";
import { Button, Choice, Field, Icon, useUI } from "./ui";
const CATEGORY_ICONS = [
  ["pricetag-outline", "Outros"],
  ["cart-outline", "Compras"],
  ["restaurant-outline", "Alimentação"],
  ["home-outline", "Moradia"],
  ["car-outline", "Transporte"],
  ["medical-outline", "Saúde"],
  ["school-outline", "Educação"],
  ["game-controller-outline", "Lazer"],
  ["paw-outline", "Pets"],
  ["shirt-outline", "Roupas"],
  ["airplane-outline", "Viagens"],
  ["barbell-outline", "Academia"],
  ["phone-portrait-outline", "Telefone"],
  ["wifi-outline", "Internet"],
  ["flash-outline", "Energia"],
  ["water-outline", "Água"],
  ["briefcase-outline", "Trabalho"],
  ["cash-outline", "Receitas"],
  ["gift-outline", "Presentes"],
  ["trending-up-outline", "Rendimentos"],
] as const;
export type EditorType =
  | "account"
  | "card"
  | "refund"
  | "income"
  | "expense"
  | "transfer"
  | "goal"
  | "budget"
  | "category"
  | "profile";
export type EditorConfig = {
  type: EditorType;
  item?: any;
  categoryType?: "income" | "expense";
};
export function Editor({
  config,
  data,
  onClose,
  onSave,
  onDelete,
  message,
}: {
  config: EditorConfig;
  data: Data;
  onClose: () => void;
  onSave: (d: Data) => Promise<boolean>;
  onDelete: (config: EditorConfig) => void;
  message?: string;
}) {
  const { colors, styles } = useUI();
  const { type, item } = config;
  const [name, setName] = useState(
    item?.name ?? item?.title ?? (type === "profile" ? data.name : ""),
  );
  const [amount, setAmount] = useState(
    maskMoney(
      inputMoney(
        (type === "refund" && item ? remainingRefund(data, item) : undefined) ??
          item?.amount ??
          item?.initialBalance ??
          item?.limit ??
          item?.target ??
          0,
      ),
    ),
  );
  const [saved, setSaved] = useState(maskMoney(inputMoney(item?.saved ?? 0)));
  const [bank, setBank] = useState(item?.bank ?? "nubank");
  const [account, setAccount] = useState(
    item?.accountId ?? data.accounts[0]?.id ?? "",
  );
  const [destination, setDestination] = useState(
    item?.destinationId ??
      data.accounts.find((a) => a.id !== account)?.id ??
      "",
  );
  const [card, setCard] = useState(item?.cardId ?? "");
  const [category, setCategory] = useState(
    item?.categoryId ??
      data.categories.find((c) => c.type === type)?.id ??
      "food",
  );
  const [date, setDate] = useState(
    formatBrazilianDate((type === "refund" ? today() : item?.date) ?? today()),
  );
  const [paid, setPaid] = useState(item?.paid ?? true);
  const [closing, setClosing] = useState(String(item?.closingDay ?? 20));
  const [due, setDue] = useState(String(item?.dueDay ?? 27));
  const [count, setCount] = useState("1");
  const [recurring, setRecurring] = useState(false);
  const [repeats, setRepeats] = useState("12");
  const [categoryIcon, setCategoryIcon] = useState(
    item?.icon ?? "pricetag-outline",
  );
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryType, setCategoryType] = useState<"income" | "expense">(
    item?.type ?? config.categoryType ?? "expense",
  );
  const title =
    type === "refund"
      ? "Registrar estorno"
      : type === "profile"
        ? "Seu perfil"
        : `${item ? "Editar" : type === "card" || type === "budget" ? "Novo" : "Nova"} ${{ account: "conta", card: "cartão", income: "receita", expense: "despesa", transfer: "transferência", goal: "meta", budget: "limite", refund: "estorno", category: "categoria" }[type]}`;
  function replace<T extends { id: string }>(list: T[], value: T) {
    return item
      ? list.map((x) => (x.id === item.id ? value : x))
      : [...list, value];
  }
  async function submit() {
    setError("");
    setBusy(true);
    try {
      let next = { ...data };
      const id = item?.id ?? uid();
      const value =
        type === "profile" || type === "category"
          ? 0
          : parseMoney(amount || "0,00");
      if (!["budget", "transfer", "refund"].includes(type) && !name.trim())
        throw new Error("Informe um nome.");
      if (
        ["income", "expense", "transfer", "goal", "budget"].includes(type) &&
        value <= 0
      )
        throw new Error("O valor deve ser maior que zero.");
      if (type === "refund")
        next = refundCardPurchase(
          data,
          item.id,
          value,
          parseBrazilianDate(date),
        );
      if (type === "account")
        next.accounts = replace<Account>(data.accounts, {
          id,
          name: name.trim(),
          bank,
          initialBalance: value,
        });
      if (type === "card") {
        if (!account)
          throw new Error("Cadastre uma conta para pagar a fatura.");
        if (
          !/^\d+$/.test(closing) ||
          !/^\d+$/.test(due) ||
          Number(closing) < 1 ||
          Number(closing) > 31 ||
          Number(due) < 1 ||
          Number(due) > 31
        )
          throw new Error("Fechamento e vencimento devem ser de 1 a 31.");
        next.cards = replace<Card>(data.cards, {
          id,
          name: name.trim(),
          bank,
          limit: value,
          closingDay: Number(closing),
          dueDay: Number(due),
          accountId: account,
        });
      }
      if (["income", "expense", "transfer"].includes(type)) {
        if (!account)
          throw new Error("Cadastre uma conta antes de lançar movimentações.");
        if (
          type !== "transfer" &&
          !data.categories.some((c) => c.id === category && c.type === type)
        )
          throw new Error("Selecione uma categoria válida.");
        const isoDate = parseBrazilianDate(date);
        if (type === "transfer" && (!destination || destination === account))
          throw new Error("Escolha duas contas diferentes.");
        const t: Transaction = {
          id,
          title:
            type === "transfer" ? name.trim() || "Transferência" : name.trim(),
          amount: value,
          type: type as Transaction["type"],
          date: isoDate,
          categoryId: category,
          accountId: account,
          paid,
          note: note.trim(),
          ...(type === "transfer" ? { destinationId: destination } : {}),
          ...(type === "expense" && card
            ? {
                cardId: card,
                accountId: data.cards.find((c) => c.id === card)!.accountId,
              }
            : {}),
        };
        if (item?.cardId && item.paid)
          throw new Error(
            "Esta compra pertence a uma fatura paga e não pode ser alterada.",
          );
        if (item) {
          next.transactions = data.transactions.map((x) =>
            x.id === id ? moveCardPurchase(data, item, t) : x,
          );
        } else if (type === "expense" && recurring) {
          if (!/^\d+$/.test(repeats))
            throw new Error("Informe a quantidade total de repetições.");
          next.transactions = [
            ...data.transactions,
            ...makeRecurringExpenses(
              t,
              Number(repeats),
              t.cardId ? data.cards.find((c) => c.id === t.cardId) : undefined,
            ),
          ];
        } else if (t.cardId) {
          if (
            !/^\d+$/.test(count) ||
            Number(count) < 1 ||
            Number(count) > 48 ||
            Number(count) > value
          )
            throw new Error(
              "Use de 1 a 48 parcelas, com pelo menos R$ 0,01 por parcela.",
            );
          next.transactions = [
            ...data.transactions,
            ...makeInstallments(
              t,
              Number(count),
              data.cards.find((c) => c.id === t.cardId)!,
            ),
          ];
        } else next.transactions = [...data.transactions, t];
      }
      if (type === "goal")
        next.goals = replace<Goal>(data.goals, {
          id,
          name: name.trim(),
          target: value,
          saved: parseMoney(saved || "0,00"),
        });
      if (type === "budget") {
        if (
          !data.categories.some(
            (c) => c.id === category && c.type === "expense",
          )
        )
          throw new Error("Selecione uma categoria de despesa.");
        if (data.budgets.some((b) => b.categoryId === category && b.id !== id))
          throw new Error("Já existe um limite para esta categoria.");
        next.budgets = replace<Budget>(data.budgets, {
          id,
          categoryId: category,
          amount: value,
        });
      }
      if (
        type === "category" &&
        item &&
        item.type !== categoryType &&
        (data.transactions.some((t) => t.categoryId === item.id) ||
          data.budgets.some((b) => b.categoryId === item.id))
      )
        throw new Error(
          "Esta categoria está em uso. Crie outra categoria para mudar o tipo.",
        );
      if (type === "category")
        next.categories = replace<Category>(data.categories, {
          id,
          name: name.trim(),
          type: categoryType,
          icon: categoryIcon,
          color: item?.color ?? "#71c9bc",
        });
      if (type === "profile") next.name = name.trim();
      if (await onSave(next)) onClose();
      else setError("Não foi possível salvar. Tente novamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const choices = (label: string, children: React.ReactNode) => (
    <View style={{ marginBottom: 20, gap: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {children}
      </View>
    </View>
  );
  const accountChoices = (value: string, set: (v: string) => void) =>
    data.accounts.map((a) => (
      <Choice
        key={a.id}
        title={a.name}
        active={value === a.id}
        onPress={() => set(a.id)}
      />
    ));
  const bankPicker = <BankPicker value={bank} onChange={setBank} />;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={busy ? () => {} : onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 20,
              gap: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar formulário"
              onPress={onClose}
              disabled={busy}
            >
              <Icon name="arrow-back" color={colors.text} />
            </Pressable>
            <Text
              style={{ color: colors.text, fontSize: 19, fontWeight: "600" }}
            >
              {title}
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              width: "100%",
              maxWidth: 580,
              alignSelf: "center",
              paddingBottom: 50,
            }}
          >
            {!["budget", "refund"].includes(type) && (
              <Field
                label={
                  type === "profile"
                    ? "Como podemos chamar você?"
                    : "Nome / descrição"
                }
                value={name}
                onChange={setName}
                placeholder={
                  type === "account"
                    ? "Ex.: Conta principal"
                    : type === "expense"
                      ? "Ex.: Compras do mercado"
                      : "Digite um nome"
                }
              />
            )}
            {!["profile", "category"].includes(type) && (
              <MoneyField
                label={
                  type === "account"
                    ? "Saldo inicial (R$)"
                    : type === "card"
                      ? "Limite total (R$) · 0 para sem limite"
                      : type === "goal"
                        ? "Valor da meta (R$)"
                        : type === "budget"
                          ? "Limite mensal (R$)"
                          : "Valor (R$)"
                }
                value={amount}
                onChange={setAmount}
              />
            )}
            {["account", "card"].includes(type) && bankPicker}
            {type === "card" && (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Fecha dia"
                      value={closing}
                      onChange={setClosing}
                      keyboard="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Vence dia"
                      value={due}
                      onChange={setDue}
                      keyboard="number-pad"
                    />
                  </View>
                </View>
                <Text style={[styles.muted, { marginBottom: 18 }]}>
                  Compras no dia do fechamento entram na próxima fatura. O
                  limite disponível considera todas as parcelas em aberto.
                </Text>
                {choices(
                  "Conta de pagamento",
                  accountChoices(account, setAccount),
                )}
              </>
            )}
            {type === "refund" && (
              <>
                <Text style={[styles.muted, { marginBottom: 16 }]}>
                  Estorno de {item.title}. O crédito reduz a fatura calculada
                  pela data do estorno e não devolve dinheiro à conta. Limite:{" "}
                  {inputMoney(remainingRefund(data, item))}.
                </Text>
                <DateField
                  label="Data do estorno"
                  value={date}
                  onChange={setDate}
                />
              </>
            )}
            {["income", "expense", "transfer"].includes(type) && (
              <>
                <DateField
                  label="Data (DD/MM/AAAA)"
                  value={date}
                  onChange={setDate}
                />
                {type === "expense" &&
                  !item &&
                  choices(
                    "Forma de pagamento",
                    <>
                      <Choice
                        title="Conta / dinheiro"
                        active={!card}
                        onPress={() => setCard("")}
                        icon="wallet-outline"
                      />
                      {data.cards.map((c) => (
                        <Choice
                          key={c.id}
                          title={c.name}
                          active={card === c.id}
                          onPress={() => setCard(c.id)}
                          icon="card-outline"
                        />
                      ))}
                    </>,
                  )}
                {!card &&
                  choices(
                    type === "transfer" ? "Conta de origem" : "Conta",
                    accountChoices(account, setAccount),
                  )}
                {type === "transfer" &&
                  choices(
                    "Conta de destino",
                    accountChoices(destination, setDestination),
                  )}
                {type !== "transfer" &&
                  choices(
                    "Categoria",
                    data.categories
                      .filter((c) => c.type === type)
                      .map((c) => (
                        <Choice
                          key={c.id}
                          title={c.name}
                          icon={c.icon}
                          color={c.color}
                          active={category === c.id}
                          onPress={() => setCategory(c.id)}
                        />
                      )),
                  )}
                {type === "expense" && !item && (
                  <View style={{ marginBottom: 20, gap: 12 }}>
                    <Text style={styles.label}>Repetição</Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      <Choice
                        title="Despesa avulsa"
                        active={!recurring}
                        onPress={() => setRecurring(false)}
                      />
                      <Choice
                        title="Fixa mensal"
                        active={recurring}
                        onPress={() => setRecurring(true)}
                      />
                    </View>
                    {recurring && (
                      <>
                        <Field
                          label="Quantidade total de ocorrências (1 a 120)"
                          value={repeats}
                          onChange={setRepeats}
                          keyboard="number-pad"
                        />
                        <Text style={styles.muted}>
                          Inclui a primeira despesa. O valor informado se repete
                          integralmente a cada mês. As próximas ocorrências
                          ficam pendentes; no cartão, cada uma entra na sua
                          fatura.
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {!!item?.recurrenceId && (
                  <Text style={[styles.muted, { marginBottom: 16 }]}>
                    Despesa fixa · {item.recurrenceIndex}/{item.recurrenceCount}
                    . A edição ou exclusão afeta apenas esta ocorrência.
                  </Text>
                )}
                {!!card && !item && !recurring && (
                  <Field
                    label="Quantidade de parcelas"
                    value={count}
                    onChange={setCount}
                    keyboard="number-pad"
                  />
                )}
                {!card && (
                  <View
                    style={[
                      styles.row,
                      { justifyContent: "space-between", marginBottom: 22 },
                    ]}
                  >
                    <View>
                      <Text style={styles.title}>
                        {type === "income"
                          ? "Recebido"
                          : type === "transfer"
                            ? "Transferido"
                            : "Pago"}
                      </Text>
                      <Text style={styles.muted}>
                        Pendente não altera o saldo atual.
                      </Text>
                    </View>
                    <Switch
                      value={paid}
                      onValueChange={setPaid}
                      trackColor={{ false: colors.border, true: "#238954" }}
                      thumbColor={paid ? colors.green : "#8c9b92"}
                    />
                  </View>
                )}
                <Field
                  label="Observações (opcional)"
                  value={note}
                  onChange={setNote}
                  multiline
                />
              </>
            )}
            {type === "goal" && (
              <>
                <MoneyField
                  label="Valor já guardado (R$)"
                  value={saved}
                  onChange={setSaved}
                />
                <Text style={[styles.muted, { marginBottom: 22 }]}>
                  A meta acompanha seu progresso. Alterar este valor não
                  movimenta suas contas.
                </Text>
              </>
            )}
            {type === "budget" &&
              choices(
                "Categoria",
                data.categories
                  .filter((c) => c.type === "expense")
                  .map((c) => (
                    <Choice
                      key={c.id}
                      title={c.name}
                      icon={c.icon}
                      active={category === c.id}
                      onPress={() => setCategory(c.id)}
                    />
                  )),
              )}
            {type === "category" &&
              choices(
                "Tipo",
                <>
                  <Choice
                    title="Despesa"
                    active={categoryType === "expense"}
                    onPress={() => setCategoryType("expense")}
                  />
                  <Choice
                    title="Receita"
                    active={categoryType === "income"}
                    onPress={() => setCategoryType("income")}
                  />
                </>,
              )}
            {type === "category" && (
              <View style={{ marginBottom: 22, gap: 12 }}>
                <Text style={styles.label}>Ícone da categoria</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                >
                  {CATEGORY_ICONS.map(([icon, label]) => (
                    <Choice
                      key={icon}
                      title={label}
                      icon={icon}
                      active={categoryIcon === icon}
                      onPress={() => setCategoryIcon(icon)}
                    />
                  ))}
                </View>
                <View style={[styles.row, { marginTop: 6 }]}>
                  <Icon
                    name={categoryIcon}
                    color={item?.color ?? colors.green}
                  />
                  <Text style={styles.muted}>
                    Prévia: {name || "Sua categoria"}
                  </Text>
                </View>
              </View>
            )}
            {data.accounts.length === 0 &&
              ["income", "expense", "transfer", "card"].includes(type) && (
                <Text style={{ color: colors.red, marginBottom: 20 }}>
                  Cadastre uma conta na tela Início para continuar.
                </Text>
              )}
            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.red, marginBottom: 16, lineHeight: 21 }}
              >
                {message}
              </Text>
            )}
            {!!error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.red, marginBottom: 16, lineHeight: 21 }}
              >
                {error}
              </Text>
            )}
            <Button
              title={
                type === "refund"
                  ? "Registrar estorno"
                  : item
                    ? "Salvar alterações"
                    : "Salvar"
              }
              onPress={submit}
              loading={busy}
            />
            {item && !["profile", "refund"].includes(type) && (
              <View style={{ marginTop: 14 }}>
                <Button
                  title="Excluir"
                  danger
                  onPress={() => onDelete(config)}
                  disabled={busy}
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
