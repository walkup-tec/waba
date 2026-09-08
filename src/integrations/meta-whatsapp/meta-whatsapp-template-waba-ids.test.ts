import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProbablyMessageTemplateRow,
  wabaIdsFromBusinessEdgeJson,
  wabaIdsFromDebugTokenJson,
} from "./meta-whatsapp-template-waba-ids";

describe("template waba ids", () => {
  it("lê WABAs do debug_token e ignora lista de templates", () => {
    assert.deepEqual(
      wabaIdsFromDebugTokenJson({
        data: {
          granular_scopes: [
            { scope: "whatsapp_business_management", target_ids: ["waba-a", "waba-b"] },
          ],
        },
      }),
      ["waba-a", "waba-b"],
    );
    assert.deepEqual(
      wabaIdsFromDebugTokenJson({
        data: [{ id: "tpl-new", name: "novo", language: "pt_BR" }],
      }),
      [],
    );
  });

  it("não trata linha de template como WABA do BM", () => {
    assert.equal(
      isProbablyMessageTemplateRow({ id: "tpl-1", name: "jandira_cp2_1", language: "pt_BR" }),
      true,
    );
    assert.deepEqual(
      wabaIdsFromBusinessEdgeJson({
        data: [
          { id: "waba-drax-01", name: "Drax Sistemas 01" },
          { id: "tpl-new", name: "novo", language: "pt_BR", status: "APPROVED" },
        ],
      }),
      ["waba-drax-01"],
    );
  });
});
