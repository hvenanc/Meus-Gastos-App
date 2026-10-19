import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  initialData,
  accountBalance,
  totals,
  validateData,
  moveCardPurchase,
} from "../src/lib/finance.ts";
import {
  type BankNotice,
  parseBankNotice,
  notificationTransaction,
  possibleNotificationDuplicate,
  noticeHash,
} from "../src/lib/bankNotifications.ts";
import {
  mergeFinance,
  SyncConflict,
  decodeCloud,
} from "../src/lib/syncMerge.ts";
const fixture = () => {
  const data = structuredClone(initialData);
  data.accounts = [
    { id: "a", bank: "nubank", name: "Nubank", initialBalance: 100000 },
  ];
  data.cards = [
    {
      id: "c",
      bank: "nubank",
      name: "Crédito",
      accountId: "a",
      limit: 500000,
      closingDay: 20,
      dueDay: 5,
    },
  ];
  return data;
};
const event = (title: string, text: string): BankNotice => ({
  id: noticeHash(title + text),
  packageName: "com.nu.production",
  postedAt: new Date(2026, 9, 25, 12).getTime(),
  title,
  text,
  context: "alice:initial",
  accountId: "a",
  cardId: "c",
});
test("Pix recebido/enviado importa em centavos, com origem e sem duplicar reenvios", () => {
  const data = fixture(),
    received = event(
      "Pix recebido",
      "Você recebeu um Pix de R$ 1.250,99 de Ana.",
    );
  const parsed = parseBankNotice(received)!;
  assert.equal(parsed.type, "income");
  assert.equal(parsed.amount, 125099);
  assert.match(parsed.title, /Ana/);
  const transaction = notificationTransaction(data, received, parsed)!;
  data.transactions.push(transaction);
  assert.equal(accountBalance(data, "a"), 225099);
  assert.equal(notificationTransaction(data, received, parsed), null);
  assert.equal(
    decodeCloud({
      schemaVersion: 1,
      revision: 1,
      payload: JSON.stringify(data),
    }).data.transactions[0].notificationImportId,
    received.id,
  );
  const sent = event("Pix enviado", "Pix enviado de R$ 20,00 para Maria.");
  assert.equal(parseBankNotice(sent)!.type, "expense");
});
test("compra no cartão usa fatura, débito usa conta e origem é preservada ao editar", () => {
  const data = fixture(),
    n = event(
      "Compra aprovada",
      "Compra aprovada no crédito de R$ 50,00 em LOJA.",
    );
  const parsed = parseBankNotice(n)!;
  assert.match(parsed.title, /LOJA/);
  const t = notificationTransaction(data, n, parsed)!;
  data.transactions.push(t);
  assert.equal(t.cardId, "c");
  assert.equal(t.paid, false);
  assert.equal(t.invoiceMonth, "2026-12");
  assert.equal(accountBalance(data, "a"), 100000);
  assert.equal(totals(data, "2026-12").expense, 5000);
  const edited = moveCardPurchase(data, t, { ...t, title: "Loja editada" });
  assert.equal(edited.notificationImportId, n.id);
  const debit = event(
    "Compra realizada",
    "Compra realizada no débito de R$ 25,00 em MERCADO.",
  );
  const d = notificationTransaction(data, debit, parseBankNotice(debit)!)!;
  assert.equal(d.cardId, undefined);
  assert.equal(d.paid, true);
});
test("publicidade, OTP, saldo, agendamento, falha e fatura não alteram as finanças", () => {
  for (const [title, text] of [
    ["Código de acesso", "Seu código é 123456. Confirme Pix enviado R$ 100,00"],
    ["Oferta", "Oferta! Compra aprovada ganha R$ 50,00"],
    ["Saldo disponível", "Seu saldo disponível é R$ 100,00"],
    [
      "Limite aumentado",
      "Você recebeu R$ 1.000,00 de limite para suas compras",
    ],
    ["Pix agendado", "Pix enviado R$ 50,00 agendado para amanhã"],
    ["Pix não concluído", "Pix enviado R$ 20,00 não foi concluído"],
    ["Pagamento da fatura", "Pagamento realizado R$ 500,00 da fatura"],
    ["Compra estornada", "Compra aprovada R$ 100,00 foi estornada"],
  ])
    assert.equal(parseBankNotice(event(title, text)), null);
  const unknown = {
    ...event("Pix recebido", "Pix recebido R$ 20,00"),
    packageName: "app.desconhecido",
  };
  assert.equal(parseBankNotice(unknown), null);
});
test("valores ambíguos, compras sem cartão e parcelas exigem confirmação", () => {
  const data = fixture(),
    n = event("Pix recebido", "Pix recebido R$ 50,00. Saldo atual R$ 150,00.");
  const p = parseBankNotice(n)!;
  assert.equal(p.confidence, "review");
  assert.equal(notificationTransaction(data, n, p), null);
  assert.ok(notificationTransaction(data, n, p, true));
  const cardless = {
    ...event("Compra aprovada", "Compra aprovada R$ 10,00 em Loja"),
    cardId: "",
  };
  assert.equal(
    notificationTransaction(data, cardless, parseBankNotice(cardless)!),
    null,
  );
  const installments = event(
    "Compra aprovada",
    "Compra aprovada R$ 100,00 em 3 parcelas",
  );
  assert.equal(parseBankNotice(installments)!.confidence, "review");
});
test("possível duplicado manual ou de outro aparelho vai para revisão; concorrência não duplica na nuvem", () => {
  const base = fixture(),
    n = event("Pix enviado", "Pix enviado R$ 30,00 para Ana"),
    p = parseBankNotice(n)!;
  const a = structuredClone(base),
    b = structuredClone(base);
  a.transactions.push(notificationTransaction(a, n, p)!);
  const another = {
    ...n,
    id: noticeHash("outro-aparelho"),
    postedAt: n.postedAt + 1000,
  };
  assert.equal(possibleNotificationDuplicate(a, another, p), true);
  b.transactions.push(notificationTransaction(b, another, p)!);
  assert.throws(() => mergeFinance(base, a, b), SyncConflict);
  const merged = mergeFinance(base, a, a);
  assert.equal(merged.transactions.length, 1);
  const next = {
    ...n,
    id: noticeHash("legitimo-confirmado"),
    postedAt: n.postedAt + 1000,
  };
  const approved = structuredClone(a);
  approved.transactions.push(notificationTransaction(approved, next, p, true)!);
  assert.equal(mergeFinance(base, approved, a).transactions.length, 2);
  a.transactions[0].notificationImportedAt = NaN;
  assert.equal(validateData(a), false);
});

