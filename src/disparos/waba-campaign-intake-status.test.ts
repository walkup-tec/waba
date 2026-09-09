import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignIntakeDisplayOptionsFromBroadcast,
  toCampaignIntakeDisplayStatus,
} from "./waba-campaign-intake-status";

describe("status visível da campanha", () => {
  it("antes de Confirmar início não usa status automático da Meta", () => {
    const lab = campaignIntakeDisplayOptionsFromBroadcast(true, null);
    assert.equal(toCampaignIntakeDisplayStatus("generated", "operacional", lab), "Aguardando configuração");
    assert.equal(toCampaignIntakeDisplayStatus("generated", "subscriber", lab), "Gerada");
  });

  it("depois do início, sem disparo Cloud, mostra análise do template", () => {
    const lab = campaignIntakeDisplayOptionsFromBroadcast(true, null);
    assert.equal(
      toCampaignIntakeDisplayStatus("in_progress", "operacional", lab),
      "Meta analisando template",
    );
    assert.equal(
      toCampaignIntakeDisplayStatus("in_progress", "subscriber", lab),
      "Meta analisando template",
    );
  });

  it("só coleta relatório da Meta depois que o disparo Cloud termina", () => {
    assert.equal(
      toCampaignIntakeDisplayStatus(
        "in_progress",
        "operacional",
        campaignIntakeDisplayOptionsFromBroadcast(true, { status: "queued" }),
      ),
      "Na fila",
    );
    assert.equal(
      toCampaignIntakeDisplayStatus(
        "in_progress",
        "operacional",
        campaignIntakeDisplayOptionsFromBroadcast(true, {
          status: "running",
          sendStartedAt: "2026-09-07T18:00:00.000Z",
        }),
      ),
      "Enviando",
    );
    assert.equal(
      toCampaignIntakeDisplayStatus(
        "in_progress",
        "operacional",
        campaignIntakeDisplayOptionsFromBroadcast(true, {
          status: "done",
          sendStartedAt: "2026-09-07T18:00:00.000Z",
          sendFinishedAt: "2026-09-07T18:40:00.000Z",
        }),
      ),
      "Coletando relatório da Meta",
    );
  });

  it("campanha fora do Laboratório continua Em andamento após o início", () => {
    assert.equal(
      toCampaignIntakeDisplayStatus(
        "in_progress",
        "operacional",
        campaignIntakeDisplayOptionsFromBroadcast(false, { status: "done" }),
      ),
      "Em andamento",
    );
  });

  it("queued com horário futuro aparece como Agendado", () => {
    assert.equal(
      toCampaignIntakeDisplayStatus(
        "in_progress",
        "operacional",
        campaignIntakeDisplayOptionsFromBroadcast(true, {
          status: "queued",
          scheduledSendAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
      ),
      "Agendado",
    );
  });
});
