import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatScheduledSendLabel,
  isScheduledSendPending,
  parseScheduledSendAt,
} from "./waba-campaign-schedule";

describe("Agendamento de disparo Oficial", () => {
  it("grava ISO e rejeita horário passado", () => {
    const future = new Date(Date.now() + 120_000).toISOString();
    assert.equal(parseScheduledSendAt(future, { requireFuture: true }), future);
    assert.equal(parseScheduledSendAt("", { requireFuture: true }), "");
    assert.throws(
      () => parseScheduledSendAt(new Date(Date.now() - 1_000).toISOString(), { requireFuture: true }),
      /1 minuto/,
    );
    assert.throws(() => parseScheduledSendAt("nao-e-data", { requireFuture: true }), /válidas/);
  });

  it("pendente só enquanto a hora agendada não chegou", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(isScheduledSendPending(future), true);
    assert.equal(isScheduledSendPending(past), false);
    assert.equal(isScheduledSendPending(""), false);
  });

  it("formata tag em pt-BR", () => {
    const label = formatScheduledSendLabel("2026-09-10T21:00:00.000Z");
    assert.match(label, /10\/09\/2026/);
    assert.match(label, /18:00/);
  });
});
