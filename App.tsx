import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import {
  Account,
  Card,
  Data,
  Transaction,
  initialData,
  demoData,
  today,
  uid,
  money,
  addMonths,
  monthLabel,
  accountBalance,
  totals,
  inMonth,
  transactionMonth,
  upgradeCategories,
  invoice,
  payInvoice,
  invoiceIsOpen,
  transactionAmount,
  remainingRefund,
  resetFinance,
} from "./src/lib/finance";
import { formatBrazilianDate } from "./src/lib/dates";
import { FinanceSync, type SyncStatus } from "./src/lib/cloudStorage";
import { AppState } from "react-native";
import { loadData, saveData } from "./src/lib/storage";
import { exportBackup, importBackup } from "./src/lib/backup";
import {
  BankIcon,
  Button,
  Choice,
  Empty,
  Icon,
  Panel,
  Progress,
  Section,
  useUI,
} from "./src/components/ui";
import { Editor, EditorConfig, EditorType } from "./src/components/Editor";
import { ThemeProvider, ThemeColors } from "./src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { AuthScreen } from "./src/auth/AuthScreen";
import { authError } from "./src/auth/errors";
import { Investments } from "./src/components/Investments";
import { InvestmentGate } from "./src/components/InvestmentGate";
import { getBank } from "./src/data/banks";
type Tab =
  "home" | "transactions" | "cards" | "reports" | "profile" | "investments";
