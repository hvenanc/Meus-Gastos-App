import { type Data, type Transaction } from "./finance.ts";
export type PurchaseDeletionScope = "installment" | "purchase";

export function purchaseDeletionPlan(
  data: Data,
  purchaseId: string,
  scope: PurchaseDeletionScope,
) {
  const purchase = data.transactions.find((t) => t.id === purchaseId);
  if (
    !purchase?.cardId ||
    purchase.refundOf ||
    purchase.invoicePayment ||
    purchase.paid
  )
    throw new Error(
      "Selecione uma compra ou parcela em aberto no cartão. O histórico pago será preservado.",
    );
  const group = data.transactions.filter(
    (t) =>
      t.cardId === purchase.cardId &&
      !t.refundOf &&
      !t.invoicePayment &&
      (scope === "purchase" && purchase.groupId
        ? t.groupId === purchase.groupId
        : t.id === purchase.id),
  );
  const installments = group.filter((t) => !t.paid);
  const ids = new Set(installments.map((t) => t.id));
  const credits = data.transactions.filter(
    (t) => t.refundOf && ids.has(t.refundOf),
  );
  if (credits.some((t) => t.paid))
    throw new Error(
      "Uma das parcelas tem um crédito já quitado. Esse vínculo deve ser preservado no histórico.",
    );
  return {
    installments,
    credits,
    paidCount: group.filter((t) => t.paid).length,
    total: installments.reduce((sum, t) => sum + t.amount, 0),
    credit: credits.reduce((sum, t) => sum + t.amount, 0),
  };
}

export function deleteCardPurchase(
  data: Data,
  purchaseId: string,
  scope: PurchaseDeletionScope,
): Data {
  const plan = purchaseDeletionPlan(data, purchaseId, scope);
  const ids = new Set(
    [...plan.installments, ...plan.credits].map((t: Transaction) => t.id),
  );
  return {
    ...data,
    transactions: data.transactions.filter((t) => !ids.has(t.id)),
  };
}
