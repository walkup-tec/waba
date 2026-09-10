import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import {
  discoverTemplateWabaIds,
  discoverTemplateWabas,
  extraWabaIdsFromConnections,
  isProbablyMessageTemplateRow,
  listTemplatePickerWabas,
  pickTemplateWriteConnections,
  templatePickerWabaIds,
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

  it("só aceita WABA cujo owner é o BM marcado; on_behalf sozinho é client", () => {
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
      false,
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
      assert.deepEqual(ids, ["1603712454491063"]);
      assert.equal(ids.includes("2283911612192961"), false);
      assert.equal(ids.includes("waba-jailton"), false);
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

    it("Andre Aguiar: WABA client some; WABA02 owned permanece em 403", async () => {
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

    it("Andre Aguiar: sem edge client, debug_token não traz Rio de Janeiro 01", async () => {
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
            });
          }
          if (
            input.path === "1759044748332124/owned_whatsapp_business_accounts"
          ) {
            return graphOk({ data: [{ id: "2458602464640240", name: "André - WABA01" }] });
          }
          if (input.path === "1759044748332124/client_whatsapp_business_accounts") {
            return graphFail(403);
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: ["2458602464640240", "1581808413746453"],
                  },
                ],
              },
            });
          }
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
              on_behalf_of_business_info: { id: "1759044748332124" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(
        rows.map((row) => row.id),
        ["2458602464640240"],
      );
      assert.equal(
        rows.some((row) => row.id === "1581808413746453"),
        false,
      );
    });

    it("Andre Aguiar: Templates lista WABA02 e recusa Rio mesmo com owner do BM", async () => {
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
            });
          }
          if (input.path === "1759044748332124/client_whatsapp_business_accounts") {
            return graphFail(403);
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
      assert.equal(rows.find((row) => row.id === "1744257946809067")?.name, "André - WABA02");
      assert.equal(
        rows.some((row) => row.id === "1581808413746453"),
        false,
      );
    });

    it("Drax Sistemas: só a WABA do card, mesmo se outras owned tiverem número", async () => {
      const rows = await discoverTemplateWabas({
        token: "tok",
        connection: {
          wabaId: "1636793994538054",
          metaBusinessId: "1041827648719609",
        },
        extraWabaIds: ["1988957871663919", "1051060507541515"],
        graph: async (input) => {
          if (input.path === "1041827648719609") {
            return graphOk({
              id: "1041827648719609",
              owned_whatsapp_business_accounts: {
                data: [
                  {
                    id: "1636793994538054",
                    name: "Drax Sistemas",
                    phone_numbers: { data: [{ id: "phone-drax" }] },
                  },
                  {
                    id: "1988957871663919",
                    name: "WABA 1988957871663919",
                    phone_numbers: { data: [{ id: "phone-waba-1988" }] },
                  },
                  {
                    id: "1051060507541515",
                    name: "Mms Marketing E Sistemas Digitais Ltda",
                    phone_numbers: { data: [{ id: "phone-mms" }] },
                  },
                ],
              },
              client_whatsapp_business_accounts: { data: [] },
            });
          }
          if (input.path === "1041827648719609/owned_whatsapp_business_accounts") {
            return graphOk({
              data: [
                {
                  id: "1636793994538054",
                  name: "Drax Sistemas",
                  phone_numbers: { data: [{ id: "phone-drax" }] },
                },
                {
                  id: "1988957871663919",
                  name: "WABA 1988957871663919",
                  phone_numbers: { data: [{ id: "phone-waba-1988" }] },
                },
                {
                  id: "1051060507541515",
                  name: "Mms Marketing E Sistemas Digitais Ltda",
                  phone_numbers: { data: [{ id: "phone-mms" }] },
                },
              ],
            });
          }
          if (input.path === "1636793994538054") {
            return graphOk({
              id: "1636793994538054",
              name: "Drax Sistemas",
              owner_business_info: { id: "1041827648719609" },
            });
          }
          if (input.path === "1988957871663919" || input.path === "1051060507541515") {
            return graphOk({
              id: input.path,
              name: input.path === "1051060507541515" ? "Mms Marketing E Sistemas Digitais Ltda" : "",
              owner_business_info: { id: "1041827648719609" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(
        rows.map((row) => row.id),
        ["1636793994538054"],
      );
      assert.equal(rows[0]?.name, "Drax Sistemas");
      assert.equal(
        rows.some((row) => row.id === "1988957871663919" || row.id === "1051060507541515"),
        false,
      );
    });

    it("Walkup: se o Manager já listou as owned, debug_token e conexão antiga não inventam outra WABA", async () => {
      const rows = await discoverTemplateWabas({
        token: "tok",
        connection: {
          wabaId: "1014470201624992",
          metaBusinessId: "4141369862822598",
        },
        extraWabaIds: ["1461611825811080"],
        graph: async (input) => {
          if (input.path === "4141369862822598") {
            return graphOk({
              id: "4141369862822598",
              owned_whatsapp_business_accounts: {
                data: [{ id: "1014470201624992", name: "Grupo Walkup" }],
              },
              client_whatsapp_business_accounts: { data: [] },
            });
          }
          if (input.path === "4141369862822598/owned_whatsapp_business_accounts") {
            return graphOk({ data: [{ id: "1014470201624992", name: "Grupo Walkup" }] });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: ["1014470201624992", "1461611825811080"],
                  },
                ],
              },
            });
          }
          if (input.path === "1014470201624992" || input.path === "1461611825811080") {
            return graphOk({
              id: input.path,
              name: "Grupo Walkup",
              owner_business_info: { id: "4141369862822598" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(
        rows.map((row) => row.id),
        ["1014470201624992"],
      );
      assert.equal(
        rows.some((row) => row.id === "1461611825811080"),
        false,
      );
    });

    it("conexão com WABA antiga some quando o edge owned do BM já devolveu a conta atual", async () => {
      const ids = await discoverTemplateWabaIds({
        token: "tok",
        connection: {
          wabaId: "1461611825811080",
          metaBusinessId: "4141369862822598",
        },
        extraWabaIds: ["1461611825811080"],
        graph: async (input) => {
          if (input.path === "4141369862822598") {
            return graphOk({
              id: "4141369862822598",
              owned_whatsapp_business_accounts: {
                data: [{ id: "1014470201624992", name: "Grupo Walkup" }],
              },
            });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: ["1461611825811080", "1014470201624992"],
                  },
                ],
              },
            });
          }
          if (input.path === "1014470201624992" || input.path === "1461611825811080") {
            return graphOk({
              id: input.path,
              name: "Grupo Walkup",
              owner_business_info: { id: "4141369862822598" },
            });
          }
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(ids, ["1014470201624992"]);
    });

    it("Andre Aguiar: GET 403 no debug_token não preserva WABA de outro BM", async () => {
      const ids = await discoverTemplateWabaIds({
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
            });
          }
          if (input.path === "debug_token") {
            return graphOk({
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: ["2458602464640240", "1581808413746453"],
                  },
                ],
              },
            });
          }
          if (input.path === "2458602464640240") {
            return graphOk({
              id: "2458602464640240",
              name: "André - WABA01",
              owner_business_info: { id: "1759044748332124" },
            });
          }
          if (input.path === "1581808413746453") return graphFail(403);
          return graphOk({ data: [] });
        },
      });
      assert.deepEqual(ids, ["2458602464640240"]);
    });
  });
});

