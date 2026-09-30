#!/usr/bin/env node
/**
 * Diagnóstico: o que a Graph devolve na requisição de conexão do Laboratório.
 * Não imprime tokens. Roda dentro do container waba_disparador.
 */
"use strict";

process.chdir("/app");

const { resolveMetaWhatsappTenant } = require("./dist/integrations/meta-whatsapp/meta-whatsapp-tenant");
const { WABA_LABORATORIO_OWNER_EMAIL } = require("./dist/menus/waba-laboratorio-access");
const { MetaWhatsappConnectionRepository } = require("./dist/integrations/meta-whatsapp/meta-whatsapp-connection.repository");
const { decryptMetaToken } = require("./dist/integrations/meta-whatsapp/meta-token-crypto");
const { callMetaGraphJson } = require("./dist/integrations/meta-whatsapp/meta-whatsapp-graph.client");
const {
  fetchAssignedBusinesses,
  discoverAdministeredBusinessNodes,
  fetchVisibleBusinessCard,
  directoryFromAssigned,
} = require("./dist/integrations/meta-whatsapp/meta-whatsapp-portfolio-graph");
const {
  catalogAdminBusinessIds,
  catalogAgencyBusinessIds,
  catalogBackfillBusinessIds,
  catalogBusinessLabel,
  metaBusinessIdsMatch,
} = require("./dist/integrations/meta-whatsapp/meta-whatsapp-known-owned-wabas");
const { isMetaGraphUploadCooldown } = require("./dist/integrations/meta-whatsapp/meta-whatsapp-graph-cooldown");
const { META_PHONE_NUMBER_CATALOG_FIELDS } = require("./dist/integrations/meta-whatsapp/meta-whatsapp-portfolio.map");

const PHONE_FIELDS = META_PHONE_NUMBER_CATALOG_FIELDS;
const WABA_EDGE_FIELDS = "id,name";

function graph(token, path, query) {
  return callMetaGraphJson({
    token,
    method: "GET",
    path,
    query,
    maxAttempts: 1,
    timeoutMs: 15000,
  });
}

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function text(value) {
  const raw = String(value || "").trim();
  return raw || "";
}

function errOf(res) {
  const error = asRecord(asRecord(res && res.json).error);
  const message = text(error.message);
  const code = error.code == null ? "" : String(error.code);
  if (!message && !code && res && !res.ok) return `http_${res.status || 0}`;
  return [code && `code_${code}`, message].filter(Boolean).join(" ");
}

function uniqueTokens(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    let token = "";
    try {
      token = decryptMetaToken(row.accessTokenEncrypted);
    } catch {
      continue;
    }
    token = String(token || "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push({
      connectionId: row.id,
      status: row.status,
      storedBm: String(row.metaBusinessId || "").trim(),
      storedWaba: String(row.wabaId || "").trim(),
      storedPhoneId: String(row.phoneNumberId || "").trim(),
      storedPhone: String(row.displayPhoneNumber || "").trim(),
      storedName: String(row.verifiedName || "").trim(),
      token,
    });
  }
  return out;
}

function upsertBm(map, id, name, source) {
  const key = String(id || "").trim();
  if (!key) return;
  const prev = map.get(key) || { id: key, name: "", sources: [] };
  const label = String(name || "").trim() || catalogBusinessLabel(key) || prev.name;
  if (label) prev.name = label;
  if (source && !prev.sources.includes(source)) prev.sources.push(source);
  map.set(key, prev);
}

async function paginateEdge(token, path, fields) {
  const rows = [];
  const errors = [];
  const seen = new Set();
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const query = { fields, limit: "100" };
    if (after) query.after = after;
    const res = await graph(token, path, query);
    if (!res.ok) {
      errors.push({ path, status: res.status, error: errOf(res) });
      break;
    }
    const batch = Array.isArray(res.json && res.json.data) ? res.json.data : [];
    for (const row of batch) rows.push(row);
    const nextAfter = String((res.json && res.json.paging && res.json.paging.cursors && res.json.paging.cursors.after) || "").trim();
    if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length) break;
    seen.add(nextAfter);
    after = nextAfter;
  }
  return { rows, errors };
}

async function firstOk(tokens, runner) {
  const errors = [];
  for (const row of tokens) {
    const result = await runner(row.token);
    if (result && result.ok) return { ...result, errors };
    if (result && result.error) errors.push(result.error);
  }
  return { ok: false, errors };
}

