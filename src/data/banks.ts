export const otherBank = {
  id: "other",
  name: "Outro banco",
  color: "#526777",
  mark: "",
};

export const banks = [
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
export const getBank = (id: string) =>
  banks.find((b) => b.id === id) ?? otherBank;
