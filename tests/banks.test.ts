import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { banks, getBank, searchBanks, bankAliases } from "../src/data/banks.ts";

const root = new URL("../assets/banks/organizze/", import.meta.url);
const institutions = JSON.parse(
  readFileSync(new URL("institutions.json", root), "utf8"),
);

test("every supplied institution is available without duplicate IDs", () => {
  assert.equal(banks.length, institutions.length);
  assert.equal(new Set(banks.map((bank) => bank.id)).size, banks.length);
  for (const institution of institutions) {
    assert.equal(
      getBank(institution.id).id,
      bankAliases[institution.id] ?? institution.id,
    );
  }
});

test("saved identifiers retain their banks and imported IDs resolve to them", () => {
  for (const [incoming, saved] of Object.entries(bankAliases)) {
    assert.equal(getBank(saved), getBank(incoming));
  }
  assert.equal(getBank("unknown-bank").id, "other");
  assert.equal(getBank("bancodobrasil").name, "Banco do Brasil");
});

test("bank search supports accents, aliases, keywords and wallet exclusion", () => {
  assert(searchBanks("itau").some((bank) => bank.id === "itau"));
  assert(searchBanks("  BRASÍLIA  ").some((bank) => bank.id === "brasilia"));
  assert(searchBanks("cef").some((bank) => bank.id === "caixa"));
  assert(searchBanks("intermedium").some((bank) => bank.id === "inter"));
  assert(!searchBanks("", false).some((bank) => bank.id === "wallet"));
  assert.deepEqual(
    searchBanks("not-a-real-institution").map((bank) => bank.id),
    ["other"],
  );
});

test("every supplied logo is downloaded and statically bundled for offline use", () => {
  const source = readFileSync(
    new URL("../src/data/bankLogos.ts", import.meta.url),
    "utf8",
  );
  const sources = JSON.parse(
    readFileSync(new URL("sources.json", root), "utf8"),
  );
  assert.equal(sources.length, 446);
  for (const institution of institutions.filter(
    (item: { logo_url: string }) => item.logo_url,
  )) {
    const record = sources.find(
      (item: { id: string }) => item.id === institution.id,
    );
    assert(record && !record.error, institution.id);
    const filename = record.file;
    assert(existsSync(new URL(filename, root)), filename);
    const bytes = readFileSync(new URL(filename, root));
    assert(
      bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ||
        bytes.subarray(0, 2).toString("hex") === "ffd8",
    );
    assert(source.includes(`organizze/${filename}`), filename);
  }
});
