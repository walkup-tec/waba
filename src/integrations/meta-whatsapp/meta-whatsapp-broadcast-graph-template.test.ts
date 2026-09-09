import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickApprovedGraphTemplate,
  shouldAbortBroadcastOnRepeatedTemplateMissing,
} from "./meta-whatsapp-broadcast-graph-template";
import type { MappedGraphTemplate } from "./meta-whatsapp-template-graph.client";

function row(overrides: Partial<MappedGraphTemplate> = {}): MappedGraphTemplate {
  return {
    metaTemplateId: "meta-1",
    name: "paulo_teix_v2_2",
    language: "pt_BR",
    category: "MARKETING",
    status: "APPROVED",
    qualityScore: "GREEN",
    rejectedReason: null,
    components: [{ type: "BODY", text: "Oi" }],
    ...overrides,
  };
}

describe("template Graph no Disparo Cloud", () => {
  it("escolhe o APPROVED no idioma pedido", () => {
    const picked = pickApprovedGraphTemplate(
      [
        row({ language: "en_US" }),
        row({ language: "pt_BR", status: "PENDING" }),
        row({ language: "pt_BR", metaTemplateId: "ok" }),
      ],
      "paulo_teix_v2_2",
      "pt-BR",
    );
    assert.equal(picked?.metaTemplateId, "ok");
  });

  it("não usa PENDING nem outro nome", () => {
    assert.equal(
      pickApprovedGraphTemplate([row({ status: "PENDING" })], "paulo_teix_v2_2", "pt_BR"),
      null,
    );
    assert.equal(
      pickApprovedGraphTemplate([row()], "paulo_teix_v2_3", "pt_BR"),
      null,
    );
  });

  it("aborta o lote após 5 Graph 132001 seguidos", () => {
    assert.equal(shouldAbortBroadcastOnRepeatedTemplateMissing("132001", 4), false);
    assert.equal(shouldAbortBroadcastOnRepeatedTemplateMissing("132001", 5), true);
    assert.equal(shouldAbortBroadcastOnRepeatedTemplateMissing("131026", 9), false);
  });
});
