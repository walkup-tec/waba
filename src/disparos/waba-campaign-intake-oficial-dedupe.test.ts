import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { readMetaBroadcastSheet } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads";
import { dedupeOfficialCampaignLeadsFile } from "./waba-campaign-intake-oficial-dedupe";

function xlsxPhones(phones: Array<string | Record<string, unknown>>): Buffer {
  const rows = phones.map((item, index) =>
    typeof item === "string" ? { nome: `Lead ${index + 1}`, telefone: item } : item,
  );
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("dedupe da planilha Oficial do assinante", () => {
  it("remove o mesmo WhatsApp com e sem o 9º dígito", () => {
    const got = dedupeOfficialCampaignLeadsFile(
      xlsxPhones(["51999666841", "5551999666841", "51 99966-6841", "5181077770"]),
      "leads.xlsx",
    );
    assert.equal(got.uniqueCount, 2);
    assert.equal(got.duplicatesRemoved, 2);
    const written = readMetaBroadcastSheet(got.buffer, "leads.xlsx");
    assert.equal(written.rows.length, 2);
  });

  it("deduplica TXT linha a linha", () => {
    const got = dedupeOfficialCampaignLeadsFile(
      Buffer.from("5551999666841\n51999666841\n5551981077770\n", "utf8"),
      "leads.txt",
    );
    assert.equal(got.uniqueCount, 2);
    assert.equal(got.duplicatesRemoved, 1);
  });

  it("não altera lista já única", () => {
    const got = dedupeOfficialCampaignLeadsFile(
      xlsxPhones(["5551999666841", "5551981077770"]),
      "leads.xlsx",
    );
    assert.equal(got.uniqueCount, 2);
    assert.equal(got.duplicatesRemoved, 0);
  });

  it("ignora linha sem telefone", () => {
    const got = dedupeOfficialCampaignLeadsFile(
      xlsxPhones(["5551999666841", { nome: "Vazio", telefone: "" }, "5551999666841"]),
      "leads.xlsx",
    );
    assert.equal(got.uniqueCount, 1);
    assert.equal(got.duplicatesRemoved, 1);
  });

  it("corta o arquivo único ao limite de envios sem perder o cabeçalho TXT", () => {
    const got = dedupeOfficialCampaignLeadsFile(
      Buffer.from("nome;telefone\nA;5551999666841\nB;51999666841\nC;5551981077770\n", "utf8"),
      "leads.txt",
      1,
    );
    assert.equal(got.uniqueCount, 2);
    assert.equal(got.duplicatesRemoved, 1);
    const text = got.buffer.toString("utf8");
    assert.match(text, /^nome;telefone\n/);
    assert.match(text, /5551999666841/);
    assert.doesNotMatch(text, /5551981077770/);
  });
});
