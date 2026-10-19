import {
  type Data,
  type Transaction,
  accountBalance,
  uid,
  today,
  validDate,
  validateData,
} from "./finance.ts";
import {
  type InvestmentMovement,
  investmentValidationError,
} from "./investments.ts";

export type InvestmentTransferInput = {
  sourceAccountId: string;
  investmentAccountId: string;
  amount: number;
  date: string;
  note?: string;
  movementId?: string;
};

export function investmentTransferAvailable(
  data: Data,
  accountId: string,
  date: string,
) {
  return Math.min(
    accountBalance(data, accountId),
    accountBalance(
      {
        ...data,
        transactions: data.transactions.filter((t) => t.date <= date),
      },
      accountId,
    ),
  );
}

function withoutTransfer(data: Data, movementId: string) {
  const movement = data.investmentMovements?.find((m) => m.id === movementId);
  const transaction = data.transactions.find(
    (t) =>
      t.id === movement?.sourceTransactionId &&
      t.investmentMovementId === movementId,
  );
  if (!movement?.sourceTransactionId || !transaction)
    throw new Error("Transferência de investimento não encontrada.");
  return {
    movement,
    transaction,
    data: {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== transaction.id),
      investmentMovements: data.investmentMovements!.filter(
        (m) => m.id !== movementId,
      ),
    },
  };
}

export function transferToInvestment(
  data: Data,
  input: InvestmentTransferInput,
  currentDate = today(),
): Data {
  if (!validateData(data)) throw new Error("Os dados atuais não são válidos.");
  if (!data.investmentAccess)
    throw new Error(
      "Configure o PIN e desbloqueie a área de investimentos antes de transferir.",
    );
  if (
    !validDate(input.date) ||
    !validDate(currentDate) ||
    input.date > currentDate
  )
    throw new Error("Informe uma data válida, de hoje ou anterior.");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new Error("O valor da transferência deve ser maior que zero.");
  const previous = input.movementId
    ? withoutTransfer(data, input.movementId)
    : undefined;
  const base = previous?.data ?? data;
  if (!base.accounts.some((a) => a.id === input.sourceAccountId))
    throw new Error("Escolha a conta de origem.");
  if (!base.investmentAccounts?.some((a) => a.id === input.investmentAccountId))
    throw new Error("Escolha a conta de investimentos de destino.");
  const available = investmentTransferAvailable(
    base,
    input.sourceAccountId,
    input.date,
  );
  if (!Number.isSafeInteger(available) || input.amount > available)
    throw new Error(
      "Saldo insuficiente na conta de origem. Confira também o saldo na data informada.",
    );
  const transactionId = previous?.transaction.id ?? uid();
  const movementId = previous?.movement.id ?? uid();
  const transaction: Transaction = {
    id: transactionId,
    type: "transfer",
    title: "Transferência para área privada",
    amount: input.amount,
    date: input.date,
    accountId: input.sourceAccountId,
    categoryId: "",
    paid: true,
    investmentMovementId: movementId,
  };
  const movement: InvestmentMovement = {
    id: movementId,
    type: "contribution",
    accountId: input.investmentAccountId,
    amount: input.amount,
    date: input.date,
    note: input.note?.trim() ?? "",
    sourceTransactionId: transactionId,
  };
  const next: Data = {
    ...base,
    transactions: [...base.transactions, transaction],
    investmentMovements: [...(base.investmentMovements ?? []), movement],
  };
  const error = investmentValidationError(next);
  if (error) throw new Error(error);
  if (!validateData(next))
    throw new Error("Não foi possível validar a transferência vinculada.");
  return next;
}

export function deleteInvestmentTransfer(data: Data, movementId: string): Data {
  if (!validateData(data)) throw new Error("Os dados atuais não são válidos.");
  const next = withoutTransfer(data, movementId).data;
  const error = investmentValidationError(next);
  if (error) throw new Error(error);
  if (!validateData(next))
    throw new Error("Não foi possível validar a exclusão da transferência.");
  return next;
}
