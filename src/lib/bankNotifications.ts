import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  type Data,
  type Transaction,
  parseMoney,
  invoiceMonth,
  validateData,
} from "./finance.ts";
export const BANK_APPS = [
  { packageName: "com.nu.production", bank: "nubank", name: "Nubank" },
  { packageName: "com.itau", bank: "itau", name: "Itaú" },
  { packageName: "com.bradesco", bank: "bradesco", name: "Bradesco" },
  { packageName: "com.santander.app", bank: "santander", name: "Santander" },
  {
    packageName: "br.com.bb.android",
    bank: "bancodobrasil",
    name: "Banco do Brasil",
  },
  { packageName: "br.com.intermedium", bank: "inter", name: "Inter" },
  { packageName: "com.c6bank.app", bank: "c6bank", name: "C6 Bank" },
  { packageName: "com.picpay", bank: "picpay", name: "PicPay" },
  {
    packageName: "com.mercadopago.wallet",
    bank: "mercadopago",
    name: "Mercado Pago",
  },
  { packageName: "br.com.uol.ps.myaccount", bank: "pagbank", name: "PagBank" },
] as const;
export type BankBinding = { accountId: string; cardId?: string };
export type NotificationConfig = {
  enabled: boolean;
  deviceId?: string;
  bindings: Record<string, BankBinding>;
};
export type BankNotice = {
  id: string;
  packageName: string;
  postedAt: number;
  title: string;
  text: string;
  context: string;
  accountId: string;
  cardId: string;
};
export type ParsedNotice = {
  amount: number;
  date: string;
  title: string;
  type: "expense" | "income";
  purchase: boolean;
  debit: boolean;
  confidence: "automatic" | "review";
};
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function validNotice(value: unknown): value is BankNotice {
  const n = value as BankNotice;
  return Boolean(
    n &&
    /^[a-f0-9]{64}$/.test(n.id) &&
    BANK_APPS.some((b) => b.packageName === n.packageName) &&
    Number.isSafeInteger(n.postedAt) &&
    n.postedAt > 0 &&
    typeof n.title === "string" &&
    typeof n.text === "string" &&
    n.title.length <= 200 &&
    n.text.length <= 2000 &&
    typeof n.context === "string" &&
    typeof n.accountId === "string" &&
    typeof n.cardId === "string",
  );
}
export function parseBankNotice(n: BankNotice): ParsedNotice | null {
  if (!validNotice(n)) return null;
  if (/limite|fatura|oferta|promocao/.test(normalized(n.title))) return null;
  const raw = `${n.title} ${n.text}`.replace(/\s+/g, " ").trim(),
    text = normalized(raw);
  if (
    /senha|codigo|token|autentic|verificacao|nao (?:foi )?(?:aprovad|realizad|concluid)|negad|recusad|cancelad|falhou|agendad|previst|tentativa|fatura|emprestimo|oferta|promocao|proposta|cobranca|solicitacao|estorn|reembols|devolv|devoluc|resgat|aporte|investimento/.test(
      text,
    )
  )
    return null;
  const amounts = [...raw.matchAll(/R\$\s*(\d+(?:\.\d{3})*,\d{2})(?!\d)/gi)];
  if (!amounts.length) return null;
  let amount: number;
  try {
    amount = parseMoney(amounts[0][1]);
  } catch {
    return null;
  }
  if (!amount) return null;
  const income =
    /pix (?:recebid|recebeu)|(?:voce )?recebeu (?:um )?pix|(?:transferencia|pagamento|valor) (?:recebid|creditad)|\b(?:voce )?recebeu\b|pix de .*(?:recebid|recebeu)/.test(
      text,
    );
  const expense =
    /pix (?:enviad|realizad)|(?:voce )?(?:enviou|fez) (?:um )?pix|(?:transferencia|pagamento) (?:realizad|efetuad|concluid|aprovad)|compra.{0,40}(?:aprovad|realizad)|(?:voce )?comprou/.test(
      text,
    );
  const purchase = /compra|comprou/.test(text),
    debit = /debito/.test(text);
  if (!income && !expense && !purchase) return null;
  const date = new Date(n.postedAt);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const tail = raw.slice(amounts[0].index! + amounts[0][0].length);
  const merchant = (
    tail.match(
      /(?:\bem\b|\bpara\b|\bde\b|\bno\b|\bna\b)\s+([^.!\n]{3,90})/i,
    )?.[1] ?? raw.match(/(?:\bem\b|\bpara\b|\bde\b)\s+([^.!\n]{3,90})/i)?.[1]
  )
    ?.replace(/R\$.*$/i, "")
    .trim();
  const title =
    `${income ? "Recebimento" : purchase ? "Compra" : "Pagamento"}${merchant ? ` · ${merchant}` : ""}`.slice(
      0,
      120,
    );
  return {
    amount,
    date: iso,
    title,
    type: income ? "income" : "expense",
    purchase,
    debit,
    confidence:
      amounts.length === 1 &&
      income !== expense &&
      !/parcel|\b\d+\s*x\b/.test(text)
        ? "automatic"
        : "review",
  };
}
export function notificationTransaction(
  data: Data,
  notice: BankNotice,
  parsed: ParsedNotice,
  force = false,
): Transaction | null {
  if (!validNotice(notice)) return null;
  const id = `notification-${notice.id}`;
  if (
    data.transactions.some(
      (t) => t.id === id || t.notificationImportId === notice.id,
    )
  )
    return null;
  const account = data.accounts.find((a) => a.id === notice.accountId);
  if (!account) return null;
  const card =
    parsed.purchase && !parsed.debit
      ? data.cards.find((c) => c.id === notice.cardId)
      : undefined;
  if (
    parsed.purchase &&
    !parsed.debit &&
    !card &&
    (notice.cardId ||
      /credito/.test(normalized(`${notice.title} ${notice.text}`)))
  )
    return null;
  if (
    !force &&
    (parsed.confidence !== "automatic" ||
      (parsed.purchase && !parsed.debit && !card))
  )
    return null;
  const category =
    data.categories.find(
      (c) =>
        c.type === parsed.type &&
        c.id === (parsed.type === "income" ? "other-income" : "other"),
    ) ?? data.categories.find((c) => c.type === parsed.type);
  if (!category) return null;
  const transaction: Transaction = {
    id,
    type: parsed.type,
    title: parsed.title,
    amount: parsed.amount,
    date: parsed.date,
    categoryId: category.id,
    accountId: card?.accountId ?? account.id,
    paid: !card,
    notificationImportId: notice.id,
    notificationImportedAt: notice.postedAt,
    note: `Importada da notificação de ${BANK_APPS.find((b) => b.packageName === notice.packageName)!.name}.`,
    ...(card
      ? { cardId: card.id, invoiceMonth: invoiceMonth(parsed.date, card) }
      : {}),
  };
  return validateData({
    ...data,
    transactions: [...data.transactions, transaction],
  })
    ? transaction
    : null;
}
export function possibleNotificationDuplicate(
  data: Data,
  n: BankNotice,
  p: ParsedNotice,
) {
  return data.transactions.some(
    (t) =>
      t.amount === p.amount &&
      (t.type === p.type ||
        (t.type === "transfer" &&
          (p.type === "income"
            ? t.destinationId === n.accountId
            : t.accountId === n.accountId))) &&
      t.date === p.date &&
      !t.invoicePayment &&
      !t.refundOf &&
      (t.accountId === n.accountId ||
        (t.type === "transfer" && t.destinationId === n.accountId) ||
        (!!n.cardId && t.cardId === n.cardId)) &&
      (t.notificationImportedAt
        ? Math.abs(t.notificationImportedAt - n.postedAt) <= 120000
        : !t.notificationImportId),
  );
}
export const noticeHash = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