describe("templatePickerWabaIds", () => {
  it("Drax Sistemas: ignora WABA stale da conexão e usa a do Manager", () => {
    assert.deepEqual(
      templatePickerWabaIds({
        wabaId: "1988957871663919",
        metaBusinessId: "1041827648719609",
      }),
      ["1636793994538054"],
    );
  });

  it("Andre Aguiar: card WABA01 mais a irmã WABA02", () => {
    assert.deepEqual(
      templatePickerWabaIds({
        wabaId: "2458602464640240",
        metaBusinessId: "1759044748332124",
      }),
      ["2458602464640240", "1744257946809067"],
    );
  });
});

describe("listTemplatePickerWabas", () => {
  it("Drax Sistemas: conexão stale não aparece; só Drax Sistemas do Manager", async () => {
    const rows = await listTemplatePickerWabas({
      token: "tok",
      connection: {
        wabaId: "1988957871663919",
        metaBusinessId: "1041827648719609",
      },
      graph: async (input) => {
        if (input.path === "1041827648719609") {
          return graphOk({
            id: "1041827648719609",
            owned_whatsapp_business_accounts: {
              data: [
                { id: "1988957871663919", name: "WABA 1988957871663919" },
                { id: "1636793994538054", name: "Drax Sistemas" },
                { id: "1051060507541515", name: "Mms Marketing E Sistemas Digitais Ltda" },
              ],
            },
          });
        }
        return graphOk({ data: [] });
      },
    });
    assert.deepEqual(rows, [{ id: "1636793994538054", name: "Drax Sistemas" }]);
  });

  it("Walkup: nome do Manager é WABA 01, não o fallback WABA {id}", async () => {
    const rows = await listTemplatePickerWabas({
      token: "tok",
      connection: {
        wabaId: "1014470201624992",
        metaBusinessId: "4141369862822598",
      },
      graph: async (input) => {
        if (input.path === "4141369862822598") {
          return graphOk({
            id: "4141369862822598",
            owned_whatsapp_business_accounts: {
              data: [{ id: "1014470201624992", name: "" }],
            },
          });
        }
        if (input.path === "1014470201624992") {
          return graphOk({ id: "1014470201624992", name: "WABA 01" });
        }
        return graphOk({ data: [] });
      },
    });
    assert.deepEqual(rows, [{ id: "1014470201624992", name: "WABA 01" }]);
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

  it("Andre Aguiar: WABA02 entra mesmo sem segunda conexão Embedded Signup", () => {
    assert.deepEqual(
      extraWabaIdsFromConnections(
        [{ id: "c1", wabaId: "2458602464640240", metaBusinessId: "1759044748332124" }],
        { id: "c1", wabaId: "2458602464640240", metaBusinessId: "1759044748332124" },
      ),
      ["1744257946809067"],
    );
  });
});

describe("pickTemplateWriteConnections", () => {
  const waba01 = {
    id: "conn-waba01",
    wabaId: "2458602464640240",
    metaBusinessId: "1759044748332124",
    status: "connected" as const,
    disconnectedAt: null,
  };
  const waba02 = {
    id: "conn-waba02",
    wabaId: "1744257946809067",
    metaBusinessId: "1759044748332124",
    status: "pending_confirmation" as const,
    disconnectedAt: null,
  };
  const drax = {
    id: "conn-drax",
    wabaId: "2283911612192961",
    metaBusinessId: "bm-drax-2000",
    status: "connected" as const,
    disconnectedAt: null,
  };

  it("posta na WABA02 com o token da conexão dessa WABA, não o da WABA01", () => {
    const picked = pickTemplateWriteConnections(
      [waba01, waba02, drax] as any,
      waba01 as any,
      "1744257946809067",
    );
    assert.equal(picked[0].id, "conn-waba02");
    assert.equal(picked.some((row) => row.id === "conn-drax"), false);
    assert.equal(picked.some((row) => row.id === "conn-waba01"), true);
  });

  it("sem conexão da WABA02 fica só o token da conexão selecionada", () => {
    const picked = pickTemplateWriteConnections([waba01, drax] as any, waba01 as any, "1744257946809067");
    assert.deepEqual(
      picked.map((row) => row.id),
      ["conn-waba01"],
    );
  });
});
