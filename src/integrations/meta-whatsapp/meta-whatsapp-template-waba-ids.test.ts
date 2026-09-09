import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import {
  discoverTemplateWabaIds,
  discoverTemplateWabas,
  extraWabaIdsFromConnections,
  isProbablyMessageTemplateRow,
  wabaIdentityMatchesBusiness,
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

function graphFail(status = 403): MetaGraphJsonResult {
  return {
    ok: false,
    status,
    json: { error: { message: "permissions" } },
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

  it("só aceita WABA cujo owner ou on_behalf é o BM marcado", () => {
    assert.equal(
      wabaIdentityMatchesBusiness(
        { id: "4653699361527400", owner_business_info: { id: "bm-drax-01" } },
        "bm-drax-2000",
      ),
      false,
    );
    assert.equal(
      wabaIdentityMatchesBusiness(
        { id: "waba-01", owner_business_info: { id: "bm-drax-2000" } },
        "bm-drax-2000",
      ),
      true,
    );
    assert.equal(
      wabaIdentityMatchesBusiness(
        { id: "waba-client", on_behalf_of_business_info: { id: "bm-drax-2000" } },
        "bm-drax-2000",
      ),
      true,
    );
    assert.equal(
      wabaIdentityMatchesBusiness(
        {
          id: "1581808413746453",
          owner_business_info: { id: "bm-rio" },
          on_behalf_of_business_info: { id: "1759044748332124" },
        },
        "1759044748332124",
      ),
      false,
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
          if (input.path === "waba-a" || input.path === "waba-b") {
            return graphOk({
              id: input.path,
              name: input.path === "waba-a" ? "Conta A" : "Conta B",
              owner_business_info: { id: "bm-1" },
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

    it("não mistura WABAs de outros BMs quando o portfólio já listou as contas", async () => {
      const ids = await discoverTemplateWabaIds({
        token: "tok",
        connection: { wabaId: "1603712454491063", metaBusinessId: "bm-drax-2000" },
        graph: async (input) => {
          if (input.path === "bm-drax-2000") {
            return graphOk({
              id: "bm-drax-2000",
              owned_whatsapp_business_accounts: {
                data: [
                  { id: "1603712454491063", name: "Conta WABA 01" },
                  { id: "2283911612192961", name: "Conta WABA 02" },
                  { id: "waba-jailton", name: "52.685.982 Jailton Lucas Ferreira dos Reis" },
                ],
              },
              client_whatsapp_business_accounts: { data: [] },
            });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: [
                      "1603712454491063",
                      "2283911612192961",
                      "waba-jailton",
                      "4653699361527400",
                    ],
                  },
                ],
              },
            });
          }
          const owners: Record<string, { name: string; bm: string }> = {
            "1603712454491063": { name: "Conta WABA 01", bm: "bm-drax-2000" },
            "2283911612192961": { name: "Conta WABA 02", bm: "bm-drax-2000" },
            "waba-jailton": { name: "52.685.982 Jailton Lucas Ferreira dos Reis", bm: "bm-drax-2000" },
            "4653699361527400": { name: "Drax Sistemas 01", bm: "bm-drax-01" },
          };
          const row = owners[input.path];
          if (row) {
            return graphOk({
              id: input.path,
              name: row.name,
              owner_business_info: { id: row.bm },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(ids.sort(), ["1603712454491063", "2283911612192961", "waba-jailton"].sort());
      assert.equal(ids.includes("4653699361527400"), false);
    });

    it("com BM sem edges, debug_token não traz BTM/Nesio/Drax 01", async () => {
      const ids = await discoverTemplateWabaIds({
        token: "tok",
        connection: { wabaId: "1603712454491063", metaBusinessId: "bm-drax-2000" },
        graph: async (input) => {
          if (input.path === "bm-drax-2000") {
            return graphOk({ id: "bm-drax-2000", name: "Drax Sistemas 2000" });
          }
          if (
            input.path === "bm-drax-2000/owned_whatsapp_business_accounts" ||
            input.path === "bm-drax-2000/client_whatsapp_business_accounts"
          ) {
            return { ...graphOk({ error: { message: "permissions" } }), ok: false, status: 403 };
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: [
                      "1603712454491063",
                      "2283911612192961",
                      "1588398522658537",
                      "waba-jailton",
                      "4653699361527400",
                      "1566864861033771",
                      "1085817753933768",
                    ],
                  },
                ],
              },
            });
          }
          const owners: Record<string, { name: string; bm: string }> = {
            "1603712454491063": { name: "Conta WABA 01", bm: "bm-drax-2000" },
            "2283911612192961": { name: "Conta WABA 02", bm: "bm-drax-2000" },
            "1588398522658537": { name: "Conta WABA 03", bm: "bm-drax-2000" },
            "waba-jailton": { name: "52.685.982 Jailton Lucas Ferreira dos Reis", bm: "bm-drax-2000" },
            "4653699361527400": { name: "Drax Sistemas 01", bm: "bm-drax-01" },
            "1566864861033771": { name: "BTM Soluções", bm: "bm-btm" },
            "1085817753933768": { name: "Deputado Nesio", bm: "bm-nesio" },
          };
          const row = owners[input.path];
          if (row) {
            return graphOk({
              id: input.path,
              name: row.name,
              owner_business_info: { id: row.bm },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.ok(ids.includes("1603712454491063"));
      assert.ok(ids.includes("2283911612192961"));
      assert.ok(ids.includes("1588398522658537"));
      assert.ok(ids.includes("waba-jailton"));
      assert.equal(ids.includes("4653699361527400"), false);
      assert.equal(ids.includes("1566864861033771"), false);
      assert.equal(ids.includes("1085817753933768"), false);
    });

    it("Andre Aguiar: só WABA01 e WABA02; descarta Rio de Janeiro 01 de outro BM", async () => {
      const rows = await discoverTemplateWabas({
        token: "tok",
        connection: {
          wabaId: "2458602464640240",
          metaBusinessId: "1759044748332124",
        },
        graph: async (input) => {
          if (input.path === "1759044748332124") {
            return graphOk({
              id: "1759044748332124",
              owned_whatsapp_business_accounts: {
                data: [{ id: "2458602464640240", name: "André - WABA01" }],
              },
              client_whatsapp_business_accounts: {
                data: [{ id: "1581808413746453", name: "Rio de Janeiro 01" }],
              },
            });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: [
                      "2458602464640240",
                      "1744257946809067",
                      "1581808413746453",
                    ],
                  },
                ],
              },
            });
          }
          const owners: Record<string, { name: string; bm: string }> = {
            "2458602464640240": { name: "André - WABA01", bm: "1759044748332124" },
            "1744257946809067": { name: "André - WABA02", bm: "1759044748332124" },
            "1581808413746453": { name: "Rio de Janeiro 01", bm: "bm-rio-de-janeiro" },
          };
          const row = owners[input.path];
          if (row) {
            return graphOk({
              id: input.path,
              name: row.name,
              owner_business_info: { id: row.bm },
              on_behalf_of_business_info:
                input.path === "1581808413746453" ? { id: "1759044748332124" } : undefined,
            });
          }
          return graphOk({ data: [] });
        },
      });
      const ids = rows.map((row) => row.id).sort();
      assert.deepEqual(ids, ["1744257946809067", "2458602464640240"]);
      assert.equal(
        rows.find((row) => row.id === "1744257946809067")?.name,
        "André - WABA02",
      );
      assert.equal(
        rows.find((row) => row.id === "2458602464640240")?.name,
        "André - WABA01",
      );
      assert.equal(
        rows.some((row) => row.id === "1581808413746453"),
        false,
      );
    });

    it("Andre Aguiar: WABA client some mesmo se GET owner bater; WABA02 permanece com GET 403", async () => {
      const rows = await discoverTemplateWabas({
        token: "tok",
        connection: {
          wabaId: "2458602464640240",
          metaBusinessId: "1759044748332124",
        },
        graph: async (input) => {
          if (input.path === "1759044748332124") {
            return graphOk({
              id: "1759044748332124",
              owned_whatsapp_business_accounts: {
                data: [{ id: "2458602464640240", name: "André - WABA01" }],
              },
              client_whatsapp_business_accounts: {
                data: [{ id: "1581808413746453", name: "Rio de Janeiro 01" }],
              },
            });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: [
                      "2458602464640240",
                      "1744257946809067",
                      "1581808413746453",
                    ],
                  },
                ],
              },
            });
          }
          if (input.path === "1744257946809067") return graphFail(403);
          if (input.path === "2458602464640240") {
            return graphOk({
              id: "2458602464640240",
              name: "André - WABA01",
              owner_business_info: { id: "1759044748332124" },
            });
          }
          if (input.path === "1581808413746453") {
            return graphOk({
              id: "1581808413746453",
              name: "Rio de Janeiro 01",
              owner_business_info: { id: "1759044748332124" },
              on_behalf_of_business_info: { id: "1759044748332124" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      const ids = rows.map((row) => row.id).sort();
      assert.deepEqual(ids, ["1744257946809067", "2458602464640240"]);
      assert.equal(
        rows.some((row) => row.id === "1581808413746453"),
        false,
      );
    });

    it("Andre Aguiar: WABA02 irmã da mesma BM entra mesmo com GET 403 e sem debug_token", async () => {
      const ids = await discoverTemplateWabaIds({
        token: "tok",
        connection: {
          wabaId: "2458602464640240",
          metaBusinessId: "1759044748332124",
        },
        extraWabaIds: ["1744257946809067"],
        graph: async (input) => {
          if (input.path === "1759044748332124") {
            return graphOk({
              id: "1759044748332124",
              owned_whatsapp_business_accounts: {
                data: [{ id: "2458602464640240", name: "André - WABA01" }],
              },
              client_whatsapp_business_accounts: {
                data: [{ id: "1581808413746453", name: "Rio de Janeiro 01" }],
              },
            });
          }
          if (input.path === "debug_token") {
            return graphOk({ data: { granular_scopes: [] } });
          }
          if (input.path === "1744257946809067") return graphFail(403);
          if (input.path === "2458602464640240") {
            return graphOk({
              id: "2458602464640240",
              name: "André - WABA01",
              owner_business_info: { id: "1759044748332124" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(ids.sort(), ["1744257946809067", "2458602464640240"]);
    });
  });
});

describe("extraWabaIdsFromConnections", () => {
  it("só junta WABAs irmãs do mesmo BM", () => {
    assert.deepEqual(
      extraWabaIdsFromConnections(
        [
          { id: "c1", wabaId: "2458602464640240", metaBusinessId: "1759044748332124" },
          { id: "c2", wabaId: "1744257946809067", metaBusinessId: "1759044748332124" },
          { id: "c3", wabaId: "waba-outro-bm", metaBusinessId: "bm-drax-2000" },
        ],
        { id: "c1", wabaId: "2458602464640240", metaBusinessId: "1759044748332124" },
      ),
      ["1744257946809067"],
    );
  });
});
