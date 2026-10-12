import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  formatBrazilianDate,
  parseBrazilianDate,
  maskBrazilianDate,
} from "../src/lib/dates.ts";
test("datas brasileiras preservam dia e mês sem conversão de fuso", () => {
  assert.equal(formatBrazilianDate("2026-10-11"), "11/10/2026");
  assert.equal(parseBrazilianDate("11/10/2026"), "2026-10-11");
  assert.equal(parseBrazilianDate("01/12/2026"), "2026-12-01");
  assert.equal(formatBrazilianDate("2026-12-01"), "01/12/2026");
});
test("valida dias inexistentes, ano bissexto e formato de entrada", () => {
  assert.equal(parseBrazilianDate("29/02/2024"), "2024-02-29");
  for (const date of [
    "29/02/2026",
    "31/04/2026",
    "11/13/2026",
    "00/10/2026",
    "1/1/2026",
    "2026-10-11",
    "texto",
  ])
    assert.throws(() => parseBrazilianDate(date), /DD\/MM\/AAAA/);
  assert.equal(formatBrazilianDate("2026-02-30"), "");
});
test("máscara funciona com digitação, exclusão e colagem", () => {
  assert.equal(maskBrazilianDate("1"), "1");
  assert.equal(maskBrazilianDate("111"), "11/1");
  assert.equal(maskBrazilianDate("11102026"), "11/10/2026");
  assert.equal(maskBrazilianDate("11/10/2026"), "11/10/2026");
  assert.equal(maskBrazilianDate("11/10/202"), "11/10/202");
  assert.equal(maskBrazilianDate(""), "");
});
