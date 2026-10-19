import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type Data,
  addMonths,
  anticipateInstallments,
  availableInstallments,
  invoiceMonth,
  monthLabel,
  money,
  parseMoney,
  today,
} from "../lib/finance";
import { Button, Choice, Icon, Panel, useUI } from "./ui";
import { MoneyField } from "./MoneyField";

export function InstallmentAnticipation({
  data,
  cardId,
  initialMonth,
  onClose,
  onSave,
}: {
  data: Data;
  cardId: string;
  initialMonth: string;
  onClose: () => void;
  onSave: (next: Data, month: string) => Promise<boolean>;
}) {
  const { colors, styles } = useUI();
  const card = data.cards.find((item) => item.id === cardId)!;
  const earliest = invoiceMonth(today(), card);
  const [month, setMonth] = useState(
    initialMonth < earliest ? earliest : initialMonth,
  );
  const [group, setGroup] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState("0,00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = availableInstallments(data, cardId, month);
  const groups = [...new Map(available.map((t) => [t.groupId!, t])).values()];
  const installments = available.filter((t) => t.groupId === group);
  const selected = installments.filter((t) => ids.includes(t.id));
  const gross = selected.reduce((sum, t) => sum + t.amount, 0);
  let rebate = 0;
  let discountError = "";
  try {
    rebate = parseMoney(discount || "0,00");
  } catch {
    discountError = "Informe um desconto válido em reais.";
  }
  const valid = selected.length > 0 && !discountError && rebate <= gross;

  function changeMonth(offset: number) {
    const next = addMonths(`${month}-01`, offset).slice(0, 7);
    if (next < earliest || next > "9999-12") return;
    setMonth(next);
    setIds([]);
    setDiscount("0,00");
    setError("");
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = anticipateInstallments(
        data,
        cardId,
        selected.map((t) => t.id),
        month,
        rebate,
      );
      if (await onSave(next, month)) onClose();
      else setError("Não foi possível salvar a antecipação. Tente novamente.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível antecipar as parcelas.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={busy ? () => {} : onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 24,
            gap: 16,
            maxWidth: 580,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text style={styles.title}>Antecipar parcelas · {card.name}</Text>
          <Text style={styles.muted}>
            Escolha a fatura de destino e as parcelas de uma compra. Elas sairão
            das faturas futuras; o pagamento da fatura permanece separado.
          </Text>
          <Text style={styles.label}>Fatura de destino</Text>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Pressable
              disabled={busy || month <= earliest}
              accessibilityRole="button"
              accessibilityLabel="Fatura anterior"
              onPress={() => changeMonth(-1)}
              style={{ padding: 12, opacity: month <= earliest ? 0.3 : 1 }}
            >
              <Icon name="chevron-back" />
            </Pressable>
            <Text style={styles.title}>{monthLabel(month)}</Text>
            <Pressable
              disabled={busy || month === "9999-12"}
              accessibilityRole="button"
              accessibilityLabel="Próxima fatura"
              onPress={() => changeMonth(1)}
              style={{ padding: 12 }}
            >
              <Icon name="chevron-forward" />
            </Pressable>
          </View>
          <Text style={styles.label}>Compra parcelada</Text>
          <View style={{ gap: 8 }}>
            {groups.map((t) => (
              <Choice
                key={t.groupId}
                title={`${t.title} · ${money(available.filter((item) => item.groupId === t.groupId).reduce((sum, item) => sum + item.amount, 0))}`}
                active={group === t.groupId}
                onPress={() => {
                  if (!busy) {
                    setGroup(t.groupId!);
                    setIds([]);
                    setDiscount("0,00");
                    setError("");
                  }
                }}
              />
            ))}
          </View>
          {!groups.length && (
            <Text style={styles.muted}>
              Não há parcelas futuras disponíveis para esta fatura. Parcelas
              pagas, já antecipadas ou com estorno não podem ser selecionadas.
            </Text>
          )}
          {installments.length > 0 && (
            <>
              <Button
                secondary
                disabled={busy}
                title={
                  selected.length === installments.length
                    ? "Desmarcar todas"
                    : "Selecionar todas as parcelas futuras"
                }
                onPress={() =>
                  setIds(
                    selected.length === installments.length
                      ? []
                      : installments.map((t) => t.id),
                  )
                }
              />
              {installments.map((t) => (
                <Pressable
                  key={t.id}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ids.includes(t.id) }}
                  accessibilityLabel={`Parcela ${t.installment}, ${monthLabel(t.invoiceMonth!)}, ${money(t.amount)}`}
                  onPress={() =>
                    setIds((current) =>
                      current.includes(t.id)
                        ? current.filter((id) => id !== t.id)
                        : [...current, t.id],
                    )
                  }
                  style={[styles.row, { paddingVertical: 12 }]}
                >
                  <Icon
                    name={ids.includes(t.id) ? "checkbox" : "square-outline"}
                    color={colors.green}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Parcela {t.installment}</Text>
                    <Text style={styles.muted}>
                      {monthLabel(t.invoiceMonth!)}
                    </Text>
                  </View>
                  <Text style={styles.title}>{money(t.amount)}</Text>
                </Pressable>
              ))}
              <MoneyField
                label="Desconto total da antecipação (R$)"
                value={discount}
                onChange={(value) => {
                  if (!busy) setDiscount(value);
                }}
              />
              <Panel>
                <Text style={styles.muted}>
                  {selected.length} parcela(s) · Total original: {money(gross)}
                </Text>
                <Text style={styles.muted}>Desconto: {money(rebate)}</Text>
                <Text style={styles.title}>
                  Total na fatura: {money(gross - rebate)}
                </Text>
                <Text style={styles.muted}>{monthLabel(month)}</Text>
              </Panel>
              {!!discountError && (
                <Text style={{ color: colors.red }}>{discountError}</Text>
              )}
              {rebate > gross && (
                <Text style={{ color: colors.red }}>
                  O desconto não pode superar o total selecionado.
                </Text>
              )}
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={{ color: colors.red }}>
              {error}
            </Text>
          )}
          <Button
            title="Confirmar antecipação"
            disabled={!valid || busy}
            loading={busy}
            onPress={save}
          />
          <Button
            secondary
            title="Cancelar"
            disabled={busy}
            onPress={onClose}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
