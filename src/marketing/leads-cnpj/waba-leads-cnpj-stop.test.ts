import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLeadsCnpjSearchRunning, WabaLeadsCnpjService } from "./waba-leads-cnpj.service";

describe("Leads PJ Parar", () => {
  it("considera busca em andamento só enquanto coleta, enriquece ou espera na fila", () => {
    assert.equal(isLeadsCnpjSearchRunning("scraping"), true);
    assert.equal(isLeadsCnpjSearchRunning("enriching"), true);
    assert.equal(isLeadsCnpjSearchRunning("queued"), true);
    assert.equal(isLeadsCnpjSearchRunning("draft"), true);
    assert.equal(isLeadsCnpjSearchRunning("ready"), false);
    assert.equal(isLeadsCnpjSearchRunning("failed"), false);
    assert.equal(isLeadsCnpjSearchRunning("stopped"), false);
    assert.equal(isLeadsCnpjSearchRunning(""), false);
  });

  it("recusa parar uma lista que não existe", () => {
    const service = new WabaLeadsCnpjService();
    assert.throws(() => service.stopCampaignSearch("lista-inexistente"), /não encontrada/i);
  });
});