type Confirmation = {
  title: string;
  body: string;
  action: string;
  run: () => Promise<void>;
  danger?: boolean;
};
const tabs: { id: Tab; title: string; icon: string }[] = [
  { id: "home", title: "Início", icon: "grid-outline" },
  { id: "transactions", title: "Transações", icon: "list-outline" },
  { id: "cards", title: "Cartões", icon: "card-outline" },
  { id: "reports", title: "Relatórios", icon: "stats-chart-outline" },
  { id: "profile", title: "Perfil", icon: "person-outline" },
  { id: "investments", title: "Investimentos", icon: "lock-closed-outline" },
];
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppGate />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
function AppGate() {
  const { user, loading, registering } = useAuth();
  const { colors, ready } = useUI();
  const [local, setLocal] = useState(false);
  if (loading || (registering && user) || !ready)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.green} />
      </SafeAreaView>
    );
  if (!user && !local) return <AuthScreen onLocal={() => setLocal(true)} />;
  return (
    <Main key={user?.uid ?? "local"} onLocalLogout={() => setLocal(false)} />
  );
}
function Main({ onLocalLogout }: { onLocalLogout: () => void }) {
  const { user, logout } = useAuth();
  const { colors, styles, mode, setMode } = useUI();
  const s = React.useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<Data>(initialData),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("home"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [hide, setHide] = useState(false),
    [editor, setEditor] = useState<EditorConfig | null>(null),
    [add, setAdd] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [accountFilter, setAccountFilter] = useState(""),
    [selectedCard, setSelectedCard] = useState("");
  const [protectedAction, setProtectedAction] = useState<
    "export" | "restore" | "reset" | "demo" | "cloud" | null
  >(null);
  const hasInvestments = Boolean(
    data.investmentAccess ||
    data.investmentAccounts?.length ||
    data.investmentMovements?.length,
  );
  const lock = useRef(false);
  const sync = useRef<FinanceSync | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    user ? "connecting" : "local",
  );
  const [syncError, setSyncError] = useState("");
  const syncLabel = {
    local: "Modo local · Sem login",
    connecting: "Conectando ao Firebase",
    pending: "Salvo localmente · Sincronização pendente",
    syncing: "Sincronizando com Firebase",
    synced: "Sincronizado com Firebase",
    error: "Salvo localmente · Verifique a sincronização",
    conflict: "Conflito de sincronização",
  }[syncStatus];
  const { width } = useWindowDimensions();
  const wide = width >= 950;
  useEffect(() => {
    let active = true;
    const receive = (d: Data) => {
      if (active) {
        setData(d);
        setLoading(false);
      }
    };
    if (user) {
      const service = new FinanceSync(
        user.uid,
        receive,
        (status, message = "") => {
          if (active) {
            setSyncStatus(status);
            setSyncError(message);
          }
        },
        user.displayName ?? user.email?.split("@")[0],
      );
      sync.current = service;
      service.start().catch((e) => {
        if (active) {
          setLoadError(e.message);
          setLoading(false);
        }
      });
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") service.retry();
      });
      return () => {
        active = false;
        service.stop();
        sync.current = null;
        appState.remove();
      };
    }
    loadData()
      .then(receive)
      .catch((e) => {
        if (active) {
          setLoadError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const notify = (message: string) => setNotice(message);
  async function commit(next: Data) {
    next = upgradeCategories(next);
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      if (sync.current) await sync.current.save(next, data);
      else await saveData(next);
      if (!sync.current) setData(next);
      notify(
        user
          ? "Salvo · Sincronização automática com Firebase"
          : "Salvo no dispositivo",
      );
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar no dispositivo. Tente novamente.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(type: EditorType, item?: any) {
    setAdd(false);
    setNotice("");
    setEditor({ type, item });
  }
  async function saveEditor(next: Data) {
    const previous = new Map(data.transactions.map((t) => [t.id, t]));
    const datedExpense =
      editor?.type === "expense"
        ? next.transactions.find(
            (t) =>
              t.type === "expense" &&
              !t.invoicePayment &&
              (!previous.has(t.id) || previous.get(t.id)!.date !== t.date),
          )
        : undefined;
    const saved = await commit(next);
    if (saved && datedExpense) setMonth(transactionMonth(datedExpense));
    return saved;
  }
  const display = (value: number) => (hide ? "R$ ••••" : money(value));
  const summary = totals(data, month),
    balance = data.accounts.reduce((n, a) => n + accountBalance(data, a.id), 0);
  const monthTransactions = data.transactions
    .filter((t) => transactionMonth(t) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const expenses = data.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      ...c,
      total: data.transactions
        .filter(
          (t) =>
            inMonth(t, month) && t.categoryId === c.id && t.type === "expense",
        )
        .reduce((n, t) => n + transactionAmount(t), 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  function remove(config: EditorConfig) {
    const { type, item } = config;
    if (!item) return;
    if (
      type === "account" &&
      (data.transactions.some(
        (t) => t.accountId === item.id || t.destinationId === item.id,
      ) ||
        data.cards.some((c) => c.accountId === item.id))
    ) {
      notify(
        "Esta conta está vinculada a lançamentos ou cartões. Exclua esses vínculos primeiro.",
      );
      return;
    }
    if (
      type === "card" &&
      data.transactions.some((t) => t.cardId === item.id)
    ) {
      notify(
        "Este cartão tem compras registradas. Exclua as compras antes de remover o cartão.",
      );
      return;
    }
    if (
      type === "category" &&
      (data.transactions.some((t) => t.categoryId === item.id) ||
        data.budgets.some((b) => b.categoryId === item.id))
    ) {
      notify("Esta categoria está em uso por lançamentos ou limites.");
      return;
    }
    if (
      item.invoicePayment ||
      item.refundOf ||
      data.transactions.some(
        (t) =>
          t.refundOf === item.id ||
          (item.groupId &&
            data.transactions.find((x) => x.id === t.refundOf)?.groupId ===
              item.groupId),
      ) ||
      (item.cardId && item.paid)
    ) {
      notify(
        "Pagamentos de fatura e compras já quitadas são preservados no histórico.",
      );
      return;
    }
    setConfirmation({
      title: "Excluir registro?",
      body: item.groupId
        ? "Todas as parcelas em aberto desta compra serão excluídas. Parcelas já pagas serão preservadas."
        : "O registro será removido dos dados locais e os saldos serão recalculados.",
      action: "Excluir",
      danger: true,
      run: async () => {
        let next = { ...data };
        if (type === "account")
          next.accounts = data.accounts.filter((x) => x.id !== item.id);
        else if (type === "card")
          next.cards = data.cards.filter((x) => x.id !== item.id);
        else if (type === "goal")
          next.goals = data.goals.filter((x) => x.id !== item.id);
        else if (type === "budget")
          next.budgets = data.budgets.filter((x) => x.id !== item.id);
        else if (type === "category")
          next.categories = data.categories.filter((x) => x.id !== item.id);
        else
          next.transactions = data.transactions.filter((x) =>
            item.groupId
              ? x.groupId !== item.groupId || x.paid
              : x.id !== item.id,
          );
        if (await commit(next)) {
          setEditor(null);
          setConfirmation(null);
        }
      },
    });
  }
  function transactionRow(t: Transaction) {
    const cat = data.categories.find((c) => c.id === t.categoryId);
    const transfer = t.type === "transfer";
    const account = data.accounts.find((a) => a.id === t.accountId);
    const card = data.cards.find((c) => c.id === t.cardId);
    const color =
      t.type === "income" || t.refundOf
        ? colors.green
        : transfer
          ? colors.blue
          : colors.red;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${t.title}`}
        key={t.id}
        onPress={() => {
          if (t.cardId && !t.refundOf && remainingRefund(data, t) > 0) {
            if (t.paid) {
              open("refund", t);
              return;
            }
          }
          if (t.invoicePayment || t.refundOf || (t.cardId && t.paid)) {
            notify("Este lançamento já está quitado na fatura.");
            return;
          }
          open(t.type, t);
        }}
        style={({ pressed }) => [
          s.transaction,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <View
          style={[
            s.categoryIcon,
            { backgroundColor: `${cat?.color ?? colors.blue}18` },
          ]}
        >
          <Icon
            name={
              transfer
                ? "swap-horizontal"
                : t.invoicePayment
                  ? "card-outline"
                  : (cat?.icon ?? "pricetag-outline")
            }
            color={transfer ? colors.blue : (cat?.color ?? colors.muted)}
            size={20}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { fontSize: 14 }]} numberOfLines={1}>
            {t.title}{" "}
            {!!t.installment && (
              <Text style={styles.muted}>· {t.installment}</Text>
            )}
            {!!t.recurrenceId && (
              <Text style={styles.muted}>
                · Fixa {t.recurrenceIndex}/{t.recurrenceCount}
              </Text>
            )}
          </Text>
          <Text style={styles.muted}>
            {formatBrazilianDate(t.date)} · {card?.name ?? account?.name}
            {t.cardId && t.invoiceMonth
              ? ` · Fatura ${monthLabel(t.invoiceMonth)}`
              : ""}
            {transfer
              ? ` → ${data.accounts.find((a) => a.id === t.destinationId)?.name ?? ""}`
              : ` · ${cat?.name ?? "Fatura"}`}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color, fontWeight: "600", fontSize: 14 }}>
            {t.type === "income" || t.refundOf ? "+" : transfer ? "" : "−"}{" "}
            {display(t.amount)}
          </Text>
          <Text
            style={{
              fontSize: 10,
              color: t.paid ? colors.muted : card ? colors.blue : "#e4bd75",
            }}
          >
            {t.paid ? "Concluído" : card ? "Na fatura" : "Pendente"}
          </Text>
        </View>
        {card && !t.refundOf && remainingRefund(data, t) > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Estornar ${t.title}`}
            onPress={(event) => {
              event.stopPropagation();
              open("refund", t);
            }}
            style={{ padding: 10 }}
          >
            <Icon name="return-up-back-outline" color={colors.green} />
          </Pressable>
        )}
        {!card && !t.paid && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Marcar ${t.title} como pago`}
            onPress={() =>
              commit({
                ...data,
                transactions: data.transactions.map((x) =>
                  x.id === t.id ? { ...x, paid: true } : x,
                ),
              })
            }
            style={{ padding: 5 }}
          >
            <Icon
              name="checkmark-circle-outline"
              size={23}
              color={colors.green}
            />
          </Pressable>
        )}
      </Pressable>
    );
  }
  function accountRow(a: Account) {
    return (
      <Pressable
        key={a.id}
        accessibilityRole="button"
        accessibilityLabel={`Editar conta ${a.name}`}
        onPress={() => open("account", a)}
        style={[styles.row, { paddingVertical: 12 }]}
      >
        <BankIcon bank={a.bank} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, { fontSize: 14 }]}>{a.name}</Text>
          <Text style={styles.muted}>{getBank(a.bank).name}</Text>
        </View>
        <Text style={[styles.amount, { fontSize: 15 }]}>
          {display(accountBalance(data, a.id))}
        </Text>
        <Icon name="chevron-forward" size={15} />
      </Pressable>
    );
  }
  function cardPanel(c: Card, compact = false) {
    const bill = invoice(data, c.id, month);
    const openBill = invoiceIsOpen(c, month);
    const used = data.transactions
      .filter((t) => t.cardId === c.id && !t.paid)
      .reduce((n, t) => n + transactionAmount(t), 0);
    return (
      <Panel
        key={c.id}
        style={{
          marginBottom: 14,
          backgroundColor: compact ? colors.panel : colors.panel,
        }}
      >
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <BankIcon bank={c.bank} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{c.name}</Text>
            <Text style={styles.muted}>{getBank(c.bank).name} · crédito</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar cartão ${c.name}`}
            onPress={() => open("card", c)}
            hitSlop={10}
          >
            <Icon name="ellipsis-horizontal" />
          </Pressable>
        </View>
        <View style={{ marginTop: 24, marginBottom: 18 }}>
          <Text style={styles.muted}>
            Fatura de {monthLabel(month).split(" de ")[0]}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 27,
              fontWeight: "600",
              marginTop: 5,
            }}
          >
            {display(bill.total)}
          </Text>
        </View>
        <Progress value={c.limit ? used / c.limit : 0} />
        <View
          style={[
            styles.row,
            { justifyContent: "space-between", marginTop: 10 },
          ]}
        >
          <Text style={styles.muted}>Disponível</Text>
          <Text
            style={{ color: colors.green, fontWeight: "600", fontSize: 12 }}
          >
            {c.limit
              ? display(Math.max(0, c.limit - used))
              : "Sem limite definido"}
          </Text>
        </View>
        {!compact && (
          <>
            <View
              style={[
                styles.row,
                { justifyContent: "space-between", marginTop: 16 },
              ]}
            >
              <Text style={styles.muted}>Fecha dia {c.closingDay}</Text>
              <Text style={styles.muted}>Vence dia {c.dueDay}</Text>
            </View>
            <View style={styles.divider} />
            <View
              style={[
                styles.row,
                { justifyContent: "space-between", marginBottom: 15 },
              ]}
            >
              <Text style={styles.muted}>Em aberto nesta fatura</Text>
              <Text
                style={{
                  color: bill.pending ? colors.red : colors.green,
                  fontWeight: "600",
                }}
              >
                {display(bill.pending)}
              </Text>
            </View>
            {bill.credit > 0 && (
              <Text style={[styles.muted, { marginBottom: 14 }]}>
                Crédito de estornos: {display(bill.credit)}. Será abatido de
                novas compras nesta fatura.
              </Text>
            )}
            <Button
              title={
                bill.pending
                  ? openBill
                    ? "Antecipar fatura aberta"
                    : "Pagar fatura"
                  : bill.credit
                    ? "Crédito disponível nesta fatura"
                    : "Fatura sem saldo a pagar"
              }
              disabled={!bill.pending || busy}
              icon="checkmark-circle-outline"
              onPress={() =>
                setConfirmation({
                  title: openBill
                    ? "Antecipar fatura aberta?"
                    : "Pagar fatura?",
                  body: `Debitar ${money(bill.pending)} da conta ${data.accounts.find((a) => a.id === c.accountId)?.name}. Os lançamentos atuais desta fatura serão quitados. Novas compras continuarão entrando no ciclo aberto. Este registro não realiza um pagamento no banco.`,
                  action: "Confirmar pagamento",
                  run: async () => {
                    if (await commit(payInvoice(data, c.id, month)))
                      setConfirmation(null);
                  },
                })
              }
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedCard(selectedCard === c.id ? "" : c.id)}
              style={{ paddingTop: 18, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {selectedCard === c.id
                  ? "Ocultar compras"
                  : "Ver compras da fatura"}{" "}
                ↓
              </Text>
            </Pressable>
            {selectedCard === c.id &&
              (bill.items.length ? (
                bill.items.map(transactionRow)
              ) : (
                <Text
                  style={[styles.muted, { textAlign: "center", padding: 20 }]}
                >
                  Nenhuma compra nesta fatura.
                </Text>
              ))}
          </>
        )}
      </Panel>
    );
  }
  function goalPanel() {
    return (
      <>
        <Section
          title="Suas metas"
          action="Criar meta"
          onPress={() => open("goal")}
        />
        <Panel>
          {data.goals.length ? (
            data.goals.map((g) => (
              <Pressable
                accessibilityRole="button"
                key={g.id}
                onPress={() => open("goal", g)}
                style={{ gap: 12, paddingVertical: 10 }}
              >
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <View style={styles.row}>
                    <Icon name="flag-outline" color={colors.green} />
                    <Text style={styles.title}>{g.name}</Text>
                  </View>
                  <Text
                    style={{
                      color: colors.green,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {Math.round((g.saved / g.target) * 100)}%
                  </Text>
                </View>
                <Progress value={g.saved / g.target} />
                <Text style={styles.muted}>
                  {display(g.saved)} de {display(g.target)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Empty
              icon="flag-outline"
              title="Um plano para seus próximos passos"
              description="Defina uma meta e acompanhe o valor guardado."
              action="Criar minha primeira meta"
              onPress={() => open("goal")}
            />
          )}
        </Panel>
      </>
    );
  }
  function budgetPanel() {
    return (
      <>
        <Section
          title="Limites de gastos"
          action="Criar limite"
          onPress={() => open("budget")}
        />
        <Panel>
          {data.budgets.length ? (
            data.budgets.map((b) => {
              const cat = data.categories.find((c) => c.id === b.categoryId);
              const spent =
                expenses.find((c) => c.id === b.categoryId)?.total ?? 0;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={b.id}
                  onPress={() => open("budget", b)}
                  style={{ paddingVertical: 10, gap: 12 }}
                >
                  <View
                    style={[styles.row, { justifyContent: "space-between" }]}
                  >
                    <Text style={styles.title}>{cat?.name}</Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: spent > b.amount ? colors.red : colors.muted,
                      }}
                    >
                      {Math.round((spent / b.amount) * 100)}%
                    </Text>
                  </View>
                  <Progress
                    value={spent / b.amount}
                    color={spent > b.amount ? colors.red : colors.green}
                  />
                  <Text style={styles.muted}>
                    {display(spent)} de {display(b.amount)} por mês
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Empty
              icon="speedometer-outline"
              title="Gastos sob controle"
              description="Crie um limite mensal para cada categoria."
              action="Criar limite"
              onPress={() => open("budget")}
            />
          )}
        </Panel>
      </>
    );
  }
  function home() {
    return (
      <>
        <Panel
          style={{
            backgroundColor: colors.hero,
            borderColor: colors.heroBorder,
            padding: 24,
          }}
        >
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Text style={{ color: colors.heroText, fontSize: 13 }}>
              Saldo atual em contas
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hide ? "Mostrar valores" : "Ocultar valores"}
              onPress={() => setHide(!hide)}
            >
              <Icon
                name={hide ? "eye-off-outline" : "eye-outline"}
                color={colors.heroText}
                size={20}
              />
            </Pressable>
          </View>
          <Text
            style={{
              color: colors.text,
              fontSize: 38,
              fontWeight: "700",
              letterSpacing: -1.5,
              marginTop: 10,
            }}
          >
            {display(balance)}
          </Text>
          <View
            style={[
              styles.row,
              { marginTop: 26, justifyContent: "space-between" },
            ]}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.row}>
                <Icon name="arrow-down-circle" color={colors.green} size={18} />
                <Text style={styles.muted}>Receitas do mês</Text>
              </View>
              <Text
                style={{ color: colors.green, fontSize: 18, fontWeight: "600" }}
              >
                {display(summary.income)}
              </Text>
            </View>
            <View
              style={{
                width: 1,
                height: 34,
                backgroundColor: colors.heroBorder,
                marginRight: 18,
              }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.row}>
                <Icon name="arrow-up-circle" color={colors.red} size={18} />
                <Text style={styles.muted}>Despesas do mês</Text>
              </View>
              <Text
                style={{ color: colors.red, fontSize: 18, fontWeight: "600" }}
              >
                {display(summary.expense)}
              </Text>
            </View>
          </View>
        </Panel>
        <View style={[styles.row, { marginTop: 16, gap: 10 }]}>
          {[
            {
              type: "income" as const,
              title: "Receita",
              icon: "arrow-down",
              color: colors.green,
            },
            {
              type: "expense" as const,
              title: "Despesa",
              icon: "arrow-up",
              color: colors.red,
            },
            {
              type: "transfer" as const,
              title: "Transferir",
              icon: "swap-horizontal",
              color: colors.blue,
            },
          ].map((a) => (
            <Pressable
              accessibilityRole="button"
              key={a.type}
              onPress={() => open(a.type)}
              style={{
                flex: 1,
                backgroundColor: colors.panel,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name={a.icon} color={a.color} size={20} />
              <Text
                style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}
              >
                {a.title}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={wide ? { flexDirection: "row", gap: 24 } : undefined}>
          <View style={{ flex: 1 }}>
            <Section
              title="Minhas contas"
              action="Adicionar"
              onPress={() => open("account")}
            />
            <Panel>
              {data.accounts.length ? (
                data.accounts.map(accountRow)
              ) : (
                <Empty
                  icon="wallet-outline"
                  title="Tudo começa com sua primeira conta"
                  description="Cadastre seu banco ou uma carteira e informe o saldo inicial."
                  action="Adicionar conta"
                  onPress={() => open("account")}
                />
              )}
            </Panel>
            <Section
              title="Últimas transações"
              action="Ver todas"
              onPress={() => setTab("transactions")}
            />
            <Panel>
              {monthTransactions.length ? (
                monthTransactions.slice(0, 5).map(transactionRow)
              ) : (
                <Empty
                  icon="receipt-outline"
                  title="Seu mês começa aqui"
                  description="Registre suas receitas e despesas para acompanhar cada movimento."
                  action="Adicionar transação"
                  onPress={() => setAdd(true)}
                />
              )}
            </Panel>
            {goalPanel()}
          </View>
          <View style={{ flex: 1 }}>
            <Section
              title="Meus cartões"
              action={data.cards.length ? "Ver todos" : "Adicionar"}
              onPress={() =>
                data.cards.length ? setTab("cards") : open("card")
              }
            />
            {data.cards.length ? (
              data.cards.slice(0, 2).map((c) => cardPanel(c, true))
            ) : (
              <Panel>
                <Empty
                  icon="card-outline"
                  title="Seu cartão, sem surpresas"
                  description="Acompanhe faturas, parcelas e limite disponível em um só lugar."
                  action="Adicionar cartão"
                  onPress={() => open("card")}
                />
              </Panel>
            )}
            {budgetPanel()}
            <Section title="Balanço do mês" />
            <Panel>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={styles.muted}>Receitas − despesas</Text>
                <Text
                  style={[
                    styles.amount,
                    {
                      color:
                        summary.income - summary.expense >= 0
                          ? colors.green
                          : colors.red,
                    },
                  ]}
                >
                  {display(summary.income - summary.expense)}
                </Text>
              </View>
              <Text style={[styles.muted, { marginTop: 12 }]}>
                Inclui lançamentos pendentes e parcelas do mês. Transferências e
                pagamentos de fatura não entram novamente nas despesas.
              </Text>
            </Panel>
          </View>
        </View>
      </>
    );
  }
  function transactions() {
    const rows = monthTransactions.filter(
      (t) =>
        (filter === "all" ||
          (filter === "pending" ? !t.paid : t.type === filter)) &&
        (!accountFilter ||
          t.accountId === accountFilter ||
          t.destinationId === accountFilter) &&
        t.title.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <>
        <View style={[styles.row, { gap: 10, marginBottom: 22 }]}>
          {[
            { label: "Receitas", value: summary.income, color: colors.green },
            { label: "Despesas", value: summary.expense, color: colors.red },
            {
              label: "Balanço",
              value: summary.income - summary.expense,
              color: colors.text,
            },
          ].map((x) => (
            <Panel key={x.label} style={{ flex: 1, padding: 12 }}>
              <Text style={[styles.muted, { fontSize: 11 }]}>{x.label}</Text>
              <Text
                style={{
                  color: x.color,
                  fontSize: wide ? 20 : 14,
                  fontWeight: "600",
                  marginTop: 8,
                }}
              >
                {display(x.value)}
              </Text>
            </Panel>
          ))}
        </View>
        <View style={[styles.row, s.search]}>
          <Icon name="search-outline" size={19} />
          <TextInput
            accessibilityLabel="Buscar transações"
            style={{
              flex: 1,
              color: colors.text,
              paddingVertical: 13,
              fontSize: 14,
            }}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar uma transação"
            placeholderTextColor={colors.muted}
          />
          {!!search && (
            <Pressable
              accessibilityLabel="Limpar busca"
              onPress={() => setSearch("")}
            >
              <Icon name="close-circle" size={18} />
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: 16 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["all", "Todas"],
            ["income", "Receitas"],
            ["expense", "Despesas"],
            ["transfer", "Transferências"],
            ["pending", "Pendentes"],
          ].map(([id, label]) => (
            <Choice
              key={id}
              title={label}
              active={filter === id}
              onPress={() => setFilter(id)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ gap: 8 }}
        >
          <Choice
            title="Todas as contas"
            active={!accountFilter}
            onPress={() => setAccountFilter("")}
          />
          {data.accounts.map((a) => (
            <Choice
              key={a.id}
              title={a.name}
              active={accountFilter === a.id}
              onPress={() => setAccountFilter(a.id)}
            />
          ))}
        </ScrollView>
        <Panel>
          {rows.length ? (
            rows.map(transactionRow)
          ) : (
            <Empty
              icon="file-tray-outline"
              title="Nenhuma transação por aqui"
              description="Adicione um lançamento ou ajuste os filtros e o mês selecionado."
              action="Adicionar transação"
              onPress={() => setAdd(true)}
            />
          )}
        </Panel>
        <Text style={[styles.muted, { marginTop: 14 }]}>
          {rows.length} lançamento(s) · Toque para editar. O ✓ confirma um
          lançamento pendente.
        </Text>
      </>
    );
  }
  function reports() {
    const total = expenses.reduce((sum, category) => sum + category.total, 0);
    const radius = 65,
      circ = 2 * Math.PI * radius;
    let offset = 0;
    const points = (type: "income" | "expense") =>
      Array.from({ length: 31 }, (_, i) => {
        const amount = data.transactions
          .filter(
            (t) =>
              inMonth(t, month) &&
              t.type === type &&
              Number(t.date.slice(8)) === i + 1,
          )
          .reduce((n, t) => n + transactionAmount(t), 0);
        return amount;
      });
    const incomes = points("income"),
      outcomes = points("expense"),
      max = Math.max(...incomes, ...outcomes, 1),
      min = Math.min(...incomes, ...outcomes, 0);
    const poly = (values: number[]) =>
      values
        .map(
          (v, i) => `${12 + i * 9.2},${142 - ((v - min) / (max - min)) * 110}`,
        )
        .join(" ");
    return (
      <>
        <Panel>
          <Text style={styles.title}>Visão geral do mês</Text>
          <Text style={[styles.muted, { marginTop: 6 }]}>
            Receitas e despesas por dia
          </Text>
          <View style={{ marginVertical: 18 }}>
            <Svg viewBox="0 0 304 160" height={170} width="100%">
              {[32, 87, 142].map((y) => (
                <Line
                  key={y}
                  x1="12"
                  x2="288"
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeDasharray="3 5"
                />
              ))}
              <Polyline
                points={poly(incomes)}
                fill="none"
                stroke={colors.green}
                strokeWidth="2.5"
              />
              <Polyline
                points={poly(outcomes)}
                fill="none"
                stroke={colors.red}
                strokeWidth="2.5"
              />
            </Svg>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={styles.muted}>01</Text>
              <Text style={styles.muted}>15</Text>
              <Text style={styles.muted}>
                {new Date(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5)),
                  0,
                ).getDate()}
              </Text>
            </View>
          </View>
          <View style={[styles.row, { justifyContent: "center", gap: 24 }]}>
            <Text style={{ color: colors.green, fontSize: 12 }}>
              ● Receitas
            </Text>
            <Text style={{ color: colors.red, fontSize: 12 }}>● Despesas</Text>
          </View>
        </Panel>
        <Section title="Onde você está gastando" />
        <Panel>
          {expenses.length ? (
            <>
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Svg width={170} height={170} viewBox="0 0 170 170">
                  <Circle
                    cx={85}
                    cy={85}
                    r={radius}
                    stroke={colors.border}
                    strokeWidth={18}
                    fill="none"
                  />
                  {expenses.map((c) => {
                    const length = (c.total / total) * circ;
                    const old = offset;
                    offset += length;
                    return (
                      <Circle
                        key={c.id}
                        cx={85}
                        cy={85}
                        r={radius}
                        stroke={c.color}
                        strokeWidth={18}
                        fill="none"
                        strokeDasharray={`${length} ${circ - length}`}
                        strokeDashoffset={-old}
                        rotation={-90}
                        origin="85,85"
                      />
                    );
                  })}
                </Svg>
                <View
                  style={{
                    position: "absolute",
                    top: 75,
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.muted}>Total do mês</Text>
                  <Text style={[styles.amount, { marginTop: 4 }]}>
                    {display(total)}
                  </Text>
                </View>
              </View>
              {expenses.map((c) => (
                <View key={c.id} style={{ gap: 10, paddingVertical: 12 }}>
                  <View
                    style={[styles.row, { justifyContent: "space-between" }]}
                  >
                    <View style={styles.row}>
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: c.color,
                        }}
                      />
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {c.name}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 13 }}>
                      {display(c.total)}{" "}
                      <Text style={styles.muted}>
                        · {Math.round((c.total / total) * 100)}%
                      </Text>
                    </Text>
                  </View>
                  <Progress value={c.total / total} color={c.color} />
                </View>
              ))}
            </>
          ) : (
            <Empty
              icon="pie-chart-outline"
              title="Seus hábitos em números"
              description="Registre despesas para ver a distribuição por categoria."
            />
          )}
        </Panel>
        <Section title="Resumo financeiro" />
        <Panel>
          {[
            ["Receitas", summary.income],
            ["Despesas", summary.expense],
            ["Balanço", summary.income - summary.expense],
            [
              "Despesas pendentes",
              monthTransactions
                .filter((t) => t.type === "expense" && !t.paid && !t.cardId)
                .reduce((n, t) => n + transactionAmount(t), 0),
            ],
            [
              "Compras no cartão",
              monthTransactions
                .filter((t) => t.cardId)
                .reduce((n, t) => n + transactionAmount(t), 0),
            ],
          ].map(([label, value]) => (
            <View
              key={String(label)}
              style={[
                styles.row,
                { justifyContent: "space-between", paddingVertical: 12 },
              ]}
            >
              <Text style={styles.muted}>{label}</Text>
              <Text style={styles.amount}>{display(Number(value))}</Text>
            </View>
          ))}
        </Panel>
        {budgetPanel()}
      </>
    );
  }
  async function restore(unlocked = false) {
    if (hasInvestments && !unlocked) {
      setProtectedAction("restore");
      return;
    }
    try {
      const backup = await importBackup();
      if (backup)
        setConfirmation({
          title: "Restaurar backup?",
          body: `O backup contém ${backup.accounts.length} contas e ${backup.transactions.length} lançamentos. Os dados atuais serão substituídos. Exporte um backup antes de continuar se quiser preservá-los.`,
          action: "Restaurar",
          danger: true,
          run: async () => {
            if (await commit(backup)) {
              setConfirmation(null);
              setLoadError("");
            }
          },
        });
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Não foi possível abrir o backup.",
      );
    }
  }
  function confirmDemo() {
    setConfirmation({
      title: "Carregar demonstração?",
      body: "Seus dados atuais serão substituídos pelos dados de exemplo. Exporte um backup se quiser preservá-los.",
      action: "Carregar demonstração",
      run: async () => {
        if (await commit(demoData())) {
          setConfirmation(null);
          setTab("home");
          setMonth(today().slice(0, 7));
        }
      },
    });
  }
  function confirmReset() {
    setConfirmation({
      title: "Zerar todos os seus dados?",
      body: "Esta ação é irreversível. Todos os seus registros financeiros, investimentos e o PIN da seção serão removidos. Exporte um backup antes. A limpeza do Firebase exige internet e afeta somente sua conta.",
      action: "Confirmar e zerar dados",
      danger: true,
      run: async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
          if (sync.current)
            await sync.current.resetAll(data.investmentAccess?.hash);
          else {
            const empty = resetFinance(data);
            await saveData(empty);
            setData(empty);
          }
          setConfirmation(null);
          setTab("home");
          notify("Dados financeiros zerados");
        } catch (error) {
          notify((error as Error).message);
        } finally {
          lock.current = false;
          setBusy(false);
        }
      },
    });
  }
  function confirmCloud() {
    setConfirmation({
      title: "Usar os dados da nuvem?",
      body: "Exporte um backup para preservar suas alterações locais antes de continuar. Uma cópia de recuperação também ficará guardada neste aparelho.",
      action: "Usar versão da nuvem",
      run: async () => {
        try {
          await sync.current?.useCloudVersion();
          setConfirmation(null);
          notify("Versão da nuvem carregada");
        } catch (e) {
          notify((e as Error).message);
        }
      },
    });
  }
  function completeProtectedAction() {
    const action = protectedAction;
    setProtectedAction(null);
    if (action === "export")
      void exportBackup(data)
        .then(() => notify("Backup exportado"))
        .catch((e) => notify(e.message));
    if (action === "restore") void restore(true);
    if (action === "reset") confirmReset();
    if (action === "demo") confirmDemo();
    if (action === "cloud") confirmCloud();
  }
  function profile() {
    const action = (
      title: string,
      description: string,
      icon: string,
      fn: () => void,
    ) => (
      <Pressable
        accessibilityRole="button"
        onPress={fn}
        style={[styles.row, { paddingVertical: 16 }]}
      >
        <View style={s.categoryIcon}>
          <Icon name={icon} color={colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontSize: 14 }]}>{title}</Text>
          <Text style={styles.muted}>{description}</Text>
        </View>
        <Icon name="chevron-forward" size={17} />
      </Pressable>
    );
    return (
      <>
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <View style={[s.avatar, { width: 76, height: 76, borderRadius: 25 }]}>
            <Text
              style={{ fontSize: 30, color: colors.green, fontWeight: "700" }}
            >
              {data.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 25, fontWeight: "700", color: colors.text }}>
            {data.name}
          </Text>
          <View style={s.localBadge}>
            <View style={s.dot} />
            <Text style={{ fontSize: 12, color: colors.green }}>
              {syncLabel}
            </Text>
          </View>
        </View>
        <Panel>
          {action(
            "Editar perfil",
            "Personalize seu nome",
            "person-outline",
            () => open("profile", data),
          )}
          {action(
            "Minhas contas",
            `${data.accounts.length} conta(s) cadastrada(s)`,
            "wallet-outline",
            () => setTab("home"),
          )}
          {action(
            "Investimentos",
            "Contas, aportes, retiradas e rendimentos · PIN",
            "lock-closed-outline",
            () => setTab("investments"),
          )}
          {action(
            "Meus cartões",
            `${data.cards.length} cartão(ões) cadastrado(s)`,
            "card-outline",
            () => setTab("cards"),
          )}
        </Panel>
        <Section title="Aparência" />
        <Panel>
          <Text style={[styles.muted, { marginBottom: 14 }]}>
            Escolha o tema do aplicativo.
          </Text>
          <View style={styles.row}>
            <Choice
              title="Claro"
              icon="sunny-outline"
              active={mode === "light"}
              onPress={() =>
                setMode("light").catch(() =>
                  notify("Não foi possível salvar o tema."),
                )
              }
            />
            <Choice
              title="Escuro"
              icon="moon-outline"
              active={mode === "dark"}
              onPress={() =>
                setMode("dark").catch(() =>
                  notify("Não foi possível salvar o tema."),
                )
              }
            />
          </View>
        </Panel>
        <Section title="Conta e acesso" />
        <Panel>
          <Text style={[styles.muted, { marginBottom: 14 }]}>
            {user?.email ?? "Você está explorando no modo local."}
          </Text>
          <Button
            title={user ? "Sair da conta" : "Voltar para o login"}
            icon="log-out-outline"
            secondary
            onPress={() => {
              if (user) {
                setConfirmation({
                  title: "Sair da conta?",
                  body:
                    syncStatus === "synced"
                      ? "Seus registros estão sincronizados com o Firebase e continuam salvos neste aparelho."
                      : "Há dados ou verificações de sincronização pendentes. As alterações locais ficam neste aparelho e serão enviadas ao entrar novamente nesta conta.",
                  action: "Sair",
                  run: async () => {
                    try {
                      await logout();
                    } catch (e) {
                      notify(authError(e));
                    }
                  },
                });
              } else onLocalLogout();
            }}
          />
        </Panel>
        {user && (
          <>
            <Section title="Sincronização" />
            <Panel>
              <Text style={[styles.title, { marginBottom: 12 }]}>
                {syncLabel}
              </Text>
              <Text
                style={[styles.muted, { marginBottom: 16, lineHeight: 21 }]}
              >
                {syncError ||
                  "Contas, cartões, lançamentos, investimentos, categorias, metas e limites são sincronizados nesta conta. Sem internet, as alterações ficam salvas no aparelho."}
              </Text>
              <Button
                title="Sincronizar agora"
                secondary
                icon="sync-outline"
                onPress={() => sync.current?.retry()}
                disabled={syncStatus === "syncing"}
              />
              {syncStatus === "conflict" && (
                <View style={{ marginTop: 12 }}>
                  <Button
                    title="Usar versão da nuvem"
                    secondary
                    onPress={() => {
                      if (hasInvestments) setProtectedAction("cloud");
                      else confirmCloud();
                    }}
                  />
                </View>
              )}
            </Panel>
          </>
        )}
        {(["income", "expense"] as const).map((kind) => (
          <React.Fragment key={kind}>
            <Section
              title={
                kind === "income"
                  ? "Categorias de receitas"
                  : "Categorias de despesas"
              }
              action="Adicionar"
              onPress={() =>
                setEditor({ type: "category", categoryType: kind })
              }
            />
            <Panel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {data.categories
                  .filter((c) => c.type === kind)
                  .map((c) => (
                    <Choice
                      key={c.id}
                      title={c.name}
                      icon={c.icon}
                      color={c.color}
                      active={false}
                      onPress={() => open("category", c)}
                    />
                  ))}
              </View>
            </Panel>
          </React.Fragment>
        ))}
        <Section title="Seus dados" />
        <Panel>
          {action(
            "Exportar backup",
            "Salvar todos os dados em JSON · investimentos exigem PIN",
            "download-outline",
            () => {
              if (hasInvestments) setProtectedAction("export");
              else
                exportBackup(data)
                  .then(() => notify("Backup exportado"))
                  .catch((e) => notify(e.message));
            },
          )}
          {action(
            "Restaurar backup",
            "Importar um arquivo exportado pelo app",
            "cloud-upload-outline",
            () => restore(),
          )}
          {action(
            "Carregar demonstração",
            "Explore o app com dados de exemplo",
            "sparkles-outline",
            () => {
              if (hasInvestments) setProtectedAction("demo");
              else confirmDemo();
            },
          )}
        </Panel>
        <Section title="Zerar dados" />
        <Panel>
          <Text style={[styles.muted, { marginBottom: 16, lineHeight: 21 }]}>
            Remove contas comuns e de investimentos, cartões, lançamentos,
            aportes, retiradas, rendimentos, metas, limites, PIN e categorias
            personalizadas{" "}
            {user ? "do aparelho e do Firebase desta conta" : "deste aparelho"}.
            Seu acesso e as categorias padrão serão mantidos. Exporte um backup
            antes de continuar.
          </Text>
          <Button
            title="Zerar meus dados"
            danger
            disabled={busy || syncStatus === "syncing"}
            onPress={() => {
              if (hasInvestments) setProtectedAction("reset");
              else confirmReset();
            }}
          />
        </Panel>
        <Text style={[styles.muted, { paddingVertical: 20, lineHeight: 20 }]}>
          Meus Gastos · v1.3{"\n"}
          {user
            ? "Dados sincronizados com Firebase e cópia local separada por usuário."
            : "Dados armazenados neste dispositivo no modo local."}{" "}
          Faça backups regularmente. Não cadastre senhas ou números completos de
          cartões.
        </Text>
      </>
    );
  }
  if (loading)
    return (
      <SafeAreaView
        style={[
          s.app,
          { justifyContent: "center", alignItems: "center", gap: 16 },
        ]}
      >
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Abrindo suas finanças…</Text>
      </SafeAreaView>
    );
  const content = (
    <>
      <View style={s.pageHeader}>
        <View style={{ flex: 1, minWidth: 0, marginRight: 14 }}>
          <Text style={s.eyebrow}>
            {tab === "home" ? "SEU DINHEIRO, MAIS CLARO" : "MEUS GASTOS"}
          </Text>
          <Text style={s.pageTitle}>
            {tab === "home"
              ? `Olá, ${data.name}.`
              : tabs.find((t) => t.id === tab)?.title}
          </Text>
          <Text style={[styles.muted, { marginTop: 6 }]}>
            {tab === "home"
              ? "Um passo de cada vez. Suas finanças no controle."
              : tab === "investments"
                ? "Área protegida · patrimônio separado do saldo geral."
                : tab === "transactions"
                  ? "Cada movimento tem seu lugar."
                  : tab === "cards"
                    ? "Faturas, parcelas e limites em um só lugar."
                    : tab === "reports"
                      ? "Entenda seus hábitos e planeje o próximo passo."
                      : "Suas preferências e seus dados."}
          </Text>
        </View>
        <View style={[styles.row, { gap: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
            }
            onPress={() =>
              setMode(mode === "dark" ? "light" : "dark").catch(() =>
                notify("Não foi possível salvar o tema."),
              )
            }
          >
            <Icon
              name={mode === "dark" ? "sunny-outline" : "moon-outline"}
              color={colors.green}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            onPress={() => setTab("profile")}
            style={s.avatar}
          >
            <Text
              style={{ color: colors.green, fontSize: 17, fontWeight: "700" }}
            >
              {data.name.slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>
      {!["profile", "investments"].includes(tab) && (
        <View style={s.monthBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
            hitSlop={12}
            onPress={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}
          >
            <Icon name="chevron-back" size={20} />
          </Pressable>
          <View style={styles.row}>
            <Icon name="calendar-outline" size={16} color={colors.green} />
            <Text
              style={{
                color: colors.text,
                fontWeight: "600",
                fontSize: 14,
                textTransform: "capitalize",
              }}
            >
              {monthLabel(month)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
            hitSlop={12}
            onPress={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}
          >
            <Icon name="chevron-forward" size={20} />
          </Pressable>
        </View>
      )}
      {loadError ? (
        <Panel>
          <Empty
            icon="warning-outline"
            title="Não foi possível ler os dados"
            description={loadError}
            action="Importar backup"
            onPress={() => restore()}
          />
          <Button
            title="Tentar novamente"
            secondary
            onPress={() => {
              setLoading(true);
              (sync.current
                ? sync.current.start().then(() => setLoadError(""))
                : loadData().then((d) => {
                    setData(d);
                    setLoadError("");
                  })
              )
                .catch((e) => notify(e.message))
                .finally(() => setLoading(false));
            }}
          />
        </Panel>
      ) : tab === "investments" ? (
        <Investments
          data={data}
          userId={user?.uid}
          onSave={commit}
          onBack={() => setTab("profile")}
        />
      ) : tab === "home" ? (
        home()
      ) : tab === "transactions" ? (
        transactions()
      ) : tab === "reports" ? (
        reports()
      ) : tab === "profile" ? (
        profile()
      ) : (
        <>
          <Button
            title="Adicionar cartão"
            icon="add"
            secondary
            onPress={() => open("card")}
          />
          <View style={{ marginTop: 22 }}>
            {data.cards.length ? (
              data.cards.map((c) => cardPanel(c))
            ) : (
              <Panel>
                <Empty
                  icon="card-outline"
                  title="Nenhum cartão cadastrado"
                  description="Adicione um cartão para organizar suas compras e acompanhar a fatura."
                  action="Criar meu primeiro cartão"
                  onPress={() => open("card")}
                />
              </Panel>
            )}
          </View>
        </>
      )}
    </>
  );
  return (
    <SafeAreaView style={s.app}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
        {wide && (
          <View style={s.sidebar}>
            <View style={[styles.row, { marginBottom: 40 }]}>
              <View style={s.brand}>
                <Icon name="wallet" color={colors.bg} size={24} />
              </View>
              <Text
                style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}
              >
                meus gastos<Text style={{ color: colors.green }}>.</Text>
              </Text>
            </View>
            {tabs.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                onPress={() => setTab(t.id)}
                style={[
                  styles.row,
                  s.sidebarItem,
                  tab === t.id && { backgroundColor: colors.active },
                ]}
              >
                <Icon
                  name={t.icon}
                  color={tab === t.id ? colors.green : colors.muted}
                />
                <Text
                  style={{
                    color: tab === t.id ? colors.green : colors.muted,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {t.title}
                </Text>
              </Pressable>
            ))}
            <View style={{ marginTop: 28 }}>
              <Button
                title="Novo lançamento"
                icon="add"
                onPress={() => setAdd(true)}
                disabled={!!loadError}
              />
            </View>
            <View style={{ flex: 1 }} />
            <View style={s.localBadge}>
              <View style={s.dot} />
              <Text style={styles.muted}>Armazenamento local</Text>
            </View>
            <Text style={[styles.muted, { fontSize: 10, marginTop: 10 }]}>
              Seu controle financeiro pessoal.
            </Text>
          </View>
        )}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: wide ? 36 : 20,
            paddingTop: wide ? 32 : 20,
            paddingBottom: 110,
            maxWidth: 1100,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {content}
        </ScrollView>
        {!wide && (
          <View style={s.bottomBar}>
            {tabs
              .filter((t) => t.id !== "cards")
              .slice(0, 2)
              .map((t) => (
                <Nav key={t.id} t={t} active={tab === t.id} setTab={setTab} />
              ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adicionar lançamento"
              onPress={() => setAdd(true)}
              disabled={!!loadError}
              style={s.addButton}
            >
              <Icon name="add" color={colors.bg} size={28} />
            </Pressable>
            {tabs
              .filter((t) => t.id === "reports" || t.id === "profile")
              .map((t) => (
                <Nav key={t.id} t={t} active={tab === t.id} setTab={setTab} />
              ))}
          </View>
        )}
      </View>
      {!!notice && (
        <View
          accessibilityRole="alert"
          style={[s.toast, wide && { left: 290 }]}
        >
          <Icon
            name="information-circle-outline"
            color={colors.green}
            size={18}
          />
          <Text
            style={{
              color: colors.text,
              fontSize: 13,
              flex: 1,
              lineHeight: 19,
            }}
          >
            {notice}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso"
            onPress={() => setNotice("")}
          >
            <Icon name="close" size={18} />
          </Pressable>
        </View>
      )}
      <Modal
        visible={!!protectedAction}
        animationType="slide"
        onRequestClose={() => setProtectedAction(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView
            contentContainerStyle={{
              padding: 24,
              maxWidth: 580,
              width: "100%",
              alignSelf: "center",
            }}
          >
            {protectedAction && (
              <InvestmentGate
                access={data.investmentAccess}
                userId={user?.uid}
                onSetup={(access) =>
                  commit({ ...data, investmentAccess: access })
                }
                onUnlocked={completeProtectedAction}
                onClose={() => setProtectedAction(null)}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {editor && (
        <Editor
          key={`${editor.type}-${editor.item?.id ?? "new"}`}
          config={editor}
          data={data}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
          onDelete={remove}
          message={notice}
        />
      )}
      <Modal
        visible={add}
        transparent
        animationType="fade"
        onRequestClose={() => setAdd(false)}
      >
        <View style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAdd(false)}
            accessibilityLabel="Fechar menu"
          />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text
              style={{
                color: colors.text,
                fontSize: 22,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              O que você quer adicionar?
            </Text>
            <Text style={[styles.muted, { marginBottom: 24 }]}>
              Cada registro deixa suas finanças mais claras.
            </Text>
            {[
              {
                type: "income",
                title: "Receita",
                sub: "Salário, rendimentos e outras entradas",
                icon: "arrow-down-circle-outline",
                color: colors.green,
              },
              {
                type: "expense",
                title: "Despesa",
                sub: "Gastos do dia a dia e compras no cartão",
                icon: "arrow-up-circle-outline",
                color: colors.red,
              },
              {
                type: "transfer",
                title: "Transferência",
                sub: "Movimentar dinheiro entre suas contas",
                icon: "swap-horizontal-outline",
                color: colors.blue,
              },
              {
                type: "account",
                title: "Conta",
                sub: "Seu banco ou carteira",
                icon: "wallet-outline",
                color: "#d4bd78",
              },
              {
                type: "card",
                title: "Cartão de crédito",
                sub: "Faturas e limite disponível",
                icon: "card-outline",
                color: "#b294ec",
              },
            ].map((a) => (
              <Pressable
                accessibilityRole="button"
                key={a.type}
                onPress={() => open(a.type as EditorType)}
                style={[
                  styles.row,
                  {
                    paddingVertical: 17,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Icon name={a.icon} color={a.color} size={27} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{a.title}</Text>
                  <Text style={styles.muted}>{a.sub}</Text>
                </View>
                <Icon name="chevron-forward" size={17} />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setConfirmation(null)}
      >
        <View style={[s.overlay, { justifyContent: "center", padding: 24 }]}>
          <View
            style={[
              s.sheet,
              {
                borderRadius: 22,
                width: "100%",
                maxWidth: 450,
                alignSelf: "center",
              },
            ]}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "700",
                fontSize: 22,
                marginBottom: 12,
              }}
            >
              {confirmation?.title}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                lineHeight: 22,
                marginBottom: 24,
              }}
            >
              {confirmation?.body}
            </Text>
            <Button
              title={confirmation?.action ?? "Confirmar"}
              danger={confirmation?.danger}
              loading={busy}
              onPress={() =>
                confirmation?.run().catch((e) => notify(e.message))
              }
            />
            <View style={{ marginTop: 10 }}>
              <Button
                title="Cancelar"
                secondary
                disabled={busy}
                onPress={() => setConfirmation(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function Nav({
  t,
  active,
  setTab,
}: {
  t: (typeof tabs)[number];
  active: boolean;
  setTab: (t: Tab) => void;
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.title}
      onPress={() => setTab(t.id)}
      style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 10 }}
    >
      <Icon
        name={t.icon}
        size={21}
        color={active ? colors.green : colors.muted}
      />
      <Text
        style={{
          fontSize: 9,
          color: active ? colors.green : colors.muted,
          fontWeight: "500",
        }}
      >
        {t.title}
      </Text>
    </Pressable>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    app: { flex: 1, backgroundColor: colors.bg },
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 26,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 2,
      color: colors.green,
      marginBottom: 9,
    },
    pageTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: "700",
      letterSpacing: -1,
    },
    avatar: {
      width: 43,
      height: 43,
      backgroundColor: colors.avatar,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      borderColor: colors.avatarBorder,
      borderWidth: 1,
    },
    monthBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 14,
      marginBottom: 22,
    },
    transaction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoryIcon: {
      width: 39,
      height: 39,
      borderRadius: 12,
      backgroundColor: colors.iconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      backgroundColor: colors.panel,
      paddingHorizontal: 14,
    },
    sidebar: {
      width: 248,
      padding: 24,
      borderRightColor: colors.border,
      borderRightWidth: 1,
      backgroundColor: colors.sidebar,
    },
    sidebarItem: {
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderRadius: 13,
      marginBottom: 8,
    },
    brand: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.nav,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingTop: 9,
      paddingBottom: 9,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.green,
      marginHorizontal: 15,
    },
    localBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 7,
      paddingHorizontal: 11,
      backgroundColor: colors.badge,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.green,
    },
    overlay: {
      flex: 1,
      backgroundColor: "#000000a8",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.sheet,
      padding: 26,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      maxWidth: 560,
      width: "100%",
      alignSelf: "center",
      paddingBottom: 35,
    },
    handle: {
      height: 4,
      width: 36,
      borderRadius: 3,
      backgroundColor: "#526056",
      alignSelf: "center",
      marginBottom: 24,
    },
    toast: {
      position: "absolute",
      bottom: 96,
      left: 20,
      right: 20,
      backgroundColor: colors.toast,
      borderColor: colors.toastBorder,
      borderWidth: 1,
      padding: 16,
      borderRadius: 14,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      maxWidth: 650,
      alignSelf: "center",
    },
  });