async function main() {
  const startedAt = new Date().toISOString();
  const tenant = resolveMetaWhatsappTenant({
    email: WABA_LABORATORIO_OWNER_EMAIL,
    role: "master",
  });
  const repo = new MetaWhatsappConnectionRepository();
  const rows = await repo.listOpenByTenant(tenant.tenantId);
  const tokens = uniqueTokens(rows);
  const stored = rows.map((row) => ({
    status: row.status,
    bm: String(row.metaBusinessId || "").trim() || null,
    waba: String(row.wabaId || "").trim() || null,
    phoneId: String(row.phoneNumberId || "").trim() || null,
    phone: String(row.displayPhoneNumber || "").trim() || null,
    name: String(row.verifiedName || "").trim() || null,
  }));

  const graphCaller = (input) =>
    callMetaGraphJson({
      ...input,
      maxAttempts: input.maxAttempts ?? 1,
      timeoutMs: input.timeoutMs ?? 15000,
    });

  const bms = new Map();
  const assignedErrors = [];
  for (const row of tokens) {
    try {
      const json = await fetchAssignedBusinesses(graphCaller, row.token);
      const cards = directoryFromAssigned(json);
      for (const card of cards) {
        upsertBm(bms, card.id, card.name, "me/businesses");
      }
    } catch (error) {
      assignedErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (tokens.length) {
    try {
      const nodes = await discoverAdministeredBusinessNodes(
        graphCaller,
        tokens[0].token,
        catalogAgencyBusinessIds(),
      );
      for (const node of nodes) {
        const rec = asRecord(node);
        upsertBm(bms, rec.id, rec.name, "agency/clients-owned");
      }
    } catch (error) {
      assignedErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const businessId of catalogAdminBusinessIds()) {
    if ([...bms.keys()].some((id) => metaBusinessIdsMatch(id, businessId))) continue;
    for (const row of tokens) {
      const found = await fetchVisibleBusinessCard(graphCaller, row.token, businessId);
      if (found && found.id) {
        upsertBm(bms, found.id, found.name, "catalog-backfill");
        break;
      }
    }
  }

  const portfolios = [];
  for (const bm of [...bms.values()].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "pt-BR"))) {
    const owned = await firstOk(tokens, async (token) => {
      const page = await paginateEdge(token, `${bm.id}/owned_whatsapp_business_accounts`, WABA_EDGE_FIELDS);
      if (page.errors.length && !page.rows.length) {
        return { ok: false, error: page.errors[0] };
      }
      return { ok: true, rows: page.rows, errors: page.errors };
    });
    const client = await firstOk(tokens, async (token) => {
      const page = await paginateEdge(token, `${bm.id}/client_whatsapp_business_accounts`, WABA_EDGE_FIELDS);
      if (page.errors.length && !page.rows.length) {
        return { ok: false, error: page.errors[0] };
      }
      return { ok: true, rows: page.rows, errors: page.errors };
    });

    const wabaMap = new Map();
    const addWaba = (row, kind) => {
      const rec = asRecord(row);
      const id = text(rec.id);
      if (!id) return;
      const prev = wabaMap.get(id) || { id, name: text(rec.name) || id, kinds: [], numbers: [], errors: [] };
      if (text(rec.name)) prev.name = text(rec.name);
      if (!prev.kinds.includes(kind)) prev.kinds.push(kind);
      wabaMap.set(id, prev);
    };
    for (const row of owned.rows || []) addWaba(row, "owned");
    for (const row of client.rows || []) addWaba(row, "client");

    for (const waba of wabaMap.values()) {
      const phones = await firstOk(tokens, async (token) => {
        const page = await paginateEdge(token, `${waba.id}/phone_numbers`, PHONE_FIELDS);
        if (page.errors.length && !page.rows.length) {
          return { ok: false, error: page.errors[0] };
        }
        return { ok: true, rows: page.rows, errors: page.errors };
      });
      waba.numbers = (phones.rows || []).map((row) => {
        const rec = asRecord(row);
        return {
          id: text(rec.id) || null,
          phone: text(rec.display_phone_number) || null,
          name: text(rec.verified_name) || null,
          status: text(rec.status) || null,
          codeVerificationStatus: text(rec.code_verification_status) || null,
        };
      });
      if (!phones.ok) waba.errors = phones.errors || [];
    }

    portfolios.push({
      id: bm.id,
      name: bm.name || catalogBusinessLabel(bm.id) || bm.id,
      sources: bm.sources,
      wabaOwnedError: owned.ok ? null : owned.errors || null,
      wabaClientError: client.ok ? null : client.errors || null,
      wabas: [...wabaMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    });
  }

  const payload = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    ownerEmail: WABA_LABORATORIO_OWNER_EMAIL,
    tenantId: tenant.tenantId,
    graphCooldown: Boolean(isMetaGraphUploadCooldown()),
    openConnections: rows.length,
    usableTokens: tokens.length,
    assignedErrors,
    storedConnections: stored,
    bmCount: portfolios.length,
    portfolios,
  };

  process.stdout.write("BEGIN_LAB_GRAPH_PROBE\n");
  process.stdout.write(JSON.stringify(payload, null, 2));
  process.stdout.write("\nEND_LAB_GRAPH_PROBE\n");
}

main().catch((error) => {
  process.stdout.write("BEGIN_LAB_GRAPH_PROBE\n");
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.stdout.write("\nEND_LAB_GRAPH_PROBE\n");
  process.exitCode = 1;
});
