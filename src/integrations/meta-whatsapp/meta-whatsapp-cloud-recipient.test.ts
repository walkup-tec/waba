import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { inspectMetaBroadcastTemplate, resolveBroadcastColumnMapping } from "./meta-whatsapp-broadcast-template";
import {
  guessMetaBroadcastPhoneColumn,
  parseMetaBroadcastLeads,
  readMetaBroadcastSheet,
} from "./meta-whatsapp-broadcast-leads";
import { normalizeMetaSpreadsheetRecipient } from "./meta-whatsapp-cloud-recipient";

describe("normalizeMetaSpreadsheetRecipient", () => {
  it("aceita E.164 já no padrão da Meta", () => {
    const got = normalizeMetaSpreadsheetRecipient("5551999887766");
    assert.equal(got.ok, true);
    if (got.ok) assert.equal(got.waId, "5551999887766");
  });

  it("tira máscara, + e 00 e completa DDI 55", () => {
    const masked = normalizeMetaSpreadsheetRecipient("(51) 99988-7766");
    assert.equal(masked.ok, true);
    if (masked.ok) assert.equal(masked.waId, "5551999887766");

    const plus = normalizeMetaSpreadsheetRecipient("+55 51 99988-7766");
    assert.equal(plus.ok, true);
    if (plus.ok) assert.equal(plus.waId, "5551999887766");

    const intlPrefix = normalizeMetaSpreadsheetRecipient("005551999887766");
    assert.equal(intlPrefix.ok, true);
    if (intlPrefix.ok) assert.equal(intlPrefix.waId, "5551999887766");
  });

  it("insere o 9º dígito móvel quando a planilha veio sem ele", () => {
    const got = normalizeMetaSpreadsheetRecipient("5182001261");
    assert.equal(got.ok, true);
    if (got.ok) assert.equal(got.waId, "5551982001261");
  });

  it("lê número vindo do Excel como inteiro", () => {
    const got = normalizeMetaSpreadsheetRecipient(5551999887766);
    assert.equal(got.ok, true);
    if (got.ok) assert.equal(got.waId, "5551999887766");
  });

  it("lê notação científica do Excel e zero de tronco", () => {
    const sci = normalizeMetaSpreadsheetRecipient("5.551999887766e+12");
    assert.equal(sci.ok, true);
    if (sci.ok) assert.equal(sci.waId, "5551999887766");

    const trunk = normalizeMetaSpreadsheetRecipient("051 99988-7766");
    assert.equal(trunk.ok, true);
    if (trunk.ok) assert.equal(trunk.waId, "5551999887766");
  });

  it("recusa vazio", () => {
    const got = normalizeMetaSpreadsheetRecipient("   ");
    assert.equal(got.ok, false);
  });
});

describe("inspectMetaBroadcastTemplate", () => {
  it("pede coluna de nome só quando o BODY tem variável de nome", () => {
    const got = inspectMetaBroadcastTemplate([
      { type: "BODY", text: "Olá, {{1}}.", example: { body_text: [["Maria"]] } },
      { type: "BUTTONS", buttons: [{ type: "URL", url: "https://wabadisparos.com.br/s/abc1234" }] },
    ]);
    assert.equal(got.bodyVariables[0]?.key, "nome");
    assert.equal(got.urlButton?.slug, "abc1234");
    assert.equal(got.urlButton?.hasVariable, false);
  });

  it("marca URL dinâmica quando o botão tem {{1}}", () => {
    const got = inspectMetaBroadcastTemplate([
      { type: "BODY", text: "Informamos o status." },
      { type: "BUTTONS", buttons: [{ type: "URL", url: "https://wabadisparos.com.br/s/{{1}}" }] },
    ]);
    assert.equal(got.urlButton?.hasVariable, true);
    assert.equal(got.bodyVariables.length, 0);
  });

  it("se houver variável, o mapeamento fica só nome ou só número", () => {
    assert.deepEqual(resolveBroadcastColumnMapping([{ key: "nome" }, { key: "numero" }]), {
      phone: true,
      nome: true,
      numero: false,
      texto: false,
    });
    assert.deepEqual(resolveBroadcastColumnMapping([{ key: "numero" }]), {
      phone: true,
      nome: false,
      numero: true,
      texto: false,
    });
    assert.deepEqual(resolveBroadcastColumnMapping([]), {
      phone: true,
      nome: false,
      numero: false,
      texto: false,
    });
  });
});

describe("parseMetaBroadcastLeads", () => {
  it("normaliza telefones da planilha e ignora duplicata com/sem 9", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      { Nome: "Ana", Telefone: "(51) 99988-7766" },
      { Nome: "Ana 2", Telefone: 5551999887766 },
      { Nome: "Bob", Telefone: "5182001261" },
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Leads");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const parsedSheet = readMetaBroadcastSheet(buffer, "leads.xlsx");
    assert.equal(guessMetaBroadcastPhoneColumn(parsedSheet.columns), "Telefone");
    const parsed = parseMetaBroadcastLeads({
      sheet: parsedSheet,
      mapping: { phoneColumn: "Telefone", nomeColumn: "Nome" },
      bodyVariables: [{ index: 1, key: "nome", label: "Variável Nome" }],
    });
    assert.equal(parsed.duplicatesRemoved, 1);
    assert.equal(parsed.leads.length, 2);
    assert.equal(parsed.leads[0]?.waId, "5551999887766");
    assert.equal(parsed.leads[0]?.nome, "Ana");
    assert.equal(parsed.leads[1]?.waId, "5551982001261");
  });
});
