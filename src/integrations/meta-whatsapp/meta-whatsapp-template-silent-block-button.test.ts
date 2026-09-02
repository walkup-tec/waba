import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_SILENT_BLOCK_BUTTON_TEXT,
  appendSilentBlockButton,
  isSilentBlockButton,
  stripSilentBlockButtonsFromPublicComponents,
} from "./meta-whatsapp-template-silent-block-button";

function buttonsOf(components: Record<string, unknown>[]): Record<string, unknown>[] {
  const row = components.find((item) => String(item.type) === "BUTTONS");
  return Array.isArray(row?.buttons) ? (row.buttons as Record<string, unknown>[]) : [];
}

describe("botão silencioso Bloquear", () => {
  it("cria BUTTONS só com Bloquear quando o usuário não configurou botão", () => {
    const next = appendSilentBlockButton([{ type: "BODY", text: "Olá" }]);
    const buttons = buttonsOf(next);
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0]?.type, "QUICK_REPLY");
    assert.equal(buttons[0]?.text, META_SILENT_BLOCK_BUTTON_TEXT);
  });

  it("mantém o botão do usuário e acrescenta Bloquear agrupado depois dos não-QR", () => {
    const next = appendSilentBlockButton([
      { type: "BODY", text: "Olá" },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Ver Detalhes", url: "https://waba.draxsistemas.com.br/s/walkup1" }],
      },
    ]);
    const buttons = buttonsOf(next);
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0]?.type, "URL");
    assert.equal(buttons[0]?.text, "Ver Detalhes");
    assert.equal(buttons[1]?.type, "QUICK_REPLY");
    assert.equal(buttons[1]?.text, "Bloquear");
  });

  it("é idempotente se Bloquear já existir e reagrupa URL + QR", () => {
    const next = appendSilentBlockButton([
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Bloquear" },
          { type: "URL", text: "Saiba Mais", url: "https://example.com/s/a" },
          { type: "QUICK_REPLY", text: "bloquear" },
        ],
      },
    ]);
    const buttons = buttonsOf(next);
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0]?.type, "URL");
    assert.equal(buttons[1]?.text, "Bloquear");
    assert.equal(buttons.filter((item) => isSilentBlockButton(item)).length, 1);
  });

  it("remove Bloquear do DTO público e apaga BUTTONS se só restava esse botão", () => {
    const stripped = stripSilentBlockButtonsFromPublicComponents([
      { type: "BODY", text: "Olá" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Ver Detalhes", url: "https://example.com/s/a" },
          { type: "QUICK_REPLY", text: "Bloquear" },
        ],
      },
    ]);
    assert.ok(Array.isArray(stripped));
    const buttons = buttonsOf(stripped as Record<string, unknown>[]);
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0]?.text, "Ver Detalhes");

    const onlySilent = stripSilentBlockButtonsFromPublicComponents([
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Bloquear" }] },
    ]);
    assert.ok(Array.isArray(onlySilent));
    assert.equal((onlySilent as unknown[]).length, 0);
  });
});
