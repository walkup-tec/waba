import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { readMetaBroadcastSheet } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads";
import {
  metaSpreadsheetRecipientDedupeKey,
  normalizeMetaSpreadsheetRecipient,
} from "../integrations/meta-whatsapp/meta-whatsapp-cloud-recipient";
import { parseOfficialCampaignLeadsUnique } from "./waba-campaign-intake-oficial-dedupe";
import {
  OFICIAL_CAMPAIGN_CONTROL_PHONES,
  ensureOficialCampaignControlPhones,
  ensureOficialControlPhonesInLeadsBuffer,
  writeOficialCampaignLeadsForDispatch,
} from "./waba-campaign-oficial-control-phones";

function xlsxPhones(phones: string[]): Buffer {
  const rows = phones.map((telefone, index) => ({ nome: `Lead ${index + 1}`, telefone }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function canonical(raw: string): string {
  const normalized = normalizeMetaSpreadsheetRecipient(raw);
  if (!normalized.ok) return raw.replace(/\D/g, "");
  return metaSpreadsheetRecipientDedupeKey(normalized.waId);
}

function countKeys(phones: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const phone of phones) {
    const key = canonical(phone);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sheetPhones(sheet: { rows: Array<Record<string, unknown>> }, column = "telefone"): string[] {
  return sheet.rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean);
}

function sequentialRandomInt(): (min: number, max: number) => number {
  let n = 0;
  return (min, max) => {
    const span = Math.max(1, max - min);
    const value = min + (n % span);
    n += 1;
    return value;
  };
}

describe("números de controle da API Oficial", () => {
  it("substitui 6 linhas aleatórias e preserva a multiplicidade, inclusive o número repetido", () => {
    const phones = Array.from({ length: 12 }, (_, index) => `1198888${String(index + 1).padStart(4, "0")}`);
    const unique = parseOfficialCampaignLeadsUnique(xlsxPhones(phones), "leads.xlsx");
    const ensured = ensureOficialCampaignControlPhones(unique.sheet, {
      randomInt: sequentialRandomInt(),
    });
    assert.equal(ensured.rows.length, 12);
    const got = countKeys(sheetPhones(ensured));
    const required = countKeys([...OFICIAL_CAMPAIGN_CONTROL_PHONES]);
    for (const [key, count] of required) {
      assert.equal(got.get(key), count, `controle ${key}`);
    }
    assert.equal(got.get(canonical("5193388993")), 2);
    const originalsLeft = sheetPhones(ensured).filter(
      (phone) => !required.has(canonical(phone)),
    );
    assert.equal(originalsLeft.length, 6);
  });

  it("é idempotente: segunda passagem não troca mais linhas do assinante", () => {
    const phones = Array.from({ length: 10 }, (_, index) => `1197777${String(index + 1).padStart(4, "0")}`);
    const unique = parseOfficialCampaignLeadsUnique(xlsxPhones(phones), "leads.xlsx");
    const first = ensureOficialCampaignControlPhones(unique.sheet, { randomInt: sequentialRandomInt() });
    const snapshot = sheetPhones(first).join("|");
    const second = ensureOficialCampaignControlPhones(first, { randomInt: sequentialRandomInt() });
    assert.equal(sheetPhones(second).join("|"), snapshot);
  });

  it("completa a base quando há menos de 6 leads", () => {
    const unique = parseOfficialCampaignLeadsUnique(xlsxPhones(["11966660001", "11966660002"]), "leads.xlsx");
    const ensured = ensureOficialCampaignControlPhones(unique.sheet);
    assert.equal(ensured.rows.length, 6);
    const got = countKeys(sheetPhones(ensured));
    const required = countKeys([...OFICIAL_CAMPAIGN_CONTROL_PHONES]);
    for (const [key, count] of required) {
      assert.equal(got.get(key), count);
    }
  });

  it("grava os números no xlsx/txt que o operacional baixa e não some na segunda leitura", () => {
    const phones = Array.from({ length: 8 }, (_, index) => `1195555${String(index + 1).padStart(4, "0")}`);
    const unique = parseOfficialCampaignLeadsUnique(xlsxPhones(phones), "leads.xlsx");
    const xlsx = writeOficialCampaignLeadsForDispatch(unique.sheet, "leads.xlsx", 8, {
      randomInt: sequentialRandomInt(),
    });
    const xlsxSheet = readMetaBroadcastSheet(xlsx, "leads.xlsx");
    assert.equal(countKeys(sheetPhones(xlsxSheet)).get(canonical("5193388993")), 2);

    const again = ensureOficialControlPhonesInLeadsBuffer(xlsx, "leads.xlsx", {
      randomInt: sequentialRandomInt(),
    });
    assert.equal(
      sheetPhones(readMetaBroadcastSheet(again, "leads.xlsx")).join("|"),
      sheetPhones(xlsxSheet).join("|"),
    );

    const txt = writeOficialCampaignLeadsForDispatch(unique.sheet, "leads.txt", 8, {
      randomInt: sequentialRandomInt(),
    });
    const txtSheet = readMetaBroadcastSheet(txt, "leads.txt");
    assert.equal(countKeys(sheetPhones(txtSheet)).get(canonical("5197462102")), 1);
    assert.match(txt.toString("utf8"), /5199666841/);
  });

  it("não perde os números de controle ao cortar pelo volume de envios", () => {
    const phones = Array.from({ length: 20 }, (_, index) => `1194444${String(index + 1).padStart(4, "0")}`);
    const unique = parseOfficialCampaignLeadsUnique(xlsxPhones(phones), "leads.xlsx");
    const buffer = writeOficialCampaignLeadsForDispatch(unique.sheet, "leads.xlsx", 7);
    const sheet = readMetaBroadcastSheet(buffer, "leads.xlsx");
    assert.equal(sheet.rows.length, 7);
    const required = countKeys([...OFICIAL_CAMPAIGN_CONTROL_PHONES]);
    const got = countKeys(sheetPhones(sheet));
    for (const [key, count] of required) {
      assert.equal(got.get(key), count);
    }
  });
});
