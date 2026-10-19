import React, { useState } from "react";
import { Modal, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Data, money, monthLabel } from "../lib/finance";
import {
  deleteCardPurchase,
  purchaseDeletionPlan,
  type PurchaseDeletionScope,
} from "../lib/purchaseDeletion";
import { Button, Choice, Panel, useUI } from "./ui";

export function PurchaseDeletion({
  data,
  purchaseId,
  onSave,
  onClose,
}: {
  data: Data;
  purchaseId: string;
  onSave: (next: Data) => Promise<boolean>;
  onClose: () => void;
}) {
  const { colors, styles } = useUI();
  const [scope, setScope] = useState<PurchaseDeletionScope>("installment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const purchase = data.transactions.find((t) => t.id === purchaseId);
  let plan: ReturnType<typeof purchaseDeletionPlan> | undefined;
  let validationError = "";
  try {
    plan = purchaseDeletionPlan(data, purchaseId, scope);
  } catch (e) {
    validationError =
      e instanceof Error ? e.message : "Esta compra não pode ser excluída.";
  }
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={busy ? () => {} : onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            gap: 16,
            width: "100%",
            maxWidth: 580,
            alignSelf: "center",
          }}
        >
          <Text style={styles.title}>Excluir compra · {purchase?.title}</Text>
          <Text style={styles.muted}>
            Revise os lançamentos que serão removidos. Parcelas pagas e
            pagamentos de fatura serão preservados.
          </Text>
          <Choice
            title={
              purchase?.installment
                ? "Excluir somente esta parcela"
                : "Excluir esta compra"
            }
            active={scope === "installment"}
            onPress={() => {
              if (!busy) setScope("installment");
            }}
          />
          {!!purchase?.groupId && !!purchase.installment && (
            <Choice
              title="Excluir todas as parcelas em aberto da compra"
              active={scope === "purchase"}
              onPress={() => {
                if (!busy) setScope("purchase");
              }}
            />
          )}
          {plan && (
            <Panel>
              <Text style={styles.title}>
                {plan.installments.length} lançamento(s) em aberto
              </Text>
              {plan.installments.map((t) => (
                <Text key={t.id} style={styles.muted}>
                  {t.installment ? `Parcela ${t.installment} · ` : ""}
                  {monthLabel(t.invoiceMonth!)} · {money(t.amount)}
                  {t.anticipatedFrom ? " · Antecipada" : ""}
                </Text>
              ))}
              <Text style={styles.muted}>
                Valores originais: {money(plan.total)}
              </Text>
              <Text style={styles.muted}>
                Descontos e estornos vinculados a remover: {money(plan.credit)}
              </Text>
              <Text style={styles.title}>
                Redução das faturas: {money(plan.total - plan.credit)}
              </Text>
              {!!plan.paidCount && (
                <Text style={styles.muted}>
                  {plan.paidCount} parcela(s) paga(s) será(ão) mantida(s).
                </Text>
              )}
            </Panel>
          )}
          {!!(validationError || error) && (
            <Text accessibilityRole="alert" style={{ color: colors.red }}>
              {validationError || error}
            </Text>
          )}
          <Button
            danger
            title="Confirmar exclusão"
            disabled={!plan || busy}
            loading={busy}
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                if (await onSave(deleteCardPurchase(data, purchaseId, scope)))
                  onClose();
                else
                  setError(
                    "Não foi possível salvar a exclusão. Tente novamente.",
                  );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Não foi possível excluir a compra.",
                );
              } finally {
                setBusy(false);
              }
            }}
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
