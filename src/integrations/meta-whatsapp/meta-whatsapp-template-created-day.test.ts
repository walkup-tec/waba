import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  localCalendarDateKey,
  shiftedLocalDateKey,
  templateCreatedAtIso,
  templateMatchesCreatedDay,
} from "./meta-whatsapp-template-created-day";

describe("filtro de cadastro Hoje/Ontem", () => {
  const noonLocal = new Date(2026, 8, 10, 12, 0, 0);

  it("calcula hoje e ontem no calendário local", () => {
    assert.equal(shiftedLocalDateKey(0, noonLocal), "2026-09-10");
    assert.equal(shiftedLocalDateKey(-1, noonLocal), "2026-09-09");
  });

  it("casa createdAt com o dia local", () => {
    const today = new Date(2026, 8, 10, 15, 30, 0);
    const yesterday = new Date(2026, 8, 9, 23, 15, 0);
    const todayKey = localCalendarDateKey(today);
    assert.equal(templateMatchesCreatedDay(today.toISOString(), todayKey), true);
    assert.equal(templateMatchesCreatedDay(yesterday.toISOString(), todayKey), false);
    assert.equal(templateMatchesCreatedDay("", todayKey), false);
    assert.equal(templateMatchesCreatedDay(yesterday.toISOString(), ""), true);
  });

  it("converte ISO inválido em chave vazia", () => {
    assert.equal(localCalendarDateKey("nao-e-data"), "");
  });

  it("não usa a data de sincronização como criação", () => {
    assert.equal(
      templateCreatedAtIso({
        createdAt: "2026-09-08T12:00:00.000Z",
        lastSyncedAt: "2026-09-10T12:00:00.000Z",
      }),
      "2026-09-08T12:00:00.000Z",
    );
    assert.equal(
      templateCreatedAtIso({
        createdAt: null,
        lastSyncedAt: "2026-09-10T12:00:00.000Z",
      }),
      "",
    );
    assert.equal(
      templateMatchesCreatedDay(
        templateCreatedAtIso({ createdAt: null, lastSyncedAt: "2026-09-10T12:00:00.000Z" }),
        "2026-09-10",
      ),
      false,
    );
  });
});