export function possibleInternalTransfer(
  data: Data,
  n: BankNotice,
  p: ParsedNotice,
) {
  if (p.type !== "income" || p.purchase) return undefined;
  return data.transactions.find(
    (t) =>
      t.type === "expense" &&
      t.paid &&
      !t.cardId &&
      !t.refundOf &&
      !t.invoicePayment &&
      t.notificationImportId &&
      t.notificationImportedAt &&
      t.accountId !== n.accountId &&
      t.date === p.date &&
      t.amount === p.amount &&
      Math.abs(t.notificationImportedAt - n.postedAt) <= 120000,
  );
}
export function confirmInternalTransfer(
  data: Data,
  n: BankNotice,
  p: ParsedNotice,
): Data {
  const original = possibleInternalTransfer(data, n, p);
  if (!original || !data.accounts.some((a) => a.id === n.accountId))
    throw new Error("Não foi possível vincular esta transferência.");
  const next = {
    ...data,
    transactions: data.transactions.map((t) =>
      t.id === original.id
        ? {
            ...t,
            type: "transfer" as const,
            destinationId: n.accountId,
            categoryId: "",
            title: "Transferência entre minhas contas",
          }
        : t,
    ),
  };
  if (!validateData(next))
    throw new Error("Confira as contas da transferência.");
  return next;
}
