import { bankInstitutions } from "./bankInstitutions.ts";

export const otherBank = {
  id: "other",
  name: "Outro banco",
  color: "#526777",
  mark: "",
  keywords: [] as string[],
};

const legacyBanks = [
  otherBank,
  { id: "wallet", name: "Carteira", color: "#47584e", mark: "$" },
  { id: "nubank", name: "Nubank", color: "#820ad1", mark: "nu" },
  { id: "itau", name: "Itaú", color: "#ec7000", mark: "itaú" },
  { id: "bradesco", name: "Bradesco", color: "#cc092f", mark: "br" },
  { id: "santander", name: "Santander", color: "#ec0000", mark: "S" },
  {
    id: "bancodobrasil",
    name: "Banco do Brasil",
    color: "#f8d117",
    mark: "BB",
  },
  { id: "caixa", name: "Caixa Econômica", color: "#005ca9", mark: "X" },
  { id: "inter", name: "Banco Inter", color: "#ff7a00", mark: "inter" },
  { id: "c6bank", name: "C6 Bank", color: "#242424", mark: "C6" },
  { id: "btgpactual", name: "BTG Pactual", color: "#12366a", mark: "btg" },
  { id: "picpay", name: "PicPay", color: "#21c25e", mark: "P" },
  { id: "mercadopago", name: "Mercado Pago", color: "#009ee3", mark: "mp" },
  { id: "sicredi", name: "Sicredi", color: "#33820d", mark: "✳" },
  { id: "sicoob", name: "Sicoob", color: "#005b50", mark: "S" },
  { id: "safra", name: "Safra", color: "#182b51", mark: "Safra" },
  { id: "neon", name: "Neon", color: "#00b9d8", mark: "neon" },
  { id: "original", name: "Banco Original", color: "#00a857", mark: "O" },
  { id: "pagbank", name: "PagBank", color: "#04714b", mark: "P" },
  { id: "banrisul", name: "Banrisul", color: "#005da5", mark: "" },
  { id: "banestes", name: "Banestes", color: "#008647", mark: "" },
  { id: "nordeste", name: "Banco do Nordeste", color: "#b2262d", mark: "" },
  {
    id: "brasilia",
    name: "BRB · Banco de Brasília",
    color: "#003c85",
    mark: "",
  },
  { id: "amazonia", name: "Banco da Amazônia", color: "#006847", mark: "" },
];

export type Bank = {
  id: string;
  name: string;
  color: string;
  mark: string;
  keywords: string[];
};

// Keep identifiers already stored in accounts, cards and investments.
export const bankAliases: Record<string, string> = {
  bb: "bancodobrasil",
  intermedium: "inter",
  brb: "brasilia",
  carteira: "wallet",
};

const canonicalId = (id: string) => bankAliases[id] ?? id;
const legacyById = new Map(legacyBanks.map((bank) => [bank.id, bank]));
const importedBanks: Bank[] = bankInstitutions.map((institution) => {
  const id = canonicalId(institution.id);
  const legacy = legacyById.get(id);
  return {
    id,
    name: legacy?.name ?? (id === "default" ? "Padrão" : institution.name),
    color: legacy?.color ?? "#526777",
    mark: legacy?.mark ?? "",
    keywords: [institution.id, ...institution.keywords],
  };
});
const importedById = new Map(importedBanks.map((bank) => [bank.id, bank]));
export const banks: Bank[] = [
  ...legacyBanks.map(
    (bank) => importedById.get(bank.id) ?? { ...bank, keywords: [] },
  ),
  ...importedBanks.filter((bank) => !legacyById.has(bank.id)),
];
const banksById = new Map(banks.map((bank) => [bank.id, bank]));
export const getBank = (id: string) =>
  banksById.get(canonicalId(id)) ?? otherBank;

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function searchBanks(query: string, includeWallet = true): Bank[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return banks.filter((bank) => {
    if (!includeWallet && bank.id === "wallet") return false;
    if (bank.id === "other") return true;
    const text = normalizeSearch(
      [bank.id, bank.name, ...bank.keywords].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
}
