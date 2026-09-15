import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLeadsForCampaignLista } from "./waba-leads-cnpj-excel.service";
import { pickCampaignHistoryLists } from "./waba-leads-cnpj.service";
import type { WabaLeadsCnpjList } from "./waba-leads-cnpj.types";

function lead(cnpj: string, telefone: string, nome = "Empresa") {
  return {
    cnpj,
    nome,
    telefone,
    email: "",
    situacao: "Ativa",
    dataAbertura: "",
    cidade: "",
    estado: "",
    endereco: "",
  };
}

function list(partial: Partial<WabaLeadsCnpjList> & { id: string }): WabaLeadsCnpjList {
  const now = "2026-09-15T10:00:00.000Z";
  return {
    name: "Cobrança",
    status: "ready",
    source: "portal",
    filters: {},
    leads: [],
    leadCount: 0,
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
    exportFileName: null,
    error: null,
    createdByEmail: "master@local",
    campaignKey: "portal:cobrança",
    ...partial,
  };
}

describe("Leads PJ Lista acumulada", () => {
  it("junta lotes da mesma pesquisa e remove CNPJ+telefone repetido", () => {
    const merged = mergeLeadsForCampaignLista([
      {
        leads: [lead("11222333000181", "11987654321"), lead("11222333000181", "11987654321")],
      },
      {
        leads: [lead("99888777000166", "21998877665")],
      },
    ]);
    assert.equal(merged.length, 2);
    assert.ok(merged.some((row) => row.cnpj.replace(/\D/g, "") === "11222333000181"));
    assert.ok(merged.some((row) => row.cnpj.replace(/\D/g, "") === "99888777000166"));
  });

  it("ignora lote de continuação da cópia do portal", () => {
    const merged = mergeLeadsForCampaignLista([
      { dayKey: "2026-09-15#portal-copy", leads: [lead("11222333000181", "11987654321")] },
      { dayKey: "2026-09-15", leads: [lead("99888777000166", "21998877665")] },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].cnpj.replace(/\D/g, ""), "99888777000166");
  });

  it("mostra uma linha por pesquisa no histórico", () => {
    const rows = pickCampaignHistoryLists([
      list({
        id: "lote-1",
        status: "ready",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
      }),
      list({
        id: "lote-20",
        status: "stopped",
        createdAt: "2026-09-15T10:00:00.000Z",
        updatedAt: "2026-09-15T12:00:00.000Z",
      }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "lote-20");
  });
});
