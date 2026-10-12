import { validDate } from "./finance.ts";

/** Calendar dates stay in ISO in storage and are localized at the UI boundary. */
export function formatBrazilianDate(iso: string): string {
  if (!validDate(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function parseBrazilianDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error("Informe uma data válida no formato DD/MM/AAAA.");
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  if (!validDate(iso))
    throw new Error("Informe uma data válida no formato DD/MM/AAAA.");
  return iso;
}

export function maskBrazilianDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}