test("par de Pix entre contas requer confirmação e não infla receitas/despesas", async () => {
  const { possibleInternalTransfer, confirmInternalTransfer } =
    await import("../src/lib/bankNotifications.ts");
  const data = fixture();
  data.accounts.push({
    id: "b",
    name: "Inter",
    bank: "inter",
    initialBalance: 0,
  });
  const sent = event("Pix enviado", "Pix enviado R$ 100,00 para minha conta");
  data.transactions.push(
    notificationTransaction(data, sent, parseBankNotice(sent)!)!,
  );
  const received = {
    ...event("Pix recebido", "Pix recebido R$ 100,00 da minha conta"),
    accountId: "b",
    cardId: "",
  };
  const p = parseBankNotice(received)!;
  assert.ok(possibleInternalTransfer(data, received, p));
  const next = confirmInternalTransfer(data, received, p);
  assert.equal(accountBalance(next, "a"), 90000);
  assert.equal(accountBalance(next, "b"), 10000);
  assert.deepEqual(totals(next, p.date.slice(0, 7)), { income: 0, expense: 0 });
  assert.equal(possibleNotificationDuplicate(next, received, p), true);
});

test("compra explicitamente no crédito ou com cartão removido não vira débito em conta", () => {
  const data = fixture();
  const n = {
    ...event("Compra aprovada", "Compra aprovada no crédito R$ 50,00 em LOJA"),
    cardId: "",
  };
  assert.equal(
    notificationTransaction(data, n, parseBankNotice(n)!, true),
    null,
  );
  const missing = { ...n, cardId: "card-removed" };
  assert.equal(
    notificationTransaction(data, missing, parseBankNotice(missing)!, true),
    null,
  );
});
