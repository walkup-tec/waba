import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import {
  discoverTemplateWabaIds,
  isProbablyMessageTemplateRow,
  wabaIdsFromBusinessEdgeJson,
  wabaIdsFromDebugTokenJson,
} from "./meta-whatsapp-template-waba-ids";

function graphOk(json: unknown): MetaGraphJsonResult {
  return {
    ok: true,
    status: 200,
    json,
    body: "{}",
    timeout: false,
    kind: "permanent",
    graphCode: null,
    attempts: 1,
  };
}

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

  it("ignora target_ids de whatsapp_business_messaging (são chips, não WABA)", () => {
    assert.deepEqual(
      wabaIdsFromDebugTokenJson({
        data: {
          granular_scopes: [
            { scope: "whatsapp_business_messaging", target_ids: ["555111", "555222"] },
            { scope: "whatsapp_business_management", target_ids: ["waba-a"] },
          ],
        },
      }),
      ["waba-a"],
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

  describe("discoverTemplateWabaIds", () => {
    const previousId = process.env.META_APP_ID;
    const previousSecret = process.env.META_APP_SECRET;

    before(() => {
      process.env.META_APP_ID = "app-test";
      process.env.META_APP_SECRET = "secret-test";
    });

    after(() => {
      if (previousId === undefined) delete process.env.META_APP_ID;
      else process.env.META_APP_ID = previousId;
      if (previousSecret === undefined) delete process.env.META_APP_SECRET;
      else process.env.META_APP_SECRET = previousSecret;
    });

    it("não consulta message_templates em phone_number_id do scope messaging", async () => {
      const paths: string[] = [];
      const ids = await discoverTemplateWabaIds({
        token: "tok",
        connection: { wabaId: "waba-a", metaBusinessId: "bm-1" },
        graph: async (input) => {
          paths.push(input.path);
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  { scope: "whatsapp_business_messaging", target_ids: ["555111", "555222"] },
                  { scope: "whatsapp_business_management", target_ids: ["waba-a", "waba-b"] },
                ],
              },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(ids.sort(), ["waba-a", "waba-b"]);
      assert.equal(
        paths.some((path) => path.startsWith("555")),
        false,
      );
    });
  });
});
