import "./load-env";
process.env.TZ = process.env.TZ || "America/Sao_Paulo";
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import crypto from "crypto";
import { promises as fs, existsSync, readFileSync } from "fs";
import { lookup } from "dns/promises";
import { hostname } from "os";
import { createClient } from "@supabase/supabase-js";
import { DRAX_LOGO_PNG_BASE64 } from "./generated-brand-logo";
import { WABA_ENV } from "./load-env";
import { resolveDataFile } from "./data-path";
import {
  BASE_PATH,
  stripBasePathMiddleware,
  requestUnderBasePath,
  injectRuntimeIntoIndexHtml,
  type WabaUiProfile,
} from "./base-path";
import { registerWabaAuthRoutes, wabaRequireAuthMiddleware } from "./auth/waba-auth.routes";
import { resolveWabaRequestAuth } from "./auth/waba-request-auth";
import { isWabaAuthConfigured, isWabaMasterEmail } from "./auth/waba-auth.service";
import { WabaSystemUserRepository } from "./users/waba-system-user.repository";
import { AlternativaNumberActivationRepository } from "./billing/alternativa-number-activation.repository";
import { WabaAlternativaNumbersService } from "./billing/waba-alternativa-numbers.service";
import {
  assertAlternativaMinActivated,
  computeAlternativaThrottle,
  estimateAlternativaCampaignDuration,
  getAlternativaDispatchRulesMeta,
} from "./disparos/alternativa-dispatch-rules";
import { wabaInstanceOwnershipService } from "./instances/waba-instance-ownership.service";
import { resolveEvoInstanceKey } from "./instances/evo-instance-key";
import { registerWabaBillingRoutes } from "./billing/waba-billing.routes";
import { configureWabaFazendaPool, wabaFazendaPoolService } from "./instances/waba-fazenda-pool.service";
import { registerWabaAdminRoutes } from "./admin/waba-admin.routes";
import { registerWabaOperacionalCampanhasRoutes } from "./admin/waba-operacional-campanhas.routes";
import { defaultEvoHttpTimeoutMs, describeEvoApiBaseForOps, evoHttpRequest, isEvoTlsInsecure } from "./evo-http.client";
import {
  createWabaShortUrl,
  fetchWabaShortUrlClicks,
  isWabaManagedShortUrl,
  resolveWabaShortRedirect,
} from "./shortener/waba-shortener.service";
import { WabaSystemUserService } from "./users/waba-system-user.service";
import { registerWabaCampaignIntakeRoutes } from "./disparos/waba-campaign-intake.routes";
import { countSpreadsheetImportedRows } from "./disparos/waba-campaign-spreadsheet.util";
import { WabaDisparosCreditsService } from "./billing/waba-disparos-credits.service";
import { registerWabaEntitlementRoutes } from "./entitlements/waba-entitlement.routes";
import { WabaEntitlementService } from "./entitlements/waba-entitlement.service";
import { registerWabaCors } from "./lib/waba-cors";
import { registerWabaSubscriberRoutes } from "./subscribers/waba-subscriber.routes";
import { registerWabaSupportRoutes } from "./support/waba-support.routes";
import {
  getIntegrationProbeStatus,
  handleEvolutionWebhookPayload,
  setIntegrationProbeFinishedHandler,
  startIntegrationProbe,
} from "./instance-integration-probe";
import {
  getInboundValidationStatus,
  handleInboundValidationWebhook,
  setInboundValidationFinishedHandler,
  startInboundValidation,
} from "./instance-inbound-validation.service";
import { WABA_DEPLOY_MARKER } from "./deploy-marker";

const app = express();
app.use(stripBasePathMiddleware);

/** UI estática: raiz do projeto e pasta dist (antes de middlewares que possam interferir). */
const rootPath = path.join(__dirname, "..");
const distPath = path.join(rootPath, "dist");

/**
 * Logo DRAX: primeiro middleware.
 * Prioridade: PNG embutido em base64 (gerado no build) → não depende de ficheiros no disco do container.
 * Fallback: ficheiros em dist/media ou media/ (dev).
 */
let draxLogoBytes: Buffer | null | undefined;
function resolveDraxLogoPng(): Buffer | null {
  if (draxLogoBytes !== undefined) {
    return draxLogoBytes;
  }
  const b64 = typeof DRAX_LOGO_PNG_BASE64 === "string" ? DRAX_LOGO_PNG_BASE64.trim() : "";
  if (b64.length > 500) {
    try {
      const fromEmbed = Buffer.from(b64, "base64");
      if (fromEmbed.length > 0) {
        draxLogoBytes = fromEmbed;
        return fromEmbed;
      }
    } catch (e) {
      console.warn("[brand] decode base64 da logo falhou:", e);
    }
  }
  const fileName = "Drax-logo-footer.png";
  const candidates = [
    path.join(distPath, "media", fileName),
    path.join(rootPath, "media", fileName),
    path.join(process.cwd(), "media", fileName),
    path.join(process.cwd(), "dist", "media", fileName),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const buf = readFileSync(filePath);
      if (buf.length > 0) {
        draxLogoBytes = buf;
        return buf;
      }
    } catch (e) {
      console.warn("[brand] erro ao ler logo:", filePath, e);
    }
  }
  draxLogoBytes = null;
  console.error(
    "[brand] Drax-logo-footer.png não encontrado (embed vazio e disco). cwd=%s __dirname=%s tentou: %s",
    process.cwd(),
    __dirname,
    candidates.join(" | ")
  );
  return null;
}

/** Caminhos HTTP da logo (evitar só `/media/…` — proxies / painéis costumam reservar ou bloquear `/media`). */
const DRAX_LOGO_URL_PATHS = new Set([
  "/logo.png",
  "/drax-logo.png",
  "/media/drax-logo-footer.png",
]);

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const raw =
    typeof req.path === "string" && req.path.length > 0
      ? req.path
      : String(req.url || "").split("?")[0] || "/";
  const norm = raw.replace(/\/+$/, "") || "/";
  if (!DRAX_LOGO_URL_PATHS.has(norm.toLowerCase())) {
    return next();
  }
  const buf = resolveDraxLogoPng();
  if (!buf) {
    return next();
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.type("png");
  return res.send(buf);
});

/** Favicon na raiz do host — o navegador pede /favicon.ico antes do HTML (com ou sem BASE_PATH). */
const sendBrandStaticFile = (
  res: express.Response,
  candidates: string[],
  contentType: string
): boolean => {
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const buf = readFileSync(filePath);
      if (buf.length === 0) continue;
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.type(contentType);
      res.send(buf);
      return true;
    } catch {
      /* tenta próximo */
    }
  }
  return false;
};

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const p = String(req.path || "/").toLowerCase();
  if (p === "/favicon.ico") {
    if (
      sendBrandStaticFile(
        res,
        [
          path.join(distPath, "favicon.ico"),
          path.join(rootPath, "favicon.ico"),
          path.join(distPath, "media", "favicon.ico"),
          path.join(rootPath, "media", "favicon.ico"),
        ],
        "image/x-icon"
      )
    ) {
      return;
    }
  }
  if (p === "/media/favcon.png" || p === "/media/favicon.png") {
    const fileName = p === "/media/favcon.png" ? "favcon.png" : "favicon.png";
    if (
      sendBrandStaticFile(
        res,
        [
          path.join(distPath, "media", fileName),
          path.join(rootPath, "media", fileName),
        ],
        "image/png"
      )
    ) {
      return;
    }
  }
  return next();
});

/** Encurtador próprio — redirect público na raiz do host (/s/:slug). */
app.get("/s/:slug", async (req, res) => {
  try {
    const target = await resolveWabaShortRedirect(String(req.params.slug || ""));
    if (!target) return res.status(404).type("text/plain").send("Not Found");
    return res.redirect(302, target);
  } catch (error) {
    console.error("[shortener] redirect error:", error);
    return res.status(500).type("text/plain").send("Erro ao redirecionar.");
  }
});

const PORT = process.env.PORT || 3000;
const RUNTIME_MODE = String(process.env.RUNTIME_MODE || "production").toLowerCase();
const parseEnvBoolean = (raw: string | undefined, defaultValue: boolean): boolean => {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return defaultValue;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return defaultValue;
};

/** Disparador EVO (API não oficial): V01/V02 usam WABA_EVO_DISPARADOR; demais ambientes seguem ENABLE_BACKGROUND_PROCESSING. */
const ENABLE_BACKGROUND_PROCESSING =
  WABA_ENV === "v01" || WABA_ENV === "v02"
    ? parseEnvBoolean(
        process.env.WABA_EVO_DISPARADOR ?? process.env.ENABLE_BACKGROUND_PROCESSING,
        WABA_ENV === "v01"
      )
    : parseEnvBoolean(process.env.ENABLE_BACKGROUND_PROCESSING, true);
/** Aquecedor pode rodar em dev (v02) mesmo com campanhas desligadas. Se omitido, segue ENABLE_BACKGROUND_PROCESSING. */
const ENABLE_AQUECEDOR_PROCESSING = (() => {
  const raw = String(process.env.ENABLE_AQUECEDOR_PROCESSING ?? "").trim().toLowerCase();
  if (raw) return ["1", "true", "yes", "on"].includes(raw);
  return ENABLE_BACKGROUND_PROCESSING;
})();

/** Quando true, o processo responde só a probes e página de manutenção (útil no ambiente prod / porta 3000). */
const MAINTENANCE_MODE = ["1", "true", "yes", "on"].includes(
  String(process.env.MAINTENANCE_MODE || "").toLowerCase()
);
const MAINTENANCE_RETRY_AFTER_SEC = Math.max(
  30,
  Math.min(86400, Number(process.env.MAINTENANCE_RETRY_AFTER_SEC || 120) || 120)
);
const MAINTENANCE_MESSAGE = String(
  process.env.MAINTENANCE_MESSAGE ||
    "Serviço em manutenção. Tente novamente em alguns minutos."
).trim() || "Serviço em manutenção. Tente novamente em alguns minutos.";

/** Demais rotas (padrão Express ~100kb). */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "10mb";
/**
 * Só o POST que envia o array `numbers` + `configSnapshot` pode passar de dezenas de MB.
 * Limite separado para não depender só do global (e para planilhas muito grandes).
 */
const CAMPAIGN_CREATE_JSON_LIMIT =
  process.env.CAMPAIGN_CREATE_JSON_LIMIT || "512mb";

const parseJsonDefault = express.json({ limit: JSON_BODY_LIMIT });
const parseJsonCampaignCreate = express.json({ limit: CAMPAIGN_CREATE_JSON_LIMIT });

const CAMPAIGN_UPLOAD_MAX_BYTES =
  Math.max(5, Number(process.env.CAMPAIGN_UPLOAD_MAX_MB || 100)) * 1024 * 1024;

/** Planilha enviada como arquivo — não carrega centenas de MB em JSON. */
const uploadCampaignSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CAMPAIGN_UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const n = file.originalname.toLowerCase();
    if (n.endsWith(".xlsx") || n.endsWith(".xls")) {
      cb(null, true);
      return;
    }
    cb(new Error("Envie arquivo Excel (.xlsx ou .xls)."));
  },
});

function isDisparosCampaignCreatePost(req: express.Request) {
  if (req.method !== "POST") return false;
  const p = String(req.path || "").replace(/\/+$/, "") || "/";
  return p === "/disparos/campanhas";
}

app.use((req, res, next) => {
  if (isDisparosCampaignCreatePost(req)) {
    const ct = String(req.headers["content-type"] || "");
    if (ct.includes("multipart/form-data")) {
      return next();
    }
    return parseJsonCampaignCreate(req, res, next);
  }
  return parseJsonDefault(req, res, next);
});

/** Form POST (alguns proxies lidam melhor com urlencoded do que com JSON no mesmo host). */
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

function isMaintenanceBypassPath(method: string, reqPath: string): boolean {
  const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
  if (p === "/webhooks/asaas" || p === "/webhooks/evolution") return true;
  if (method !== "GET" && method !== "HEAD") return false;
  return (
    p === "/health" ||
    p === "/ready" ||
    p === "/service/maintenance" ||
    p === "/maintenance"
  );
}

function isDistStaticAssetPath(reqPath: string): boolean {
  return /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(
    String(reqPath || "")
  );
}

const maintenanceHtmlPage = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manutenção</title><style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#0f1419;color:#e6edf3;}
.box{max-width:28rem;padding:2rem;text-align:center;}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:0;opacity:.85;line-height:1.5}</style></head>
<body><div class="box"><h1>Manutenção em andamento</h1><p>__MSG__</p></div></body></html>`;

app.use((req, res, next) => {
  if (!MAINTENANCE_MODE) {
    return next();
  }
  if (isMaintenanceBypassPath(req.method, req.path)) {
    return next();
  }
  res.set("Retry-After", String(MAINTENANCE_RETRY_AFTER_SEC));
  const norm = String(req.path || "/").replace(/\/+$/, "") || "/";
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    isDistStaticAssetPath(req.path)
  ) {
    return next();
  }
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    (norm === "/" || norm === "/index.html")
  ) {
    const safe = MAINTENANCE_MESSAGE.replace(/</g, "&lt;");
    return res
      .status(503)
      .type("html")
      .send(maintenanceHtmlPage.replace("__MSG__", safe));
  }
  return res.status(503).json({
    maintenance: true,
    message: MAINTENANCE_MESSAGE,
    retryAfterSec: MAINTENANCE_RETRY_AFTER_SEC,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    deployMarker: WABA_DEPLOY_MARKER,
    wabaEnv: WABA_ENV,
    uiProfile: resolveUiProfile(),
    basePath: BASE_PATH || "/",
    port: PORT,
    maintenanceMode: MAINTENANCE_MODE,
    runtimeMode: RUNTIME_MODE,
    backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
    aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
    evoApiBase: describeEvoApiBaseForOps(EVO_API_BASE),
    evoTlsInsecure: isEvoTlsInsecure(),
    evoHttpTimeoutMs: defaultEvoHttpTimeoutMs(),
  });
});

app.get("/ready", (_req, res) => {
  if (MAINTENANCE_MODE) {
    return res.status(503).json({
      ok: false,
      ready: false,
      maintenanceMode: true,
      message: MAINTENANCE_MESSAGE,
      retryAfterSec: MAINTENANCE_RETRY_AFTER_SEC,
    });
  }
  res.json({
    ok: true,
    ready: true,
    maintenanceMode: false,
    port: PORT,
    runtimeMode: RUNTIME_MODE,
    backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
  });
});

app.get("/service/maintenance", (_req, res) => {
  res.json({
    maintenance: MAINTENANCE_MODE,
    message: MAINTENANCE_MODE ? MAINTENANCE_MESSAGE : null,
    retryAfterSec: MAINTENANCE_MODE ? MAINTENANCE_RETRY_AFTER_SEC : null,
    port: PORT,
  });
});

app.get("/maintenance", (_req, res) => {
  if (!MAINTENANCE_MODE) {
    return res.redirect(302, "/");
  }
  const safe = MAINTENANCE_MESSAGE.replace(/</g, "&lt;");
  res.status(503).type("html").send(maintenanceHtmlPage.replace("__MSG__", safe));
});

registerWabaCors(app);
registerWabaAuthRoutes(app);
registerWabaSubscriberRoutes(app);
registerWabaEntitlementRoutes(app);
app.use(wabaRequireAuthMiddleware);

const wabaEntitlementService = new WabaEntitlementService();

async function rejectForeignInstance(
  req: express.Request,
  res: express.Response,
  instanceName: string
): Promise<boolean> {
  const auth = resolveWabaRequestAuth(req);
  if (!(await wabaInstanceOwnershipService.canAccessInstance(auth, instanceName))) {
    res.status(403).json({
      error: "Esta instância pertence a outro usuário ou você não tem permissão para acessá-la.",
    });
    return true;
  }
  return false;
}

function rejectForeignInstanceNames(req: express.Request, instanceNames: string[]): Promise<Set<string>> {
  const auth = resolveWabaRequestAuth(req);
  return wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, instanceNames);
}

async function filterEvoTagRowsForRequest(
  req: express.Request,
  rows: EvoInstanceTagRow[]
): Promise<EvoInstanceTagRow[]> {
  const auth = resolveWabaRequestAuth(req);
  const allowed = await wabaInstanceOwnershipService.filterInstanceNamesForAuth(
    auth,
    rows.map((r) => r.instanceKey)
  );
  const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
  return rows.filter((r) => allowedLower.has(r.instanceKey.toLowerCase()));
}

async function fetchEvoInstanceTagRowsForRequest(req: express.Request): Promise<EvoInstanceTagRow[]> {
  const rows = await fetchEvoInstanceTagRows();
  return filterEvoTagRowsForRequest(req, rows);
}

async function filterConnectedInstanciasForRequest(
  req: express.Request,
  connected: Array<{ instancia: string; numero: string }>
): Promise<Array<{ instancia: string; numero: string }>> {
  const auth = resolveWabaRequestAuth(req);
  const allowed = await wabaInstanceOwnershipService.filterInstanceNamesForAuth(
    auth,
    connected.map((c) => c.instancia)
  );
  const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
  return connected.filter((c) => allowedLower.has(c.instancia.toLowerCase()));
}

function rejectAquecedorWithoutEntitlement(req: express.Request, res: express.Response): boolean {
  const auth = resolveWabaRequestAuth(req);
  const entitlement = wabaEntitlementService.getAquecedorEntitlement(auth.email, auth.role);
  if (entitlement.active) return false;
  res.status(403).json({
    error: entitlement.message,
    code: entitlement.reason,
    entitlement,
  });
  return true;
}

// Supabase (criado sob demanda para evitar travamentos quando faltar config)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function resetSupabaseClient() {
  supabaseClient = null;
}
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

function isSupabaseTransientError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSupabaseUrlHost(): string | null {
  try {
    const raw = String(process.env.SUPABASE_URL || "").trim();
    if (!raw) return null;
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

async function describeSupabaseConnectivityFailure(): Promise<string> {
  const host = getSupabaseUrlHost();
  if (!host) {
    return "SUPABASE_URL inválida ou ausente no servidor (Easypanel → Environment).";
  }
  if (!String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY ausente no servidor (Easypanel → Environment).";
  }
  try {
    await lookup(host);
  } catch (err) {
    const code = String((err as NodeJS.ErrnoException)?.code || "");
    if (code === "ENOTFOUND" || code === "ESERVFAIL") {
      return `SUPABASE_URL incorreta: o host "${host}" não existe no DNS. Copie a Project URL no dashboard Supabase.`;
    }
    return `Supabase inacessível em "${host}" (${code || "erro de rede"}). Verifique SUPABASE_URL no Easypanel.`;
  }
  return `Conexão com Supabase em "${host}" falhou após 3 tentativas. Confira service_role key e se o projeto está ativo.`;
}

function normalizeInstanceUsageRow(row: any): InstanceUsageConfig {
  return {
    useAquecedor: row?.use_aquecedor !== false,
    useDisparador: row?.use_disparador !== false,
    useFazenda: row?.use_fazenda === true,
    updatedAt: String(row?.updated_at || new Date().toISOString()),
  };
}

function getInstanceUsageFromMap(
  map: Map<string, InstanceUsageConfig>,
  instanceName: string,
): InstanceUsageConfig | undefined {
  const key = String(instanceName || "").trim();
  if (!key) return undefined;
  const direct = map.get(key);
  if (direct) return direct;
  const target = key.toLowerCase();
  for (const [mapKey, value] of map.entries()) {
    if (mapKey.toLowerCase() === target) return value;
  }
  return undefined;
}

async function loadInstanceUsageMap(): Promise<Map<string, InstanceUsageConfig>> {
  const result = new Map<string, InstanceUsageConfig>();
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await (supabase
        .from("instancias_uso_config" as any)
        .select("instance_name, use_aquecedor, use_disparador, use_fazenda, updated_at")
        .limit(2000)) as any;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const key = String(row?.instance_name || "").trim();
          if (!key) continue;
          result.set(key, normalizeInstanceUsageRow(row));
        }
      }
    } catch {
      // fallback em memória
    }
  }
  for (const [k, v] of instanceUsageMemory.entries()) {
    if (!result.has(k)) result.set(k, v);
  }
  return result;
}

async function persistInstanceUsage(
  items: Array<{ instanceName: string; useAquecedor: boolean; useDisparador: boolean; useFazenda?: boolean }>
) {
  const now = new Date().toISOString();
  const usageMap = await loadInstanceUsageMap();
  for (const item of items) {
    const key = String(item.instanceName || "").trim();
    if (!key) continue;
    const previous = instanceUsageMemory.get(key) || getInstanceUsageFromMap(usageMap, key);
    const useFazenda =
      item.useFazenda !== undefined ? item.useFazenda === true : previous?.useFazenda === true;
    instanceUsageMemory.set(key, {
      useAquecedor: item.useAquecedor !== false,
      useDisparador: item.useDisparador !== false,
      useFazenda,
      updatedAt: now,
    });
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const rows = items
      .map((item) => {
        const key = String(item.instanceName || "").trim();
        const previous = instanceUsageMemory.get(key);
        return {
          instance_name: key,
          use_aquecedor: item.useAquecedor !== false,
          use_disparador: item.useDisparador !== false,
          use_fazenda: previous?.useFazenda === true,
          updated_at: now,
        };
      })
      .filter((r) => r.instance_name);
    if (!rows.length) return;
    await (supabase.from("instancias_uso_config" as any) as any).upsert(rows, {
      onConflict: "instance_name",
    });
  } catch {
    // fallback em memória
  }
}

setIntegrationProbeFinishedHandler((status) => {
  if (!status.restrictionSuspected) return;
  void (async () => {
    const usageMap = await loadInstanceUsageMap();
    const current = getInstanceUsageFromMap(usageMap, status.sourceInstance);
    await persistInstanceUsage([
      {
        instanceName: status.sourceInstance,
        useAquecedor: current?.useAquecedor !== false,
        useDisparador: false,
      },
    ]);
  })();
});

setInboundValidationFinishedHandler((status) => {
  if (!status.restrictionSuspected) return;
  void (async () => {
    const usageMap = await loadInstanceUsageMap();
    const current = getInstanceUsageFromMap(usageMap, status.instanceName);
    await persistInstanceUsage([
      {
        instanceName: status.instanceName,
        useAquecedor: current?.useAquecedor !== false,
        useDisparador: false,
      },
    ]);
  })();
});

function parseDisparosConfig(input: any): DisparosConfig {
  const readInt = (value: any, min: number, max: number, fallback: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.floor(n);
    if (v < min || v > max) return fallback;
    return v;
  };
  const workingDays = Array.isArray(input?.workingDays)
    ? input.workingDays
        .map((d: any) => String(d || "").toLowerCase().trim())
        .filter((d: string) => DAY_CODES.includes(d as any))
    : DISPAROS_DEFAULTS.workingDays;
  const provider = String(input?.shortenerProvider || DISPAROS_DEFAULTS.shortenerProvider).toLowerCase();
  const safeProvider: DisparosConfig["shortenerProvider"] =
    provider === "encurtadorpro" ||
    provider === "isgd" ||
    provider === "tinyurl" ||
    provider === "waba"
      ? (provider as DisparosConfig["shortenerProvider"])
      : "waba";
  const mode = String(input?.messageMode || DISPAROS_DEFAULTS.messageMode).toLowerCase();
  const safeMode: DisparosConfig["messageMode"] = mode === "database" ? "database" : "ai";
  const selectedRaw =
    input?.selectedDisparadorInstances ?? input?.selected_disparador_instances;
  const selectedDisparadorInstances: string[] = Array.isArray(selectedRaw)
    ? Array.from(
        new Set(
          selectedRaw
            .map((n: any) => String(n || "").trim())
            .filter((n: string) => n.length > 0)
        )
      )
    : [];
  const delayMin = readInt(input?.delayMinSeconds, 10, 3600, DISPAROS_DEFAULTS.delayMinSeconds);
  const delayMax = readInt(input?.delayMaxSeconds, 10, 3600, DISPAROS_DEFAULTS.delayMaxSeconds);
  const safeDelayMin = Math.min(delayMin, delayMax);
  const safeDelayMax = Math.max(delayMin, delayMax);

  // Regra segura de lock:
  // - TTL não é controlado pelo usuário.
  // - Baseado no maior delay configurado, com margem de segurança.
  // - Limites fixos para evitar lock curto/demorado demais.
  const ttlBase = safeDelayMax * 3;
  const safeLockTtl = Math.max(180, Math.min(1800, ttlBase));
  return {
    lockTtlSeconds: safeLockTtl,
    delayMinSeconds: safeDelayMin,
    delayMaxSeconds: safeDelayMax,
    maxPerHourPerInstance: readInt(
      input?.maxPerHourPerInstance,
      1,
      10000,
      DISPAROS_DEFAULTS.maxPerHourPerInstance
    ),
    maxPerDayPerInstance: readInt(
      input?.maxPerDayPerInstance,
      1,
      200000,
      DISPAROS_DEFAULTS.maxPerDayPerInstance
    ),
    workingDays: workingDays.length ? Array.from(new Set(workingDays)) : [...DISPAROS_DEFAULTS.workingDays],
    startHour: readInt(input?.startHour, 0, 23, DISPAROS_DEFAULTS.startHour),
    endHour: readInt(input?.endHour, 1, 24, DISPAROS_DEFAULTS.endHour),
    messageMode: safeMode,
    aiBriefing: String(input?.aiBriefing || "").slice(0, 8000),
    aiTone: String(input?.aiTone || DISPAROS_DEFAULTS.aiTone).slice(0, 120),
    aiCta: String(input?.aiCta || DISPAROS_DEFAULTS.aiCta).slice(0, 240),
    aiAudience: String(input?.aiAudience || DISPAROS_DEFAULTS.aiAudience).slice(0, 240),
    shortenerProvider: safeProvider,
    shortenerDomain: String(input?.shortenerDomain || "").slice(0, 120),
    whatsappTargetNumber: normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || "")),
    selectedDisparadorInstances,
  };
}

function validateRequiredDisparosConfigPayload(input: any): string | null {
  if (!input || typeof input !== "object") return "Objeto 'config' é obrigatório.";
  const hasValue = (key: string) => {
    const raw = input?.[key];
    if (raw == null) return false;
    if (typeof raw === "string") return raw.trim().length > 0;
    if (Array.isArray(raw)) return raw.length > 0;
    return true;
  };
  const requiredKeys = [
    "delayMinSeconds",
    "delayMaxSeconds",
    "maxPerHourPerInstance",
    "maxPerDayPerInstance",
    "startHour",
    "endHour",
    "workingDays",
    "selectedDisparadorInstances",
    "whatsappTargetNumber",
    "messageMode",
  ];
  for (const key of requiredKeys) {
    if (!hasValue(key)) return `Campo obrigatório ausente no Disparador: ${key}.`;
  }
  const mode = String(input?.messageMode || "").toLowerCase();
  if (mode === "ai") {
    const aiRequired = ["aiTone", "aiCta", "aiAudience", "aiBriefing"];
    for (const key of aiRequired) {
      if (!hasValue(key)) return `Campo obrigatório ausente no modo IA: ${key}.`;
    }
  }
  return null;
}

function isLegacyDisparosDefaultConfig(input: any): boolean {
  if (!input || typeof input !== "object") return false;
  const toInt = (v: any) => Math.floor(Number(v));
  const delayMin = toInt(input.delayMinSeconds);
  const delayMax = toInt(input.delayMaxSeconds);
  const maxPerHour = toInt(input.maxPerHourPerInstance);
  const maxPerDay = toInt(input.maxPerDayPerInstance);
  return (
    delayMin === 90 &&
    delayMax === 240 &&
    maxPerHour === 60 &&
    maxPerDay === 130
  );
}

async function loadDisparosConfigFromDb(): Promise<DisparosConfig> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...DISPAROS_DEFAULTS };
  try {
    const { data, error } = await (supabase
      .from("disparos_config" as any)
      .select("custom_config")
      .eq("id", 1)
      .maybeSingle()) as any;
    if (error) return { ...DISPAROS_DEFAULTS };
    const raw = data?.custom_config || null;
    if (isLegacyDisparosDefaultConfig(raw)) {
      const migrated = parseDisparosConfig({
        ...raw,
        delayMinSeconds: DISPAROS_DEFAULTS.delayMinSeconds,
        delayMaxSeconds: DISPAROS_DEFAULTS.delayMaxSeconds,
        maxPerHourPerInstance: DISPAROS_DEFAULTS.maxPerHourPerInstance,
        maxPerDayPerInstance: DISPAROS_DEFAULTS.maxPerDayPerInstance,
      });
      await saveDisparosConfigToDb(migrated);
      return migrated;
    }
    return parseDisparosConfig(raw || DISPAROS_DEFAULTS);
  } catch {
    return { ...DISPAROS_DEFAULTS };
  }
}

async function saveDisparosConfigToDb(config: DisparosConfig) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await (supabase.from("disparos_config" as any) as any).upsert(
      {
        id: 1,
        custom_config: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // fallback silencioso
  }
}

const EVO_API_URL =
  process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080";
const EVO_API_BASE = EVO_API_URL.replace(/\/$/, "");
const EVO_INSTANCES_URL =
  process.env.EVO_INSTANCES_URL ||
  `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_API_KEY =
  process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";
const EVO_REFRESH_URL_TEMPLATE =
  process.env.EVO_REFRESH_URL_TEMPLATE || "";
const EVO_QRCODE_URL_TEMPLATE =
  process.env.EVO_QRCODE_URL_TEMPLATE ||
  `${EVO_API_BASE}/instance/connect/{instance}`;
const EVO_DELETE_URL_TEMPLATE =
  process.env.EVO_DELETE_URL_TEMPLATE ||
  `${EVO_API_BASE}/instance/delete/{instance}`;
const EVO_RENAME_URL_TEMPLATE =
  process.env.EVO_RENAME_URL_TEMPLATE || `${EVO_API_BASE}/instance/rename/{instance}`;
const EVO_CREATE_INSTANCE_URL =
  process.env.EVO_CREATE_INSTANCE_URL || `${EVO_API_BASE}/instance/create`;
const EVO_SEND_TEXT_URL_TEMPLATE =
  process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EVO_LIVE_PROFILE_SYNC =
  process.env.EVO_LIVE_PROFILE_SYNC === "0" || process.env.EVO_LIVE_PROFILE_SYNC === "false"
    ? false
    : true;
const INSTANCE_ALIASES_FILE = resolveDataFile("instance-aliases.json");
const WHATSAPP_PROFILE_NAMES_FILE = resolveDataFile("whatsapp-profile-names.json");
/** Backup local de campanhas + leads (sobrevive a restart; não substitui Supabase quando ambos existem). */
const DISPAROS_LOCAL_STATE_FILE = resolveDataFile("disparos-local-state.json");
/** Última intenção explícita: aquecedor ligado/desligado (retoma após restart do processo na porta 3000). */
const RUNTIME_INTENT_FILE = resolveDataFile("runtime-intent.json");
const AQUECEDOR_CONFIG_FILE = resolveDataFile("aquecedor-config.json");
const AQUECEDOR_ENVIOS_LOG_FILE = resolveDataFile("aquecedor-envios-log.json");

type AquecedorEnvioLogRow = {
  id: string;
  ownerEmail: string;
  instanciaOrigem: string;
  instanciaDestino: string;
  dataEnvio: string;
  status: "Envio com Sucesso" | "Em Fila";
};

async function readAquecedorEnviosLog(): Promise<AquecedorEnvioLogRow[]> {
  try {
    const raw = await fs.readFile(AQUECEDOR_ENVIOS_LOG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { items?: AquecedorEnvioLogRow[] };
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function appendAquecedorEnvioLog(
  row: Omit<AquecedorEnvioLogRow, "id">
): Promise<void> {
  const items = await readAquecedorEnviosLog();
  items.unshift({ ...row, id: crypto.randomUUID() });
  await fs.mkdir(path.dirname(AQUECEDOR_ENVIOS_LOG_FILE), { recursive: true });
  const tmp = `${AQUECEDOR_ENVIOS_LOG_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ items: items.slice(0, 500) }, null, 2), "utf-8");
  await fs.rename(tmp, AQUECEDOR_ENVIOS_LOG_FILE);
}

async function recordAquecedorEnvio(params: {
  instanciaOrigem: string;
  instanciaDestino: string;
  dataEnvio?: string;
  status: "Envio com Sucesso" | "Em Fila";
  ownerEmail?: string | null;
}): Promise<void> {
  const ownerEmail = String(
    params.ownerEmail ?? aquecedorRuntimeOwnerEmail ?? ""
  )
    .trim()
    .toLowerCase();
  await appendAquecedorEnvioLog({
    ownerEmail,
    instanciaOrigem: params.instanciaOrigem,
    instanciaDestino: params.instanciaDestino,
    dataEnvio: params.dataEnvio || new Date().toISOString(),
    status: params.status,
  });
}

function aquecedorEnvioMatchesOwner(
  instanciaOrigem: string,
  instanciaDestino: string,
  allowed: Set<string> | null
): boolean {
  if (!allowed) return true;
  const origin = String(instanciaOrigem || "").trim().toLowerCase();
  const dest = String(instanciaDestino || "").trim().toLowerCase();
  return (
    (origin.length > 0 && allowed.has(origin)) ||
    (dest.length > 0 && allowed.has(dest))
  );
}

async function resolveAquecedorEnviosAllowedInstances(
  ownerEmail: string
): Promise<Set<string> | null> {
  if (!isWabaAuthConfigured()) return null;
  const names = await wabaInstanceOwnershipService.listOwnedInstanceNames(ownerEmail);
  return new Set(names.map((name) => name.toLowerCase()));
}

const AQUECEDOR_FALLBACK_MESSAGE = "Olá! Tudo bem? Mensagem automática do aquecedor.";
const AQUECEDOR_RECENT_SENT_LIMIT = 50;
const AQUECEDOR_MESSAGE_BANK_LIMIT = 5000;
const AQUECEDOR_PAIR_SENT_LIMIT = 500;

type AquecedorPairContext = {
  instanciaOrigem: string;
  instanciaDestino: string;
  numeroOrigem: string;
  numeroDestino: string;
};

function buildAquecedorPairContext(
  chosen: { instancia_origem: string; instancia_destino: string; numero_whatsapp: string },
  connected: Array<{ instancia: string; numero: string }>,
): AquecedorPairContext {
  const origem = connected.find((item) => item.instancia === chosen.instancia_origem);
  return {
    instanciaOrigem: chosen.instancia_origem,
    instanciaDestino: chosen.instancia_destino,
    numeroOrigem: String(origem?.numero || "").trim(),
    numeroDestino: String(chosen.numero_whatsapp || "").trim(),
  };
}

const AQUECEDOR_PAIR_SENDER_LOOKBACK = 500;

function buildAquecedorInstanceCanonicalMap(
  connected: Array<{ instancia: string }>,
  aliasesMap: Map<string, string>,
): Map<string, string> {
  const primaryByLower = new Map<string, string>();
  for (const item of connected) {
    const name = String(item.instancia || "").trim();
    if (name) primaryByLower.set(name.toLowerCase(), name);
  }
  const canonical = new Map<string, string>();
  const bind = (raw: string, primary: string) => {
    const key = String(raw || "").trim().toLowerCase();
    const value = String(primary || "").trim();
    if (key && value) canonical.set(key, value);
  };
  for (const item of connected) {
    bind(item.instancia, item.instancia);
  }
  for (const [technical, alias] of aliasesMap) {
    const primary = primaryByLower.get(String(technical || "").trim().toLowerCase()) || String(technical || "").trim();
    if (!primary) continue;
    bind(technical, primary);
    bind(alias, primary);
  }
  return canonical;
}

function resolveAquecedorCanonicalInstance(
  name: string,
  canonicalMap: Map<string, string>,
): string {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return "";
  return canonicalMap.get(key) || String(name || "").trim();
}

function buildAquecedorPairKey(instanciaA: string, instanciaB: string): string {
  const a = String(instanciaA || "").trim();
  const b = String(instanciaB || "").trim();
  return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}

function buildAquecedorNumberToInstanceMap(
  connected: Array<{ instancia: string; numero: string }>,
  canonicalMap: Map<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of connected) {
    const num = normalizeWhatsAppNumber(String(item.numero || "").trim());
    const inst = resolveAquecedorCanonicalInstance(item.instancia, canonicalMap);
    if (num && inst) map.set(num, inst);
  }
  return map;
}

function resolveAquecedorInstanceByNumber(
  rawNumber: string,
  numberToInstance: Map<string, string>,
): string {
  const normalized = normalizeWhatsAppNumber(String(rawNumber || "").trim());
  if (!normalized) return "";
  const direct = numberToInstance.get(normalized);
  if (direct) return direct;
  const suffix = normalized.replace(/\D/g, "").slice(-10);
  if (suffix.length < 10) return "";
  for (const [stored, inst] of numberToInstance.entries()) {
    if (stored.replace(/\D/g, "").slice(-10) === suffix) return inst;
  }
  return "";
}

function resolveAquecedorConnectedByName(
  connected: Array<{ instancia: string; numero: string }>,
  canonicalMap: Map<string, string>,
  name: string,
): { instancia: string; numero: string } | null {
  const target = resolveAquecedorCanonicalInstance(name, canonicalMap).toLowerCase();
  return (
    connected.find(
      (item) =>
        resolveAquecedorCanonicalInstance(item.instancia, canonicalMap).toLowerCase() === target,
    ) || null
  );
}

async function loadAquecedorExchangeEvents(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  canonicalMap: Map<string, string>,
  numberToInstance: Map<string, string>,
): Promise<Array<{ at: string; fromInst: string; toInst: string }>> {
  const events: Array<{ at: string; fromInst: string; toInst: string }> = [];
  const instanceNames = connected.map((item) => item.instancia);

  const connectedCanonical = new Set(
    instanceNames.map((name) => resolveAquecedorCanonicalInstance(name, canonicalMap).toLowerCase()),
  );

  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("instancia, numero_destino, sent_at")
      .eq("status", "ENVIADO")
      .order("sent_at", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK)) as any);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const fromInst = resolveAquecedorCanonicalInstance(String(row?.instancia || ""), canonicalMap);
        const toInst = resolveAquecedorInstanceByNumber(
          String(row?.numero_destino || ""),
          numberToInstance,
        );
        const at = String(row?.sent_at || "").trim();
        if (
          fromInst &&
          toInst &&
          at &&
          connectedCanonical.has(fromInst.toLowerCase()) &&
          connectedCanonical.has(toInst.toLowerCase())
        ) {
          events.push({ at, fromInst, toInst });
        }
      }
    }
  } catch {
    /* */
  }

  try {
    const { data, error } = (await (supabase
      .from("logs_envios" as any)
      .select("instancia_origem, instancia_destino, data_envio")
      .order("data_envio", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK)) as any);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const fromInst = resolveAquecedorCanonicalInstance(
          String(row?.instancia_origem || ""),
          canonicalMap,
        );
        const toInst = resolveAquecedorCanonicalInstance(
          String(row?.instancia_destino || ""),
          canonicalMap,
        );
        const at = String(row?.data_envio || "").trim();
        if (
          fromInst &&
          toInst &&
          at &&
          connectedCanonical.has(fromInst.toLowerCase()) &&
          connectedCanonical.has(toInst.toLowerCase())
        ) {
          events.push({ at, fromInst, toInst });
        }
      }
    }
  } catch {
    /* */
  }

  const dedup = new Map<string, { at: string; fromInst: string; toInst: string }>();
  for (const ev of events) {
    const atMs = new Date(ev.at).getTime();
    const bucket = Number.isFinite(atMs) ? Math.floor(atMs / 1000) : ev.at;
    const key = `${ev.fromInst.toLowerCase()}|${ev.toInst.toLowerCase()}|${bucket}`;
    if (!dedup.has(key)) dedup.set(key, ev);
  }

  return Array.from(dedup.values()).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

type AquecedorInstanceTurnStats = {
  canonical: string;
  lastSentAt: string | null;
  lastReceivedAt: string | null;
  lastReceivedFrom: string | null;
  sendCount: number;
  receiveCount: number;
  /** Envios desde o último inbound (0 = liberado para novo envio). */
  outboundSinceInbound: number;
};

type AquecedorPairConversationState = {
  /** Instância canônica que deve enviar a próxima mensagem neste par (A→B aguardando B→A). */
  pendingReplyFrom: string | null;
  exchangeCount: number;
};

type AquecedorTurnManager = {
  canonicalMap: Map<string, string>;
  totalEvents: number;
  canSendDirected: (origemRaw: string, destinoRaw: string) => boolean;
  owesPairReply: (origemRaw: string, destinoRaw: string) => boolean;
  describeBlockReason: (origemRaw: string, destinoRaw: string) => string;
  scoreCombination: (
    origemRaw: string,
    destinoRaw: string,
    comboIndex: number,
    startIndex: number,
  ) => number;
};

async function loadAquecedorTurnManager(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
): Promise<AquecedorTurnManager> {
  const aliasesMap = await loadInstanceAliasesMap();
  const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
  const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
  const events = await loadAquecedorExchangeEvents(
    supabase,
    connected,
    canonicalMap,
    numberToInstance,
  );

  const instanceStats = new Map<string, AquecedorInstanceTurnStats>();
  const pairLastSender = new Map<string, string>();
  const pairStates = new Map<string, AquecedorPairConversationState>();

  const ensureStats = (canonical: string): AquecedorInstanceTurnStats => {
    const key = canonical.toLowerCase();
    let stats = instanceStats.get(key);
    if (!stats) {
      stats = {
        canonical,
        lastSentAt: null,
        lastReceivedAt: null,
        lastReceivedFrom: null,
        sendCount: 0,
        receiveCount: 0,
        outboundSinceInbound: 0,
      };
      instanceStats.set(key, stats);
    }
    return stats;
  };

  const ensurePairState = (pairKey: string): AquecedorPairConversationState => {
    let state = pairStates.get(pairKey);
    if (!state) {
      state = { pendingReplyFrom: null, exchangeCount: 0 };
      pairStates.set(pairKey, state);
    }
    return state;
  };

  for (const ev of events) {
    const fromStats = ensureStats(ev.fromInst);
    const toStats = ensureStats(ev.toInst);
    fromStats.sendCount += 1;
    toStats.receiveCount += 1;
    fromStats.lastSentAt = ev.at;
    toStats.lastReceivedAt = ev.at;
    toStats.lastReceivedFrom = ev.fromInst;
    fromStats.outboundSinceInbound += 1;
    toStats.outboundSinceInbound = 0;
    pairLastSender.set(buildAquecedorPairKey(ev.fromInst, ev.toInst), ev.fromInst);

    const pairKey = buildAquecedorPairKey(ev.fromInst, ev.toInst);
    const pairState = ensurePairState(pairKey);
    pairState.exchangeCount += 1;
    if (pairState.pendingReplyFrom?.toLowerCase() === ev.fromInst.toLowerCase()) {
      pairState.pendingReplyFrom = null;
    } else {
      pairState.pendingReplyFrom = ev.toInst;
    }
  }

  const owesPairReply = (origemRaw: string, destinoRaw: string): boolean => {
    const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
    const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
    if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase()) return false;

    const pairKey = buildAquecedorPairKey(origem, destino);
    const pairState = pairStates.get(pairKey);
    return pairState?.pendingReplyFrom?.toLowerCase() === origem.toLowerCase();
  };

  const canSendDirected = (origemRaw: string, destinoRaw: string): boolean => {
    const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
    const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
    if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase()) return false;

    const pairKey = buildAquecedorPairKey(origem, destino);
    const lastSender = pairLastSender.get(pairKey);
    if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) {
      return false;
    }

    if (owesPairReply(origemRaw, destinoRaw)) {
      return true;
    }

    const stats = instanceStats.get(origem.toLowerCase());
    if (!stats?.lastSentAt || stats.outboundSinceInbound === 0) return true;
    return false;
  };

  const describeBlockReason = (origemRaw: string, destinoRaw: string): string => {
    const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
    const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
    const pairKey = buildAquecedorPairKey(origem, destino);
    const lastSender = pairLastSender.get(pairKey);
    const stats = instanceStats.get(origem.toLowerCase());

    if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) {
      return `${origem} já enviou para ${destino} e precisa aguardar resposta de ${destino} no par (A→B, depois B→A).`;
    }
    if (owesPairReply(origemRaw, destinoRaw)) {
      return `${origem} deve responder ${destino} neste par antes de outras combinações.`;
    }
    if (stats && stats.outboundSinceInbound > 0) {
      const esperado = stats.lastReceivedFrom
        ? ` Responder a ${stats.lastReceivedFrom} libera o turno global.`
        : "";
      return `${origem} enviou ${stats.outboundSinceInbound} vez(es) sem receber de volta; aguardando mensagem inbound antes de novo envio.${esperado}`;
    }
    return `${origem} não pode enviar para ${destino} no turno atual.`;
  };

  const scoreCombination = (
    origemRaw: string,
    destinoRaw: string,
    comboIndex: number,
    startIndex: number,
  ): number => {
    const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
    const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
    const stats = instanceStats.get(origem.toLowerCase());
    let score = 0;

    if (owesPairReply(origemRaw, destinoRaw)) {
      score -= 5_000_000;
    }

    score += (stats?.sendCount || 0) * 10_000;

    const pairKey = buildAquecedorPairKey(origem, destino);
    const pairState = pairStates.get(pairKey);
    if (pairState) {
      score += pairState.exchangeCount * 2_000;
    } else {
      score -= 100_000;
    }

    const destStats = instanceStats.get(destino.toLowerCase());
    score += (destStats?.sendCount || 0) * 1_000;

    const rotation = ((comboIndex - startIndex) % 1000 + 1000) % 1000;
    score += rotation;
    return score;
  };

  return {
    canonicalMap,
    totalEvents: events.length,
    canSendDirected,
    owesPairReply,
    describeBlockReason,
    scoreCombination,
  };
}

async function canAquecedorOrigemSendDirected(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  instanciaOrigem: string,
  instanciaDestino: string,
  manager?: AquecedorTurnManager,
): Promise<boolean> {
  const turn = manager || (await loadAquecedorTurnManager(supabase, connected));
  return turn.canSendDirected(instanciaOrigem, instanciaDestino);
}

async function pickAquecedorCombinationAsync<T extends { instancia_origem: string; instancia_destino: string }>(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  combinations: T[],
  startIndex: number,
): Promise<{ chosen: T; index: number } | null> {
  if (!combinations.length) return null;
  const manager = await loadAquecedorTurnManager(supabase, connected);
  const eligible: Array<{ combo: T; index: number; score: number }> = [];

  for (let index = 0; index < combinations.length; index += 1) {
    const combo = combinations[index];
    if (!manager.canSendDirected(combo.instancia_origem, combo.instancia_destino)) continue;
    eligible.push({
      combo,
      index,
      score: manager.scoreCombination(
        combo.instancia_origem,
        combo.instancia_destino,
        index,
        startIndex,
      ),
    });
  }

  if (!eligible.length) return null;

  const replyDue = eligible.filter((item) =>
    manager.owesPairReply(item.combo.instancia_origem, item.combo.instancia_destino),
  );
  const pool = replyDue.length ? replyDue : eligible;

  pool.sort((a, b) => a.score - b.score);
  const bestScore = pool[0].score;
  const ties = pool.filter((item) => item.score === bestScore);
  const base = ((startIndex % ties.length) + ties.length) % ties.length;
  const picked = ties[base];
  return { chosen: picked.combo, index: picked.index };
}

async function loadRecentAquecedorPairLastSenders(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
): Promise<Map<string, string>> {
  const aliasesMap = await loadInstanceAliasesMap();
  const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
  const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
  const lastSenders = new Map<string, string>();
  const instanceNames = connected.map((item) => item.instancia);
  if (instanceNames.length < 2) return lastSenders;

  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("instancia, numero_destino, sent_at")
      .eq("status", "ENVIADO")
      .in("instancia", instanceNames)
      .order("sent_at", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK)) as any);
    if (error || !Array.isArray(data)) return lastSenders;

    for (const row of data) {
      const fromInst = resolveAquecedorCanonicalInstance(String(row?.instancia || ""), canonicalMap);
      const toInst = resolveAquecedorInstanceByNumber(
        String(row?.numero_destino || ""),
        numberToInstance,
      );
      if (!fromInst || !toInst || fromInst.toLowerCase() === toInst.toLowerCase()) continue;
      const key = buildAquecedorPairKey(fromInst, toInst);
      if (lastSenders.has(key)) continue;
      lastSenders.set(key, fromInst);
    }
  } catch {
    /* */
  }

  return lastSenders;
}

async function verifyAquecedorConversationTurn(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  instanciaOrigem: string,
  instanciaDestino: string,
): Promise<{ ok: boolean; reason: string }> {
  const manager = await loadAquecedorTurnManager(supabase, connected);
  const origem = resolveAquecedorCanonicalInstance(
    instanciaOrigem,
    manager.canonicalMap,
  );
  const destino = resolveAquecedorCanonicalInstance(
    instanciaDestino,
    manager.canonicalMap,
  );

  if (!manager.canSendDirected(instanciaOrigem, instanciaDestino)) {
    return {
      ok: false,
      reason: manager.describeBlockReason(instanciaOrigem, instanciaDestino),
    };
  }

  return { ok: true, reason: "" };
}

function buildAquecedorEnvioDedupKey(item: {
  instanciaOrigem: string;
  instanciaDestino: string;
  dataEnvio: string | null;
  dataEnvioBr: string;
  status: "Em Fila" | "Envio com Sucesso";
}): string {
  if (item.status === "Envio com Sucesso") {
    return `${item.instanciaOrigem}|${item.instanciaDestino}|${item.dataEnvioBr}|${item.status}`;
  }
  const ts = item.dataEnvio ? String(item.dataEnvio) : "";
  return `${item.instanciaOrigem}|${item.instanciaDestino}|${ts}|${item.status}`;
}

async function hasRecentAquecedorSendBetween(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  instanciaOrigem: string,
  instanciaDestino: string,
  withinSeconds: number,
): Promise<boolean> {
  const aliasesMap = await loadInstanceAliasesMap();
  const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
  const origem = resolveAquecedorConnectedByName(connected, canonicalMap, instanciaOrigem);
  const destino = resolveAquecedorConnectedByName(connected, canonicalMap, instanciaDestino);
  if (!origem || !destino) return false;

  const numDestino = normalizeWhatsAppNumber(destino.numero);
  if (!numDestino) return false;
  const since = new Date(Date.now() - Math.max(30, withinSeconds) * 1000).toISOString();

  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("id")
      .eq("status", "ENVIADO")
      .eq("instancia", origem.instancia)
      .eq("numero_destino", numDestino)
      .gte("sent_at", since)
      .limit(1)) as any);
    if (!error && Array.isArray(data) && data.length > 0) return true;
  } catch {
    /* */
  }

  try {
    const { data, error } = (await (supabase
      .from("logs_envios" as any)
      .select("id")
      .eq("instancia_origem", origem.instancia)
      .eq("instancia_destino", destino.instancia)
      .gte("data_envio", since)
      .limit(1)) as any);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

const isAquecedorSystemMessage = (text: string): boolean => {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return true;
  return (
    value === AQUECEDOR_FALLBACK_MESSAGE.toLowerCase() ||
    value.includes("mensagem de teste do aquecedor") ||
    value.includes("teste de integração waba")
  );
};

const collectAquecedorMessageTexts = (rows: unknown, fields: string[]): string[] => {
  const texts: string[] = [];
  if (!Array.isArray(rows)) return texts;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const field of fields) {
      const text = String((row as Record<string, unknown>)[field] || "").trim();
      if (text && !isAquecedorSystemMessage(text)) {
        texts.push(text);
        break;
      }
    }
  }
  return texts;
};

async function loadAquecedorMessageBank(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<string[]> {
  const unique = new Set<string>();

  const bankQueries: Array<{ table: string; fields: string[]; activeOnly?: boolean }> = [
    { table: "aquecedor_message_templates", fields: ["message_text"], activeOnly: true },
    { table: "mensagens", fields: ["mensagem", "texto", "message_text", "conteudo"] },
    { table: "disparos_message_templates", fields: ["message_text"], activeOnly: true },
  ];

  for (const query of bankQueries) {
    try {
      let request = supabase
        .from(query.table as any)
        .select(query.fields.join(", "))
        .limit(AQUECEDOR_MESSAGE_BANK_LIMIT);
      if (query.activeOnly) {
        request = request.eq("active", true);
      }
      const { data, error } = (await request) as { data: unknown; error: { message?: string } | null };
      if (error) continue;
      for (const text of collectAquecedorMessageTexts(data, query.fields)) {
        unique.add(text);
      }
    } catch {
      /* tabela pode não existir neste ambiente */
    }
    if (unique.size > 0) break;
  }

  if (!unique.size) {
    try {
      const { data, error } = (await (supabase
        .from("aquecedor" as any)
        .select("mensagem")
        .eq("status", "ENVIADO")
        .order("sent_at", { ascending: false })
        .limit(AQUECEDOR_MESSAGE_BANK_LIMIT)) as any);
      if (!error) {
        for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
          unique.add(text);
        }
      }
    } catch {
      /* */
    }
  }

  return Array.from(unique);
}

async function loadRecentlySentAquecedorMessages(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<Set<string>> {
  const recent = new Set<string>();
  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("mensagem")
      .eq("status", "ENVIADO")
      .order("sent_at", { ascending: false })
      .limit(AQUECEDOR_RECENT_SENT_LIMIT)) as any);
    if (error) return recent;
    for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
      recent.add(text);
    }
  } catch {
    /* */
  }
  return recent;
}

async function loadQueuedAquecedorMessages(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<Set<string>> {
  const queued = new Set<string>();
  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("mensagem")
      .in("status", ["PENDENTE", "PROCESSANDO"])
      .limit(200)) as any);
    if (error) return queued;
    for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
      queued.add(text);
    }
  } catch {
    /* */
  }
  return queued;
}

async function loadPairUsedAquecedorMessages(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  pair: AquecedorPairContext,
): Promise<Set<string>> {
  const used = new Set<string>();
  const instanciaA = String(pair.instanciaOrigem || "").trim();
  const instanciaB = String(pair.instanciaDestino || "").trim();
  const numA = normalizeWhatsAppNumber(String(pair.numeroOrigem || "").trim());
  const numB = normalizeWhatsAppNumber(String(pair.numeroDestino || "").trim());
  if (!instanciaA || !instanciaB || !numA || !numB) return used;

  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("mensagem, instancia, numero_destino")
      .eq("status", "ENVIADO")
      .in("instancia", [instanciaA, instanciaB])
      .order("sent_at", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENT_LIMIT)) as any);
    if (error) return used;
    if (!Array.isArray(data)) return used;
    for (const row of data) {
      const inst = String(row?.instancia || "").trim();
      const numDest = normalizeWhatsAppNumber(String(row?.numero_destino || "").trim());
      const isAB = inst === instanciaA && numDest === numB;
      const isBA = inst === instanciaB && numDest === numA;
      if (!isAB && !isBA) continue;
      const text = String(row?.mensagem || "").trim();
      if (text && !isAquecedorSystemMessage(text)) used.add(text);
    }
  } catch {
    /* */
  }
  return used;
}

async function buildAquecedorExcludeSet(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  pair?: AquecedorPairContext | null,
): Promise<Set<string>> {
  const exclude = await loadRecentlySentAquecedorMessages(supabase);
  const queued = await loadQueuedAquecedorMessages(supabase);
  for (const text of queued) exclude.add(text);
  if (pair) {
    const pairUsed = await loadPairUsedAquecedorMessages(supabase, pair);
    for (const text of pairUsed) exclude.add(text);
  }
  return exclude;
}

async function pickAquecedorMessageText(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  extraExclude?: Set<string>,
): Promise<string> {
  const bank = await loadAquecedorMessageBank(supabase);
  if (!bank.length) return AQUECEDOR_FALLBACK_MESSAGE;

  const exclude = extraExclude ? new Set(extraExclude) : await buildAquecedorExcludeSet(supabase);
  let candidates = bank.filter((text) => !exclude.has(text));
  if (!candidates.length) candidates = bank;

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] || AQUECEDOR_FALLBACK_MESSAGE;
}

async function resolveAquecedorMessageForSend(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  pendingId: number | string,
  pendingText: string,
  pair: AquecedorPairContext,
): Promise<string> {
  const exclude = await buildAquecedorExcludeSet(supabase, pair);
  const current = String(pendingText || "").trim();
  if (current && !isAquecedorSystemMessage(current) && !exclude.has(current)) return current;

  const mensagem = await pickAquecedorMessageText(supabase, exclude);
  await (supabase.from("aquecedor" as any) as any)
    .update({ mensagem })
    .eq("id", pendingId);
  return mensagem;
}

async function fetchProcessableAquecedorPending(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>) {
  const now = new Date().toISOString();
  const { data } = (await (supabase
    .from("aquecedor" as any)
    .select("id, mensagem, status, scheduled_at")
    .eq("status", "PENDENTE")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle())) as any;
  return data ?? null;
}

type EnsureAquecedorPendingResult = {
  ok: boolean;
  reason?: string;
  pendingId?: string | number;
};

async function ensureAquecedorPendingMessageOnce(
  pair?: AquecedorPairContext | null,
): Promise<EnsureAquecedorPendingResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "Supabase não configurado ao preparar fila do aquecedor." };
  }
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const { count: processableCount, error: processableError } = (await (supabase
    .from("aquecedor" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDENTE")
    .lte("scheduled_at", now))) as { count: number | null; error: { message?: string } | null };
  if (processableError) {
    return {
      ok: false,
      reason: `Erro ao consultar fila processável: ${processableError.message || "desconhecido"}.`,
    };
  }
  if (typeof processableCount === "number" && processableCount > 0) {
    return { ok: true };
  }

  const { data: oldestPending, error: oldestError } = (await (supabase
    .from("aquecedor" as any)
    .select("id, mensagem, scheduled_at")
    .eq("status", "PENDENTE")
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle())) as any;
  if (oldestError) {
    return {
      ok: false,
      reason: `Erro ao consultar fila pendente: ${oldestError.message || "desconhecido"}.`,
    };
  }

  if (oldestPending?.id) {
    const schedMs = oldestPending.scheduled_at
      ? new Date(String(oldestPending.scheduled_at)).getTime()
      : Number.NaN;
    const processableNow = Number.isFinite(schedMs) && schedMs <= nowMs;
    let mensagem: string | undefined;
    if (pair) {
      const exclude = await buildAquecedorExcludeSet(supabase, pair);
      const current = String(oldestPending.mensagem || "").trim();
      if (!current || isAquecedorSystemMessage(current) || exclude.has(current)) {
        mensagem = await pickAquecedorMessageText(supabase, exclude);
      }
    }
    if (!processableNow || mensagem) {
      const payload: Record<string, unknown> = { scheduled_at: now };
      if (mensagem) payload.mensagem = mensagem;
      const { error: promoteError } = await (supabase.from("aquecedor" as any) as any)
        .update(payload)
        .eq("id", oldestPending.id);
      if (promoteError) {
        return {
          ok: false,
          reason: `Erro ao liberar mensagem na fila: ${promoteError.message || "desconhecido"}.`,
        };
      }
    }
    return { ok: true, pendingId: oldestPending.id };
  }

  const exclude = pair ? await buildAquecedorExcludeSet(supabase, pair) : undefined;
  const mensagem = await pickAquecedorMessageText(supabase, exclude);
  const { data: inserted, error: insertError } = await (supabase.from("aquecedor" as any) as any)
    .insert({
      mensagem,
      status: "PENDENTE",
      scheduled_at: now,
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("[Aquecedor] ensure insert falhou:", insertError);
    return {
      ok: false,
      reason: `Erro ao inserir mensagem na fila aquecedor: ${insertError.message || "desconhecido"}.`,
    };
  }
  return { ok: true, pendingId: inserted?.id };
}

async function ensureAquecedorPendingMessage(
  pair?: AquecedorPairContext | null,
): Promise<EnsureAquecedorPendingResult> {
  let lastResult: EnsureAquecedorPendingResult = {
    ok: false,
    reason: "Falha ao preparar fila do aquecedor.",
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      resetSupabaseClient();
      await sleepMs(600 * attempt);
    }
    lastResult = await ensureAquecedorPendingMessageOnce(pair);
    if (lastResult.ok || !isSupabaseTransientError({ message: lastResult.reason })) {
      return lastResult;
    }
    console.warn(
      `[Aquecedor] ensure fila tentativa ${attempt + 1}/3 falhou:`,
      lastResult.reason,
    );
  }
  return {
    ok: false,
    reason: await describeSupabaseConnectivityFailure(),
  };
}
/** Checkpoint em disco das campanhas mesmo sem evento (ms). Env: DISPAROS_CHECKPOINT_MS */
const DISPAROS_CHECKPOINT_MS = Math.max(
  30_000,
  Number.isFinite(Number(process.env.DISPAROS_CHECKPOINT_MS))
    ? Number(process.env.DISPAROS_CHECKPOINT_MS)
    : 120_000
);
const MESSENGER_PRODUCTS_FILE = path.join(
  process.cwd(),
  "data",
  "disparos-messenger-products.json"
);

type MessengerProductRow = {
  id: string;
  displayName: string;
  aiTone: string;
  aiCta: string;
  aiAudience: string;
  aiProduct: string;
  aiObjective: string;
  aiPains: string;
  aiDifferentials: string;
  aiProhibitions: string;
  aiNotes: string;
  aiBriefing: string;
  updatedAt: string;
};

let messengerProductsWriteChain: Promise<void> = Promise.resolve();

function runMessengerProductsLocked<T>(fn: () => Promise<T>): Promise<T> {
  const next = messengerProductsWriteChain.then(fn, fn);
  messengerProductsWriteChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function buildMessengerAiBriefingFromFields(row: {
  aiProduct: string;
  aiObjective: string;
  aiAudience: string;
  aiTone: string;
  aiCta: string;
  aiPains: string;
  aiDifferentials: string;
  aiProhibitions: string;
  aiNotes: string;
}): string {
  const read = (v: string, fallback: string) =>
    String(v || "").trim() || fallback;
  const parts = [
    `Produto/serviço: ${read(row.aiProduct, "não informado")}`,
    `Objetivo da mensagem: ${read(row.aiObjective, "não informado")}`,
    `Público alvo: ${read(row.aiAudience, "não informado")}`,
    `Tom: ${read(row.aiTone, "consultivo")}`,
    `CTA padrão: ${read(row.aiCta, "não informado")}`,
    `Dores do público:\n${read(row.aiPains, "-")}`,
    `Diferenciais:\n${read(row.aiDifferentials, "-")}`,
    `Regras/proibições:\n${read(row.aiProhibitions, "-")}`,
    `Observações adicionais:\n${read(row.aiNotes, "-")}`,
  ];
  return parts.join("\n\n");
}

function parseMessengerProductFromBody(body: any): MessengerProductRow | null {
  const displayName = String(body?.displayName || "").trim();
  if (!displayName || displayName.length > 200) return null;
  const slice = (v: any, max: number) => String(v ?? "").slice(0, max);
  const aiTone = slice(body?.aiTone, 120) || DISPAROS_DEFAULTS.aiTone;
  const aiCta = slice(body?.aiCta, 240) || DISPAROS_DEFAULTS.aiCta;
  const aiAudience = slice(body?.aiAudience, 240) || DISPAROS_DEFAULTS.aiAudience;
  const aiProduct = slice(body?.aiProduct, 500);
  const aiObjective = slice(body?.aiObjective, 500);
  const aiPains = slice(body?.aiPains, 4000);
  const aiDifferentials = slice(body?.aiDifferentials, 4000);
  const aiProhibitions = slice(body?.aiProhibitions, 4000);
  const aiNotes = slice(body?.aiNotes, 4000);
  let aiBriefing = String(body?.aiBriefing || "").trim().slice(0, 8000);
  if (!aiBriefing) {
    aiBriefing = buildMessengerAiBriefingFromFields({
      aiProduct,
      aiObjective,
      aiAudience,
      aiTone,
      aiCta,
      aiPains,
      aiDifferentials,
      aiProhibitions,
      aiNotes,
    });
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    displayName,
    aiTone,
    aiCta,
    aiAudience,
    aiProduct,
    aiObjective,
    aiPains,
    aiDifferentials,
    aiProhibitions,
    aiNotes,
    aiBriefing,
    updatedAt: now,
  };
}

async function loadMessengerProductsFromFile(): Promise<MessengerProductRow[]> {
  try {
    const raw = await fs.readFile(MESSENGER_PRODUCTS_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    const items = parsed?.items;
    if (!Array.isArray(items)) return [];
    return items
      .filter(
        (row: any) =>
          row &&
          typeof row.id === "string" &&
          typeof row.displayName === "string" &&
          row.displayName.trim().length > 0
      )
      .map((row: any) => ({
        id: String(row.id),
        displayName: String(row.displayName).trim(),
        aiTone: String(row.aiTone || DISPAROS_DEFAULTS.aiTone).slice(0, 120),
        aiCta: String(row.aiCta || DISPAROS_DEFAULTS.aiCta).slice(0, 240),
        aiAudience: String(row.aiAudience || DISPAROS_DEFAULTS.aiAudience).slice(
          0,
          240
        ),
        aiProduct: String(row.aiProduct || "").slice(0, 500),
        aiObjective: String(row.aiObjective || "").slice(0, 500),
        aiPains: String(row.aiPains || "").slice(0, 4000),
        aiDifferentials: String(row.aiDifferentials || "").slice(0, 4000),
        aiProhibitions: String(row.aiProhibitions || "").slice(0, 4000),
        aiNotes: String(row.aiNotes || "").slice(0, 4000),
        aiBriefing: String(row.aiBriefing || "").slice(0, 8000),
        updatedAt: String(row.updatedAt || new Date().toISOString()),
      }));
  } catch {
    return [];
  }
}

async function saveMessengerProductsToFile(items: MessengerProductRow[]) {
  await fs.mkdir(path.dirname(MESSENGER_PRODUCTS_FILE), { recursive: true });
  await fs.writeFile(
    MESSENGER_PRODUCTS_FILE,
    JSON.stringify({ items }, null, 2),
    "utf-8"
  );
}
let instanceAliasesCache: Map<string, string> | null = null;
let whatsappProfileNamesCache: Map<string, string> | null = null;

async function loadInstanceAliasesMap(): Promise<Map<string, string>> {
  if (instanceAliasesCache) return new Map(instanceAliasesCache);
  try {
    const raw = await fs.readFile(INSTANCE_ALIASES_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    const map = new Map<string, string>();
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([k, v]) => {
        const key = String(k || "").trim();
        const val = String(v || "").trim();
        if (key && val) map.set(key, val);
      });
    }
    instanceAliasesCache = map;
    return new Map(map);
  } catch {
    instanceAliasesCache = new Map<string, string>();
    return new Map(instanceAliasesCache);
  }
}

async function persistInstanceAliasesMap(nextMap: Map<string, string>) {
  instanceAliasesCache = new Map(nextMap);
  const obj: Record<string, string> = {};
  nextMap.forEach((v, k) => {
    if (k && v) obj[k] = v;
  });
  await fs.mkdir(path.dirname(INSTANCE_ALIASES_FILE), { recursive: true });
  await fs.writeFile(INSTANCE_ALIASES_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

async function loadWhatsappProfileNamesMap(): Promise<Map<string, string>> {
  if (whatsappProfileNamesCache) return new Map(whatsappProfileNamesCache);
  try {
    const raw = await fs.readFile(WHATSAPP_PROFILE_NAMES_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    const map = new Map<string, string>();
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([k, v]) => {
        const key = String(k || "").trim();
        const val = String(v || "").trim();
        if (key && val) map.set(key, val);
      });
    }
    whatsappProfileNamesCache = map;
    return new Map(map);
  } catch {
    whatsappProfileNamesCache = new Map<string, string>();
    return new Map(whatsappProfileNamesCache);
  }
}

async function persistWhatsappProfileNamesMap(nextMap: Map<string, string>) {
  whatsappProfileNamesCache = new Map(nextMap);
  const obj: Record<string, string> = {};
  nextMap.forEach((v, k) => {
    if (k && v) obj[k] = v;
  });
  await fs.mkdir(path.dirname(WHATSAPP_PROFILE_NAMES_FILE), { recursive: true });
  await fs.writeFile(WHATSAPP_PROFILE_NAMES_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

const DAY_CODES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const DAY_TO_NUM: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

const AQUECEDOR_DEFAULTS = {
  expediente: [
    { days: ["seg", "ter", "qua"], startHour: 7, endHour: 22 },
    { days: ["qui", "sex", "sab", "dom"], startHour: 6, endHour: 20 },
  ] as Array<{ days: string[]; startHour: number; endHour: number }>,
  janelaAtivaMinutos: 60,
  pausaMinutos: 14,
  waitMinSeconds: 180,
  waitMaxSeconds: 480,
};

type AquecedorConfig = typeof AQUECEDOR_DEFAULTS;

type InstanceUsageConfig = {
  useAquecedor: boolean;
  useDisparador: boolean;
  useFazenda: boolean;
  updatedAt: string;
};

type DisparosConfig = {
  lockTtlSeconds: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  maxPerHourPerInstance: number;
  maxPerDayPerInstance: number;
  workingDays: string[];
  startHour: number;
  endHour: number;
  messageMode: "ai" | "database";
  aiBriefing: string;
  aiTone: string;
  aiCta: string;
  aiAudience: string;
  shortenerProvider: "encurtadorpro" | "isgd" | "tinyurl" | "waba";
  shortenerDomain: string;
  whatsappTargetNumber: string;
  selectedDisparadorInstances: string[];
};

type MessageTemplate = {
  id: string;
  text: string;
  alias: string;
  segment: string;
  source: "manual" | "spreadsheet";
  createdAt: string;
  active: boolean;
};

type DisparosCampaign = {
  id: string;
  name: string;
  createdAt: string;
  status: "draft" | "running" | "paused" | "finished";
  totalNumbers: number;
  sentCount: number;
  ownerEmail?: string;
  configSnapshot: DisparosConfig;
};

type CampaignInstanceHealth = {
  selectedCount: number;
  connectedCount: number;
  disconnectedCount: number;
  disconnectedPercent: number;
  shouldPauseByDisconnectedRatio: boolean;
};

type LeadFailureKind = "invalid_phone" | "destination_error" | "send_error";

type DisparosCampaignLead = {
  id: string;
  campaignId: string;
  phone: string;
  status: "pending" | "sent" | "failed";
  messageText?: string;
  shortUrl?: string;
  /** Preenchido quando status === "failed" (envio na mesma execução); leads antigos sem valor caem em send_error no relatório. */
  failureKind?: LeadFailureKind;
  createdAt: string;
  sentAt: string | null;
};

const DISPAROS_DEFAULTS: DisparosConfig = {
  lockTtlSeconds: 600,
  delayMinSeconds: 120,
  delayMaxSeconds: 320,
  maxPerHourPerInstance: 40,
  maxPerDayPerInstance: 130,
  workingDays: ["seg", "ter", "qua", "qui", "sex"],
  startHour: 8,
  endHour: 22,
  messageMode: "ai",
  aiBriefing: "",
  aiTone: "consultivo",
  aiCta: "Responda no link abaixo",
  aiAudience: "CORBAN",
  shortenerProvider: "waba",
  shortenerDomain: "",
  whatsappTargetNumber: "",
  selectedDisparadorInstances: [],
};

function isDisparosWindowOpen(
  config: DisparosConfig,
  now: Date
): { aberta: boolean; motivo: string } {
  const day = now.getDay();
  const dayCode = DAY_CODES[day];
  const days =
    Array.isArray(config.workingDays) && config.workingDays.length > 0
      ? config.workingDays
      : DISPAROS_DEFAULTS.workingDays;
  if (!days.includes(dayCode)) {
    return {
      aberta: false,
      motivo: `Hoje (${dayCode}) não está nos dias de expediente do Disparador.`,
    };
  }
  const shRaw = Number(config.startHour);
  const ehRaw = Number(config.endHour);
  const sh = Number.isFinite(shRaw)
    ? Math.max(0, Math.min(23, Math.floor(shRaw)))
    : DISPAROS_DEFAULTS.startHour;
  const eh = Number.isFinite(ehRaw)
    ? Math.max(1, Math.min(24, Math.floor(ehRaw)))
    : DISPAROS_DEFAULTS.endHour;
  const hour = now.getHours();
  if (hour < sh) {
    return { aberta: false, motivo: `Antes da janela (${sh}h–${eh}h).` };
  }
  if (hour >= eh) {
    return { aberta: false, motivo: `Após a janela (${sh}h–${eh}h).` };
  }
  return { aberta: true, motivo: "Dentro da janela de expediente do Disparador." };
}

function startOfNextCalendarDayLocal(d: Date): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atStartHourOnSameLocalDay(dayRef: Date, startHour: number): Date {
  const x = new Date(dayRef.getTime());
  x.setHours(startHour, 0, 0, 0);
  return x;
}

/**
 * Próximo instante em que o expediente do Disparador **abre** (mesmo relógio local que `fromSp`).
 * Retorna `null` se já estiver dentro da janela ou após esgotar o limite de busca.
 */
function findNextDisparosWindowStart(config: DisparosConfig, fromSp: Date): Date | null {
  const dayCodes =
    Array.isArray(config.workingDays) && config.workingDays.length > 0
      ? config.workingDays
      : DISPAROS_DEFAULTS.workingDays;
  const shRaw = Number(config.startHour);
  const ehRaw = Number(config.endHour);
  const sh = Number.isFinite(shRaw)
    ? Math.max(0, Math.min(23, Math.floor(shRaw)))
    : DISPAROS_DEFAULTS.startHour;
  const eh = Number.isFinite(ehRaw)
    ? Math.max(1, Math.min(24, Math.floor(ehRaw)))
    : DISPAROS_DEFAULTS.endHour;
  const startMinutes = sh * 60;
  const endMinutes = eh * 60;

  let cursor = new Date(fromSp.getTime());

  for (let guard = 0; guard < 400; guard++) {
    const dayCode = DAY_CODES[cursor.getDay()];
    const minutesNow = cursor.getHours() * 60 + cursor.getMinutes();

    if (!dayCodes.includes(dayCode)) {
      cursor = startOfNextCalendarDayLocal(cursor);
      continue;
    }

    if (minutesNow < startMinutes) {
      return atStartHourOnSameLocalDay(cursor, sh);
    }
    if (minutesNow >= endMinutes) {
      cursor = startOfNextCalendarDayLocal(cursor);
      continue;
    }

    return null;
  }
  return null;
}

const instanceUsageMemory = new Map<string, InstanceUsageConfig>();
const disparosTemplatesMemory: MessageTemplate[] = [];
const disparosCampaignsMemory: DisparosCampaign[] = [];
const disparosCampaignLeadsMemory: DisparosCampaignLead[] = [];
const disparosCreditsService = new WabaDisparosCreditsService();
let disparosLocalPersistChain: Promise<void> = Promise.resolve();

function removeLeadsForCampaignFromMemory(campaignId: string) {
  const id = String(campaignId || "").trim();
  if (!id) return;
  for (let k = disparosCampaignLeadsMemory.length - 1; k >= 0; k--) {
    if (disparosCampaignLeadsMemory[k].campaignId === id) disparosCampaignLeadsMemory.splice(k, 1);
  }
}

function queuePersistDisparosLocalState(): void {
  disparosLocalPersistChain = disparosLocalPersistChain.then(async () => {
    try {
      await fs.mkdir(path.dirname(DISPAROS_LOCAL_STATE_FILE), { recursive: true });
      const payload = {
        version: 1 as const,
        savedAt: new Date().toISOString(),
        campaigns: disparosCampaignsMemory.map((c) => ({
          id: c.id,
          name: c.name,
          createdAt: c.createdAt,
          status: c.status,
          totalNumbers: c.totalNumbers,
          sentCount: c.sentCount,
          ownerEmail: c.ownerEmail || "",
          configSnapshot: c.configSnapshot,
        })),
        leads: disparosCampaignLeadsMemory.map((l) => ({
          id: l.id,
          campaignId: l.campaignId,
          phone: l.phone,
          status: l.status,
          messageText: l.messageText,
          shortUrl: l.shortUrl,
          failureKind: l.failureKind,
          createdAt: l.createdAt,
          sentAt: l.sentAt,
        })),
      };
      const tmp = `${DISPAROS_LOCAL_STATE_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
      await fs.rename(tmp, DISPAROS_LOCAL_STATE_FILE);
    } catch (e) {
      console.error("[Campanhas] falha ao gravar estado local:", e);
    }
  });
}

async function loadDisparosLocalState(): Promise<void> {
  try {
    const raw = await fs.readFile(DISPAROS_LOCAL_STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.leads)) {
      return;
    }
    const seenC = new Set(disparosCampaignsMemory.map((c) => c.id));
    for (const c of parsed.campaigns) {
      const id = String(c?.id || "").trim();
      if (!id || seenC.has(id)) continue;
      seenC.add(id);
      const st = String(c?.status || "paused").toLowerCase();
      const status: DisparosCampaign["status"] =
        st === "running" || st === "paused" || st === "finished" || st === "draft" ? st : "paused";
      disparosCampaignsMemory.push({
        id,
        name: String(c?.name || ""),
        createdAt: String(c?.createdAt || new Date().toISOString()),
        status,
        totalNumbers: Number(c?.totalNumbers || 0),
        sentCount: Number(c?.sentCount || 0),
        ownerEmail: String(c?.ownerEmail || "").trim() || undefined,
        configSnapshot: parseDisparosConfig(c?.configSnapshot || {}),
      });
    }
    const seenL = new Set(disparosCampaignLeadsMemory.map((l) => l.id));
    for (const l of parsed.leads) {
      const id = String(l?.id || "").trim();
      if (!id || seenL.has(id)) continue;
      seenL.add(id);
      const st = String(l?.status || "pending").toLowerCase();
      const status: DisparosCampaignLead["status"] =
        st === "sent" ? "sent" : st === "failed" ? "failed" : "pending";
      const fk = l?.failureKind;
      const failureKind: LeadFailureKind | undefined =
        fk === "invalid_phone" || fk === "destination_error" || fk === "send_error" ? fk : undefined;
      disparosCampaignLeadsMemory.push({
        id,
        campaignId: String(l?.campaignId || ""),
        phone: String(l?.phone || ""),
        status,
        messageText: typeof l?.messageText === "string" ? l.messageText : undefined,
        shortUrl: typeof l?.shortUrl === "string" ? l.shortUrl : undefined,
        failureKind,
        createdAt: String(l?.createdAt || new Date().toISOString()),
        sentAt: l?.sentAt ? String(l.sentAt) : null,
      });
    }
    console.log(
      `[Campanhas] estado local carregado de ${DISPAROS_LOCAL_STATE_FILE} (${parsed.campaigns.length} campanha(s) no arquivo).`
    );
  } catch (e: any) {
    if (e?.code !== "ENOENT") {
      console.error("[Campanhas] falha ao ler estado local:", e);
    }
  }
}

const campaignNextAllowedSendAt = new Map<string, number>();
const campaignDisparadorRoundRobin = new Map<string, number>();
let disparosRoundRobinCounter = 0;
const alternativaNumbersService = new WabaAlternativaNumbersService();
const alternativaActivationRepository = new AlternativaNumberActivationRepository();
type InstanceDailySendBucket = { dateKey: string; count: number };
const instanceDailySendCounts = new Map<string, InstanceDailySendBucket>();
let lastShortUrlIssued = "";
const shortUrlClicksCache = new Map<string, { clicks: number; checkedAtMs: number }>();

function normalizeShortenerProvider(
  value: string | null | undefined
): DisparosConfig["shortenerProvider"] {
  const raw = String(value || process.env.SHORTENER_PROVIDER || "waba")
    .trim()
    .toLowerCase();
  if (raw === "encurtadorpro") return "encurtadorpro";
  if (raw === "isgd") return "isgd";
  if (raw === "tinyurl") return "tinyurl";
  return "waba";
}

function getAutoShortenerProviderOrder(): DisparosConfig["shortenerProvider"][] {
  const primary = normalizeShortenerProvider(process.env.SHORTENER_PROVIDER);
  const order: DisparosConfig["shortenerProvider"][] = [primary];
  if (primary === "waba" && String(process.env.ENCURTADORPRO_API_KEY || "").trim()) {
    order.push("encurtadorpro");
  } else if (primary === "encurtadorpro") {
    order.push("waba");
  }
  return Array.from(new Set(order));
}

type AquecedorRuntimeStatus = {
  running: boolean;
  isProcessing: boolean;
  nextAllowedAt: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  lastEvoError: { status: number; body: string; instance: string; numeroLen: number } | null;
};

const aquecedorRuntime: AquecedorRuntimeStatus = {
  running: false,
  isProcessing: false,
  nextAllowedAt: null,
  lastRunAt: null,
  lastResult: null,
  lastEvoError: null,
};

let aquecedorInterval: NodeJS.Timeout | null = null;
let aquecedorRuntimeOwnerEmail: string | null = null;

type AquecedorRuntimeIntent = {
  desired: boolean | null;
  ownerEmail: string | null;
};

type AquecedorRuntimePersistedSnapshot = AquecedorRuntimeStatus & {
  workerId: string | null;
  workerHeartbeatAt: string | null;
};

type AquecedorRuntimePersistedBundle = AquecedorRuntimeIntent & {
  snapshot: AquecedorRuntimePersistedSnapshot;
};

const AQUECEDOR_WORKER_LEASE_MS = 90_000;
const AQUECEDOR_WORKER_SYNC_MS = 12_000;
const AQUECEDOR_PERSISTED_RELOAD_MS = 2_000;
const AQUECEDOR_WORKER_ID = `${hostname()}:${process.pid}`;

function createDefaultAquecedorRuntimeSnapshot(): AquecedorRuntimePersistedSnapshot {
  return {
    running: false,
    isProcessing: false,
    nextAllowedAt: null,
    lastRunAt: null,
    lastResult: null,
    lastEvoError: null,
    workerId: null,
    workerHeartbeatAt: null,
  };
}

let aquecedorPersistedBundle: AquecedorRuntimePersistedBundle = {
  desired: null,
  ownerEmail: null,
  snapshot: createDefaultAquecedorRuntimeSnapshot(),
};
let aquecedorPersistedBundleReloadedAt = 0;
let aquecedorConnectedSummaryCache: {
  count: number;
  names: string[];
  at: number;
} = { count: 0, names: [], at: 0 };

function updateAquecedorConnectedSummary(
  connected: Array<{ instancia: string; numero: string }>,
): void {
  aquecedorConnectedSummaryCache = {
    count: connected.length,
    names: connected.map((item) => item.instancia),
    at: Date.now(),
  };
}

function getAquecedorWorkerId(): string {
  return AQUECEDOR_WORKER_ID;
}

function isAquecedorWorkerLeaseValid(snapshot: AquecedorRuntimePersistedSnapshot): boolean {
  if (!snapshot.workerHeartbeatAt) return false;
  const heartbeatMs = new Date(snapshot.workerHeartbeatAt).getTime();
  if (!Number.isFinite(heartbeatMs)) return false;
  return Date.now() - heartbeatMs <= AQUECEDOR_WORKER_LEASE_MS;
}

function shouldThisProcessLeadAquecedor(bundle: AquecedorRuntimePersistedBundle): boolean {
  if (bundle.desired !== true || !bundle.snapshot.running) return false;
  const snapshot = bundle.snapshot;
  if (snapshot.workerId === getAquecedorWorkerId()) return true;
  if (!snapshot.workerId || !isAquecedorWorkerLeaseValid(snapshot)) return true;
  return false;
}

function applyPersistedSnapshotToLocal(snapshot: AquecedorRuntimePersistedSnapshot): void {
  aquecedorRuntime.running = snapshot.running === true;
  aquecedorRuntime.isProcessing = snapshot.isProcessing === true;
  aquecedorRuntime.nextAllowedAt = snapshot.nextAllowedAt;
  aquecedorRuntime.lastRunAt = snapshot.lastRunAt;
  aquecedorRuntime.lastResult = snapshot.lastResult;
  aquecedorRuntime.lastEvoError = snapshot.lastEvoError;
}

function buildPersistedSnapshotFromLocal(
  overrides: Partial<AquecedorRuntimePersistedSnapshot> = {},
): AquecedorRuntimePersistedSnapshot {
  return {
    running: aquecedorRuntime.running,
    isProcessing: aquecedorRuntime.isProcessing,
    nextAllowedAt: aquecedorRuntime.nextAllowedAt,
    lastRunAt: aquecedorRuntime.lastRunAt,
    lastResult: aquecedorRuntime.lastResult,
    lastEvoError: aquecedorRuntime.lastEvoError,
    workerId: aquecedorPersistedBundle.snapshot.workerId,
    workerHeartbeatAt: aquecedorPersistedBundle.snapshot.workerHeartbeatAt,
    ...overrides,
  };
}

function parseAquecedorRuntimePersistedBundle(raw: unknown): AquecedorRuntimePersistedBundle {
  const p = raw as Record<string, unknown>;
  const version = Number(p?.version);
  if (version !== 1 && version !== 2) {
    return {
      desired: null,
      ownerEmail: null,
      snapshot: createDefaultAquecedorRuntimeSnapshot(),
    };
  }
  const desired =
    typeof p.aquecedorRuntimeDesired === "boolean" ? p.aquecedorRuntimeDesired : null;
  const ownerEmail =
    typeof p.aquecedorOwnerEmail === "string" && p.aquecedorOwnerEmail.trim()
      ? p.aquecedorOwnerEmail.trim().toLowerCase()
      : null;
  const snapRaw = (p.aquecedorRuntimeSnapshot || {}) as Record<string, unknown>;
  const snapshot: AquecedorRuntimePersistedSnapshot = {
    running: snapRaw.running === true,
    isProcessing: snapRaw.isProcessing === true,
    nextAllowedAt:
      typeof snapRaw.nextAllowedAt === "string" ? snapRaw.nextAllowedAt : null,
    lastRunAt: typeof snapRaw.lastRunAt === "string" ? snapRaw.lastRunAt : null,
    lastResult: typeof snapRaw.lastResult === "string" ? snapRaw.lastResult : null,
    lastEvoError:
      snapRaw.lastEvoError && typeof snapRaw.lastEvoError === "object"
        ? (snapRaw.lastEvoError as AquecedorRuntimeStatus["lastEvoError"])
        : null,
    workerId: typeof snapRaw.workerId === "string" ? snapRaw.workerId : null,
    workerHeartbeatAt:
      typeof snapRaw.workerHeartbeatAt === "string" ? snapRaw.workerHeartbeatAt : null,
  };
  if (version === 1) {
    snapshot.running = desired === true;
  }
  return { desired, ownerEmail, snapshot };
}

async function reloadAquecedorPersistedBundleFromDisk(
  force = false,
): Promise<AquecedorRuntimePersistedBundle> {
  const now = Date.now();
  if (!force && now - aquecedorPersistedBundleReloadedAt < AQUECEDOR_PERSISTED_RELOAD_MS) {
    return aquecedorPersistedBundle;
  }
  aquecedorPersistedBundleReloadedAt = now;
  try {
    const raw = await fs.readFile(RUNTIME_INTENT_FILE, "utf-8");
    aquecedorPersistedBundle = parseAquecedorRuntimePersistedBundle(JSON.parse(raw));
  } catch {
    /* mantém cache em memória */
  }
  return aquecedorPersistedBundle;
}

function buildAquecedorStatusPayload(bundle = aquecedorPersistedBundle) {
  const running = bundle.desired === true && bundle.snapshot.running === true;
  return {
    ...bundle.snapshot,
    running,
    desiredRunning: bundle.desired === true,
    persistedOwnerEmail: bundle.ownerEmail,
    ownerEmailBound: Boolean(aquecedorRuntimeOwnerEmail || bundle.ownerEmail),
    workerId: bundle.snapshot.workerId,
    workerHeartbeatAt: bundle.snapshot.workerHeartbeatAt,
    workerLeaseValid: isAquecedorWorkerLeaseValid(bundle.snapshot),
    connectedInstanceCount: aquecedorConnectedSummaryCache.count,
    connectedInstances: aquecedorConnectedSummaryCache.names,
    connectedSummaryAt: aquecedorConnectedSummaryCache.at
      ? new Date(aquecedorConnectedSummaryCache.at).toISOString()
      : null,
  };
}

async function withAquecedorTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function writeAquecedorPersistedBundleToDisk(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(RUNTIME_INTENT_FILE), { recursive: true });
    const payload = {
      version: 2 as const,
      savedAt: new Date().toISOString(),
      aquecedorRuntimeDesired: aquecedorPersistedBundle.desired === true,
      aquecedorOwnerEmail: aquecedorPersistedBundle.ownerEmail,
      aquecedorRuntimeSnapshot: aquecedorPersistedBundle.snapshot,
    };
    const tmp = `${RUNTIME_INTENT_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(tmp, RUNTIME_INTENT_FILE);
  } catch (e) {
    console.error("[Runtime] falha ao gravar runtime-intent.json:", e);
  }
}

async function persistAquecedorRuntimeSnapshot(
  overrides: Partial<AquecedorRuntimePersistedSnapshot> = {},
): Promise<void> {
  aquecedorPersistedBundle.snapshot = buildPersistedSnapshotFromLocal(overrides);
  await writeAquecedorPersistedBundleToDisk();
}

async function persistAquecedorRuntimeIntent(
  desired: boolean,
  ownerEmail: string | null,
): Promise<void> {
  const normalizedOwner = ownerEmail?.trim().toLowerCase() || null;
  aquecedorPersistedBundle.desired = desired;
  aquecedorPersistedBundle.ownerEmail = desired ? normalizedOwner : null;
  aquecedorPersistedBundle.snapshot = buildPersistedSnapshotFromLocal({
    running: desired,
    workerId: desired ? getAquecedorWorkerId() : null,
    workerHeartbeatAt: desired ? new Date().toISOString() : null,
    isProcessing: desired ? aquecedorRuntime.isProcessing : false,
  });
  await writeAquecedorPersistedBundleToDisk();
  console.log(
    `[Runtime] runtime-intent: aquecedor desejado = ${desired ? "ligado" : "desligado"}${normalizedOwner ? ` (${normalizedOwner})` : ""}.`
  );
}

async function loadAquecedorRuntimeIntent(): Promise<AquecedorRuntimeIntent> {
  await reloadAquecedorPersistedBundleFromDisk(true);
  return {
    desired: aquecedorPersistedBundle.desired,
    ownerEmail: aquecedorPersistedBundle.ownerEmail,
  };
}

function stopAquecedorRuntimeLocal(): void {
  aquecedorRuntime.running = false;
  if (aquecedorInterval) {
    clearInterval(aquecedorInterval);
    aquecedorInterval = null;
  }
}

async function syncAquecedorWorkerLeadership(): Promise<void> {
  if (!ENABLE_AQUECEDOR_PROCESSING || MAINTENANCE_MODE) return;
  await reloadAquecedorPersistedBundleFromDisk(true);
  const bundle = aquecedorPersistedBundle;
  applyPersistedSnapshotToLocal(bundle.snapshot);
  aquecedorRuntimeOwnerEmail = bundle.ownerEmail;

  if (bundle.desired !== true || !bundle.snapshot.running) {
    stopAquecedorRuntimeLocal();
    return;
  }

  if (shouldThisProcessLeadAquecedor(bundle)) {
    startAquecedorRuntimeLocal();
    bundle.snapshot.workerId = getAquecedorWorkerId();
    bundle.snapshot.workerHeartbeatAt = new Date().toISOString();
    aquecedorPersistedBundle.snapshot = bundle.snapshot;
    await writeAquecedorPersistedBundleToDisk();
    return;
  }

  stopAquecedorRuntimeLocal();
}

type AquecedorConfigRecord = {
  useRecommended: boolean;
  customConfig: AquecedorConfig;
  updatedAt: string;
};

async function readAquecedorConfigFromFile(): Promise<AquecedorConfigRecord | null> {
  try {
    const raw = await fs.readFile(AQUECEDOR_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const useRecommended = parsed?.useRecommended !== false;
    let customConfig: AquecedorConfig = AQUECEDOR_DEFAULTS;
    try {
      customConfig = parseAquecedorConfig(parsed?.customConfig || AQUECEDOR_DEFAULTS);
    } catch {
      customConfig = AQUECEDOR_DEFAULTS;
    }
    return {
      useRecommended,
      customConfig,
      updatedAt:
        typeof parsed?.updatedAt === "string" && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function writeAquecedorConfigToFile(record: AquecedorConfigRecord): Promise<void> {
  await fs.mkdir(path.dirname(AQUECEDOR_CONFIG_FILE), { recursive: true });
  const tmp = `${AQUECEDOR_CONFIG_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf-8");
  await fs.rename(tmp, AQUECEDOR_CONFIG_FILE);
}

function parseStoredAquecedorCustomConfig(raw: unknown): AquecedorConfig {
  try {
    return parseAquecedorConfig(raw || AQUECEDOR_DEFAULTS);
  } catch {
    return AQUECEDOR_DEFAULTS;
  }
}

async function loadAquecedorConfigRecord(): Promise<{
  record: AquecedorConfigRecord;
  storageSource: "supabase" | "local";
}> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await (supabase
      .from("aquecedor_config" as any)
      .select("use_recommended, custom_config, updated_at")
      .eq("id", 1)
      .maybeSingle()) as any;
    if (!error) {
      const useRecommended = data?.use_recommended !== false;
      const customConfig = parseStoredAquecedorCustomConfig(data?.custom_config);
      return {
        record: {
          useRecommended,
          customConfig,
          updatedAt: data?.updated_at ?? new Date().toISOString(),
        },
        storageSource: "supabase",
      };
    }
    console.error("[Aquecedor] Supabase indisponível para config; usando arquivo local:", error);
  }

  const fromFile = await readAquecedorConfigFromFile();
  if (fromFile) {
    return { record: fromFile, storageSource: "local" };
  }

  return {
    record: {
      useRecommended: true,
      customConfig: AQUECEDOR_DEFAULTS,
      updatedAt: new Date().toISOString(),
    },
    storageSource: "local",
  };
}

async function saveAquecedorConfigRecord(
  useRecommended: boolean,
  customConfig: AquecedorConfig
): Promise<"supabase" | "local"> {
  const record: AquecedorConfigRecord = {
    useRecommended,
    customConfig,
    updatedAt: new Date().toISOString(),
  };
  const supabase = getSupabaseClient();
  if (supabase) {
    const payload = {
      id: 1,
      use_recommended: useRecommended,
      custom_config: customConfig,
      updated_at: record.updatedAt,
    };
    const { error } = await (supabase.from("aquecedor_config" as any) as any).upsert(payload as any, {
      onConflict: "id",
    });
    if (!error) return "supabase";
    console.error("[Aquecedor] falha ao salvar no Supabase; gravando arquivo local:", error);
  }

  await writeAquecedorConfigToFile(record);
  return "local";
}

async function ensureAquecedorInstanceRegistered(instanceName: string): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const usageMap = await loadInstanceUsageMap();
  if (getInstanceUsageFromMap(usageMap, name)) return;
  await persistInstanceUsage([
    {
      instanceName: name,
      useAquecedor: true,
      useDisparador: true,
    },
  ]);
}

async function syncAquecedorConnectedInstances(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
): Promise<void> {
  const usageMap = await loadInstanceUsageMap();
  const toRegister: Array<{ instanceName: string; useAquecedor: boolean; useDisparador: boolean }> =
    [];

  for (const item of connected) {
    await (supabase.from("controle_instancia" as any) as any).upsert(
      {
        instancia: item.instancia,
        numero_whatsapp: item.numero,
      },
      { onConflict: "instancia" },
    );

    if (!getInstanceUsageFromMap(usageMap, item.instancia)) {
      toRegister.push({
        instanceName: item.instancia,
        useAquecedor: true,
        useDisparador: true,
      });
    }
  }

  if (toRegister.length) {
    await persistInstanceUsage(toRegister);
  }
}

const wabaSystemUserRepository = new WabaSystemUserRepository();

function isAquecedorGlobalScopeOwner(ownerEmail: string): boolean {
  const email = String(ownerEmail || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return false;
  if (isWabaMasterEmail(email)) return true;
  return wabaSystemUserRepository.getRoleByEmail(email) === "master";
}

async function listEvoInstanceNamesForScopeReconcile(): Promise<string[]> {
  const names = new Set<string>();
  const evoList = await fetchEvoInstancesList();
  if (evoList.ok) {
    for (const inst of evoList.instances) {
      const key = resolveEvoInstanceKey(inst);
      if (key) names.add(key);
    }
  }
  const cache = await loadEvoInstancesCache();
  for (const item of cache?.items || []) {
    const name = String(item?.name || "").trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

/** Mesma estratégia do painel `/instancias`: cache preenche lacunas quando a EVO live vem incompleta. */
function mergeAquecedorConnectedRows(
  primary: Array<{ instancia: string; numero: string }>,
  secondary: Array<{ instancia: string; numero: string }>,
): Array<{ instancia: string; numero: string }> {
  const byKey = new Map<string, { instancia: string; numero: string }>();
  for (const row of secondary) {
    const key = row.instancia.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, row);
  }
  for (const row of primary) {
    const key = row.instancia.toLowerCase();
    const prev = byKey.get(key);
    byKey.set(key, {
      instancia: row.instancia,
      numero: String(row.numero || prev?.numero || "").trim(),
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.instancia.localeCompare(b.instancia, "pt-BR"));
}

async function listMergedConnectedEvoInstancesUnscoped(): Promise<{
  rows: Array<{ instancia: string; numero: string }>;
  liveCount: number;
  cacheCount: number;
  evoOk: boolean;
  evoError?: string;
}> {
  const evoList = await fetchEvoInstancesList();
  const cache = await loadEvoInstancesCache();
  const fromLive = evoList.ok ? buildConnectedFromEvoResponse(evoList.instances) : [];
  const fromCache = cache?.items?.length ? buildConnectedFromEvoCacheItems(cache.items) : [];
  return {
    rows: mergeAquecedorConnectedRows(fromLive, fromCache),
    liveCount: fromLive.length,
    cacheCount: fromCache.length,
    evoOk: evoList.ok,
    evoError: evoList.ok ? undefined : evoList.detail,
  };
}

async function listConnectedEvoInstancesUnscoped(): Promise<
  Array<{ instancia: string; numero: string }>
> {
  const merged = await listMergedConnectedEvoInstancesUnscoped();
  return merged.rows;
}

async function listAquecedorScopedInstanceNames(ownerEmail: string): Promise<string[]> {
  const email = String(ownerEmail || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return [];

  if (isAquecedorGlobalScopeOwner(email)) {
    const reconcileNames = await listEvoInstanceNamesForScopeReconcile();
    if (reconcileNames.length) {
      const reconciled = await wabaInstanceOwnershipService.reconcileOrphanInstancesForMaster(
        { email, role: "master" },
        reconcileNames,
      );
      if (reconciled > 0) {
        console.info(
          `[Aquecedor] ${reconciled} instância(s) órfã(s) vinculada(s) ao master ${email}.`,
        );
      }
    }
    const usageMap = await loadInstanceUsageMap();
    const connected = await listConnectedEvoInstancesUnscoped();
    const scoped = new Set<string>();
    for (const item of connected) {
      const usage = getInstanceUsageFromMap(usageMap, item.instancia);
      if (usage ? usage.useAquecedor !== false : true) {
        scoped.add(item.instancia);
      }
    }
    return Array.from(scoped).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const owned = await wabaInstanceOwnershipService.listOwnedInstanceNames(email);
  const activations = new AlternativaNumberActivationRepository()
    .listForEmail(email)
    .map((row) => String(row.instanceName || "").trim())
    .filter(Boolean);
  const usageMap = await loadInstanceUsageMap();
  const merged = new Set<string>();
  for (const name of [...owned, ...activations]) {
    const normalized = String(name || "").trim();
    if (!normalized) continue;
    const usage = getInstanceUsageFromMap(usageMap, normalized);
    if (usage?.useAquecedor === false) continue;
    merged.add(normalized);
  }
  return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function filterConnectedForAquecedorOwner(
  connected: Array<{ instancia: string; numero: string }>,
  ownerEmail: string | null,
): Promise<Array<{ instancia: string; numero: string }>> {
  const allowed = await listAquecedorScopedInstanceNames(String(ownerEmail || ""));
  if (!allowed.length) return [];
  const aliasesMap = await loadInstanceAliasesMap();
  const allowedLower = new Set<string>();
  for (const name of allowed) {
    allowedLower.add(name.toLowerCase());
    const alias = mapGetInsensitive(aliasesMap, name);
    if (alias) allowedLower.add(alias.toLowerCase());
  }
  return connected.filter((c) => {
    const keys = [c.instancia.toLowerCase()];
    const alias = mapGetInsensitive(aliasesMap, c.instancia);
    if (alias) keys.push(alias.toLowerCase());
    return keys.some((key) => allowedLower.has(key));
  });
}

function buildConnectedFromEvoCacheItems(
  items: Array<Record<string, unknown>>,
): Array<{ instancia: string; numero: string }> {
  return items
    .map((item) => {
      const status = String(item?.connectionStatus ?? "").toLowerCase();
      if (!status.includes("open")) return null;
      const instancia = String(item?.name || "").trim();
      const numero = normalizeWhatsAppNumber(String(item?.number || "").trim());
      if (!instancia || !numero) return null;
      return { instancia, numero };
    })
    .filter((row): row is { instancia: string; numero: string } => row != null);
}

async function enrichAquecedorConnectedNumbersFromControleInstancia(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  allowedNames: string[],
): Promise<Array<{ instancia: string; numero: string }>> {
  const byKey = new Map<string, { instancia: string; numero: string }>();
  for (const row of connected) {
    byKey.set(row.instancia.toLowerCase(), row);
  }

  const needsNumber = allowedNames.filter((name) => {
    const row = byKey.get(String(name || "").trim().toLowerCase());
    return row && !String(row.numero || "").trim();
  });
  if (!needsNumber.length) return connected;

  try {
    const { data } = (await (supabase
      .from("controle_instancia" as any)
      .select("instancia, numero_whatsapp")
      .in("instancia", needsNumber)
      .limit(500)) as any);
    for (const row of Array.isArray(data) ? data : []) {
      const instancia = String(row?.instancia || "").trim();
      const numero = normalizeWhatsAppNumber(String(row?.numero_whatsapp || "").trim());
      if (!instancia || !numero) continue;
      const existing = byKey.get(instancia.toLowerCase());
      if (existing && !String(existing.numero || "").trim()) {
        existing.numero = numero;
      }
    }
  } catch {
    /* opcional */
  }

  return Array.from(byKey.values()).sort((a, b) => a.instancia.localeCompare(b.instancia, "pt-BR"));
}

function buildEvoInstanceLookupMap(
  liveInstances: any[],
  cacheItems: Array<Record<string, unknown>>,
  aliasesMap: Map<string, string>,
): Map<string, any> {
  const map = new Map<string, any>();
  const bind = (key: string, inst: any) => {
    const normalized = String(key || "").trim().toLowerCase();
    if (normalized && !map.has(normalized)) map.set(normalized, inst);
  };

  for (const item of cacheItems) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    bind(name, {
      instanceName: name,
      name,
      connectionStatus: item.connectionStatus,
      number: item.number,
      ownerJid: item.number,
    });
  }

  for (const item of liveInstances) {
    const inst = item?.instance ?? item;
    bind(resolveEvoInstanceKey(inst), inst);
    bind(String(inst?.instanceName || ""), inst);
    bind(String(inst?.name || ""), inst);
  }

  for (const [technical, alias] of aliasesMap) {
    const inst = map.get(String(technical || "").trim().toLowerCase());
    if (inst && alias) bind(alias, inst);
  }

  return map;
}

async function resolveAquecedorConnectedForOwner(ownerEmail: string): Promise<{
  connected: Array<{ instancia: string; numero: string }>;
  source: "evo-live" | "evo-cache";
  evoDegraded: boolean;
  evoError?: string;
}> {
  const usageMap = await loadInstanceUsageMap();

  const filterScoped = async (connectedAll: Array<{ instancia: string; numero: string }>) => {
    const scoped = await filterConnectedForAquecedorOwner(connectedAll, ownerEmail);
    return scoped.filter((item) => {
      const usage = getInstanceUsageFromMap(usageMap, item.instancia);
      return usage ? usage.useAquecedor !== false : true;
    });
  };

  const mergedEvo = await listMergedConnectedEvoInstancesUnscoped();
  let connected = await filterScoped(mergedEvo.rows);

  const supabase = getSupabaseClient();
  if (supabase && connected.length) {
    const allowed = await listAquecedorScopedInstanceNames(ownerEmail);
    connected = await enrichAquecedorConnectedNumbersFromControleInstancia(
      supabase,
      connected,
      allowed,
    );
    connected = connected.filter((item) => String(item.numero || "").trim());
  }

  const usedCacheSupplement =
    mergedEvo.cacheCount > 0 &&
    connected.length > mergedEvo.liveCount &&
    mergedEvo.liveCount > 0;

  return {
    connected,
    source: mergedEvo.evoOk && !usedCacheSupplement ? "evo-live" : "evo-cache",
    evoDegraded: !mergedEvo.evoOk || usedCacheSupplement,
    evoError: mergedEvo.evoError,
  };
}

async function buildAquecedorConnectedFromControleInstancia(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  ownerEmail: string,
): Promise<Array<{ instancia: string; numero: string }>> {
  const { data: instanciasData } = (await (supabase
    .from("controle_instancia" as any)
    .select("instancia, numero_whatsapp")
    .limit(500)) as any);
  const connectedAll = (Array.isArray(instanciasData) ? instanciasData : [])
    .map((row: { instancia?: string; numero_whatsapp?: string }) => ({
      instancia: String(row?.instancia || "").trim(),
      numero: String(row?.numero_whatsapp || "").trim(),
    }))
    .filter((item) => item.instancia && item.numero);
  const connectedOwned = await filterConnectedForAquecedorOwner(connectedAll, ownerEmail);
  const usageMap = await loadInstanceUsageMap();
  return connectedOwned.filter((item) => {
    const usage = getInstanceUsageFromMap(usageMap, item.instancia);
    return usage ? usage.useAquecedor !== false : true;
  });
}

async function buildControleInstanciaNumToNameMap(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: instanciasData } = (await (supabase
    .from("controle_instancia" as any)
    .select("instancia, numero_whatsapp")
    .limit(500)) as any);
  for (const row of Array.isArray(instanciasData) ? instanciasData : []) {
    const num = normalizeWhatsAppNumber(String(row?.numero_whatsapp || "").trim());
    const inst = String(row?.instancia || "").trim();
    if (num && inst) map.set(num, inst);
  }
  return map;
}

type AquecedorInstanceEligibilityRow = {
  instancia: string;
  eligible: boolean;
  motivos: string[];
  connected: boolean;
  hasNumber: boolean;
  owned: boolean;
  aquecedorEnabled: boolean;
  evoKey?: string;
};

async function analyzeAquecedorInstances(ownerEmail: string | null): Promise<{
  ownerEmail: string | null;
  ownedInstances: string[];
  eligible: Array<{ instancia: string; numero: string }>;
  excluded: AquecedorInstanceEligibilityRow[];
  evoConnectedKeys: string[];
  evoSource?: "live" | "cache" | "merged";
}> {
  const email = String(ownerEmail || "")
    .trim()
    .toLowerCase();
  const ownedInstances = email ? await listAquecedorScopedInstanceNames(email) : [];
  const usageMap = await loadInstanceUsageMap();
  const aliasesMap = await loadInstanceAliasesMap();
  const mergedEvo = await listMergedConnectedEvoInstancesUnscoped();
  const evoList = await fetchEvoInstancesList();
  const cache = await loadEvoInstancesCache();
  const evoSource: "live" | "cache" | "merged" =
    mergedEvo.evoOk && mergedEvo.cacheCount === 0
      ? "live"
      : mergedEvo.evoOk && mergedEvo.liveCount > 0
        ? "merged"
        : "cache";

  const evoByKey = buildEvoInstanceLookupMap(
    evoList.ok ? evoList.instances : [],
    cache?.items || [],
    aliasesMap,
  );

  const eligible: Array<{ instancia: string; numero: string }> = [];
  const excluded: AquecedorInstanceEligibilityRow[] = [];

  for (const ownedName of ownedInstances) {
    const inst = evoByKey.get(ownedName.toLowerCase());
    const motivos: string[] = [];
    let connected = false;
    let hasNumber = false;
    let evoKey: string | undefined;

    if (!inst) {
      motivos.push("nao_encontrada_na_evolution");
    } else {
      evoKey = resolveEvoInstanceKey(inst);
      const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
      connected = status.includes("open");
      if (!connected) motivos.push("desconectada");
      const numero = extractInstanceNumber(inst);
      hasNumber = Boolean(String(numero || "").trim());
      if (!hasNumber) motivos.push("sem_numero_whatsapp");
    }

    const usage = getInstanceUsageFromMap(usageMap, ownedName);
    const aquecedorEnabled = usage ? usage.useAquecedor !== false : true;
    if (!aquecedorEnabled) motivos.push("aquecedor_desabilitado_no_painel");

    const row: AquecedorInstanceEligibilityRow = {
      instancia: ownedName,
      eligible: motivos.length === 0,
      motivos,
      connected,
      hasNumber,
      owned: true,
      aquecedorEnabled,
      evoKey,
    };

    if (row.eligible && inst) {
      const numero =
        extractInstanceNumber(inst) ||
        mergedEvo.rows.find((item) => item.instancia.toLowerCase() === ownedName.toLowerCase())
          ?.numero ||
        "";
      if (numero) {
        eligible.push({
          instancia: ownedName,
          numero,
        });
      } else {
        excluded.push({
          ...row,
          eligible: false,
          motivos: [...row.motivos, "sem_numero_whatsapp"],
        });
      }
    } else {
      excluded.push(row);
    }
  }

  const evoConnectedKeys = mergedEvo.rows.map((c) => c.instancia);
  return {
    ownerEmail: email || null,
    ownedInstances,
    eligible,
    excluded,
    evoConnectedKeys,
    evoSource,
  };
}

function parseAquecedorConfig(input: any): AquecedorConfig {
  const readInt = (key: string, min: number, max: number, fallback: number) => {
    const raw = Number(input?.[key]);
    if (!Number.isFinite(raw)) return fallback;
    const value = Math.floor(raw);
    if (value < min || value > max) {
      throw new Error(`Campo '${key}' fora do intervalo permitido (${min}-${max}).`);
    }
    return value;
  };

  let expediente = AQUECEDOR_DEFAULTS.expediente;
  if (input?.expediente && Array.isArray(input.expediente) && input.expediente.length > 0) {
    expediente = input.expediente.map((batch: any) => {
      const days = Array.isArray(batch?.days) ? batch.days.filter((d: string) => DAY_CODES.includes(d as any)) : [];
      const startHour = Math.max(0, Math.min(23, Math.floor(Number(batch?.startHour ?? 7))));
      const endHour = Math.max(1, Math.min(24, Math.floor(Number(batch?.endHour ?? 22))));
      if (days.length === 0) throw new Error("Cada lote deve ter pelo menos um dia.");
      if (endHour <= startHour) throw new Error("Hora final deve ser maior que a inicial.");
      return { days, startHour, endHour };
    });
  } else if (input?.windowMonWedStartHour != null) {
    const mwStart = Math.max(0, Math.min(23, Math.floor(Number(input.windowMonWedStartHour ?? 7))));
    const mwEnd = Math.max(1, Math.min(24, Math.floor(Number(input.windowMonWedEndHour ?? 22))));
    const tsStart = Math.max(0, Math.min(23, Math.floor(Number(input.windowThuSunStartHour ?? 6))));
    const tsEnd = Math.max(1, Math.min(24, Math.floor(Number(input.windowThuSunEndHour ?? 20))));
    expediente = [
      { days: ["seg", "ter", "qua"], startHour: mwStart, endHour: mwEnd },
      { days: ["qui", "sex", "sab", "dom"], startHour: tsStart, endHour: tsEnd },
    ];
  }

  const janelaAtivaMinutos = input?.janelaAtivaMinutos != null
    ? Math.max(1, Math.min(240, Math.floor(Number(input.janelaAtivaMinutos) || 60)))
    : (input?.activeWindowMinutes != null ? Math.max(1, Math.min(240, Math.floor(Number(input.activeWindowMinutes) || 60))) : 60);
  const pausaMinutos = input?.pausaMinutos != null
    ? Math.max(0, Math.min(240, Math.floor(Number(input.pausaMinutos) || 14)))
    : (input?.pauseMonWedMinutes != null ? Math.max(0, Math.min(240, Math.floor(Number(input.pauseMonWedMinutes) || 14))) : 14);
  const waitMinSeconds = Math.max(10, Math.min(3600, Math.floor(Number(input?.waitMinSeconds) || 180)));
  const waitMaxSeconds = Math.max(10, Math.min(3600, Math.floor(Number(input?.waitMaxSeconds) || 480)));

  if (waitMaxSeconds < waitMinSeconds) {
    throw new Error("Espera máxima deve ser maior ou igual à mínima.");
  }

  return { expediente, janelaAtivaMinutos, pausaMinutos, waitMinSeconds, waitMaxSeconds };
}

function nowInSaoPaulo() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function saoPauloDateKey(now = nowInSaoPaulo()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getInstanceDailySendCount(instanceName: string, dateKey = saoPauloDateKey()): number {
  const key = String(instanceName || "").trim().toLowerCase();
  if (!key) return 0;
  const bucket = instanceDailySendCounts.get(key);
  if (!bucket || bucket.dateKey !== dateKey) return 0;
  return bucket.count;
}

function recordInstanceDailySend(instanceName: string): void {
  const key = String(instanceName || "").trim().toLowerCase();
  if (!key) return;
  const dateKey = saoPauloDateKey();
  const bucket = instanceDailySendCounts.get(key);
  if (!bucket || bucket.dateKey !== dateKey) {
    instanceDailySendCounts.set(key, { dateKey, count: 1 });
    return;
  }
  bucket.count += 1;
}

function applyAlternativaDispatchProfile(config: DisparosConfig): DisparosConfig {
  const throttle = computeAlternativaThrottle({
    startHour: config.startHour ?? DISPAROS_DEFAULTS.startHour,
    endHour: config.endHour ?? DISPAROS_DEFAULTS.endHour,
  });
  return {
    ...config,
    delayMinSeconds: throttle.delayMinSeconds,
    delayMaxSeconds: throttle.delayMaxSeconds,
    maxPerHourPerInstance: throttle.maxPerHourPerInstance,
    maxPerDayPerInstance: throttle.maxPerDayPerInstance,
    lockTtlSeconds: Math.max(180, Math.min(1800, throttle.delayMaxSeconds * 3)),
  };
}

async function shouldApplyAlternativaDispatchProfile(email: string): Promise<boolean> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  const purchased = alternativaNumbersService.getPurchasedSlots(normalized);
  const activated = alternativaActivationRepository.listForEmail(normalized).length;
  return purchased > 0 || activated > 0;
}

async function assertAlternativaDispatchReady(email: string): Promise<void> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!(await shouldApplyAlternativaDispatchProfile(normalized))) return;
  const activated = alternativaActivationRepository.listForEmail(normalized).length;
  assertAlternativaMinActivated(activated);
}

function hasExplicitTimezone(value: string): boolean {
  return /Z$/i.test(value) || /[+-]\d{2}:\d{2}$/.test(value) || /[+-]\d{4}$/.test(value);
}

/** Converte ISO/timestamp do Postgres/Supabase em instante absoluto (fuso SP para valores "naive"). */
function parseWabaInstant(isoOrNull: string | null | undefined): Date | null {
  if (!isoOrNull || typeof isoOrNull !== "string") return null;
  let s = isoOrNull.trim();
  if (!s) return null;
  if (!hasExplicitTimezone(s)) {
    // Postgres/Supabase às vezes devolve timestamptz sem offset; no WABA isso é horário de São Paulo.
    s = s.replace(" ", "T") + "-03:00";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateBr(isoOrNull: string | null | undefined): string {
  const d = parseWabaInstant(isoOrNull);
  if (!d) return "sem data";
  try {
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "sem data";
  }
}

function isAquecedorWindowOpen(config: AquecedorConfig, now: Date) {
  const day = now.getDay();
  const dayCode = DAY_CODES[day];
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minutesOfDay = hour * 60 + minute;

  for (const batch of config.expediente || []) {
    if (!batch.days.includes(dayCode)) continue;
    if (hour < batch.startHour || hour >= batch.endHour) return false;
    const cycle = config.janelaAtivaMinutos + config.pausaMinutos;
    if (cycle <= 0) return false;
    return minutesOfDay % cycle < config.janelaAtivaMinutos;
  }
  return false;
}

function nextAquecedorWindowOpenAt(config: AquecedorConfig, fromSp: Date): Date | null {
  const batches = Array.isArray(config.expediente) ? config.expediente : [];
  if (!batches.length) return null;
  const probe = new Date(fromSp.getTime());
  probe.setSeconds(0, 0);
  // busca até 8 dias à frente, minuto a minuto (janela humanizada depende de minuto do dia)
  const maxMinutes = 8 * 24 * 60;
  for (let i = 0; i < maxMinutes; i += 1) {
    probe.setMinutes(probe.getMinutes() + 1);
    if (isAquecedorWindowOpen(config, probe)) {
      return new Date(probe.getTime());
    }
  }
  return null;
}

async function loadAquecedorEffectiveConfig(): Promise<AquecedorConfig> {
  const { record } = await loadAquecedorConfigRecord();
  return record.useRecommended !== false ? AQUECEDOR_DEFAULTS : record.customConfig;
}

async function runAquecedorCycleTestBatch(
  connected: Array<{ instancia: string; numero: string }>,
  cicloGlobal: number,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  _config: AquecedorConfig
) {
  const combinations: Array<{
    instancia_origem: string;
    instancia_destino: string;
    numero_whatsapp: string;
  }> = [];
  for (const origem of connected) {
    for (const destino of connected) {
      if (origem.instancia === destino.instancia) continue;
      combinations.push({
        instancia_origem: origem.instancia,
        instancia_destino: destino.instancia,
        numero_whatsapp: destino.numero,
      });
    }
  }
  const picked = await pickAquecedorCombinationAsync(
    supabase,
    connected,
    combinations,
    cicloGlobal,
  );
  if (!picked) {
    aquecedorRuntime.lastResult =
      "Teste: nenhum par disponível no momento (aguardando alternância entre instâncias).";
    return;
  }
  const chosen = picked.chosen;
  const deliveryTag = buildAquecedorDeliveryTag();
  const texto = appendAquecedorDeliveryTag("Mensagem de teste do aquecedor.", deliveryTag);
  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
  const numero = normalizeWhatsAppNumber(chosen.numero_whatsapp);
  const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
    ? { number: numero, textMessage: { text: texto } }
    : { number: numero, text: texto, textMessage: { text: texto } };
  const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);
  const proximo = picked.index + 1;
  const origemConnected = connected.find(
    (item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase(),
  );
  if (sendResult.ok) {
    const deliveryCheck = await verifyAquecedorMessageDelivered(
      chosen.instancia_destino,
      String(origemConnected?.numero || ""),
      texto,
    );
    if (!deliveryCheck.ok) {
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: deliveryCheck.detail.slice(0, 500),
        instance: chosen.instancia_destino,
        numeroLen: numero.length,
      };
      aquecedorRuntime.lastResult = `Ciclo teste: ${chosen.instancia_origem} → ${chosen.instancia_destino} não confirmado no destinatário.`;
    } else {
      await (supabase.from("logs_envios" as any) as any).insert({
        instancia_origem: chosen.instancia_origem,
        instancia_destino: chosen.instancia_destino,
        data_envio: new Date().toISOString(),
      });
      await recordAquecedorEnvio({
        instanciaOrigem: chosen.instancia_origem,
        instanciaDestino: chosen.instancia_destino,
        status: "Envio com Sucesso",
      });
      aquecedorRuntime.lastEvoError = null;
      aquecedorRuntime.lastResult = `Ciclo teste: ${chosen.instancia_origem} → ${chosen.instancia_destino} enviado com sucesso.`;
    }
  } else {
    aquecedorRuntime.lastEvoError = {
      status: sendResult.status,
      body: String(sendResult.body || "").slice(0, 500),
      instance: chosen.instancia_origem,
      numeroLen: numero.length,
    };
    aquecedorRuntime.lastResult = `Ciclo teste falhou: ${chosen.instancia_origem} → ${chosen.instancia_destino}.`;
  }
  await (supabase.from("controle_ciclo" as any) as any).upsert(
    { id: 1, ciclo_global: proximo },
    { onConflict: "id" }
  );
}

async function runAquecedorCycle(forceTest = false) {
  if (aquecedorRuntime.isProcessing) return;
  aquecedorRuntime.isProcessing = true;
  aquecedorRuntime.lastRunAt = new Date().toISOString();

  try {
    const now = new Date();
    if (aquecedorRuntime.nextAllowedAt) {
      const nextAllowed = new Date(aquecedorRuntime.nextAllowedAt);
      if (nextAllowed.getTime() > now.getTime()) {
        aquecedorRuntime.lastResult = "Aguardando intervalo aleatório.";
        return;
      }
    }

    const config = await loadAquecedorEffectiveConfig();
    const nowSp = nowInSaoPaulo();
    if (!forceTest && !isAquecedorWindowOpen(config, nowSp)) {
      const nextOpen = nextAquecedorWindowOpenAt(config, nowSp);
      aquecedorRuntime.nextAllowedAt = nextOpen ? nextOpen.toISOString() : null;
      aquecedorRuntime.lastResult = nextOpen
        ? `Fora da janela humanizada. Próximo retorno previsto: ${formatDateBr(nextOpen.toISOString())}.`
        : "Fora da janela humanizada.";
      return;
    }

    if (!aquecedorRuntimeOwnerEmail) {
      aquecedorRuntime.lastResult =
        "Aquecedor sem usuário vinculado. Pare e inicie novamente pela conta correta.";
      return;
    }

    const resolved = await resolveAquecedorConnectedForOwner(aquecedorRuntimeOwnerEmail);
    const connected = resolved.connected;
    updateAquecedorConnectedSummary(connected);

    if (connected.length < 2) {
      const analysis = await analyzeAquecedorInstances(aquecedorRuntimeOwnerEmail);
      const hints = analysis.excluded
        .map((row) => `${row.instancia} (${row.motivos.join(", ")})`)
        .slice(0, 6)
        .join("; ");
      const scopedCount = analysis.ownedInstances.length;
      const evoNote = resolved.evoDegraded
        ? " Evolution indisponível — usando cache local."
        : "";
      aquecedorRuntime.lastResult = hints
        ? `Menos de 2 instâncias habilitadas (${connected.length} conectadas de ${scopedCount} no seu escopo). Verifique: ${hints}${evoNote}`
        : scopedCount < 2
          ? `Menos de 2 instâncias no seu escopo (${scopedCount}). Vincule ou ative números na API Alternativa.${evoNote}`
          : `Menos de 2 instâncias conectadas e habilitadas para Aquecedor (${connected.length} de ${scopedCount}).${evoNote}`;
      return;
    }

    if (resolved.source === "evo-cache") {
      console.warn(
        `[Aquecedor] Evolution degradada — ${connected.length} instância(s) via cache (${resolved.evoError || "sem detalhe"}).`,
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      aquecedorRuntime.lastResult = "Supabase não configurado.";
      return;
    }

    const cutoffStuck = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await ((supabase.from("aquecedor" as any) as any)
      .update({ status: "PENDENTE" })
      .eq("status", "PROCESSANDO")
      .lt("processing_at", cutoffStuck));

    await syncAquecedorConnectedInstances(supabase, connected);

    const combinations: Array<{
      instancia_origem: string;
      instancia_destino: string;
      numero_whatsapp: string;
    }> = [];

    for (const origem of connected) {
      for (const destino of connected) {
        if (origem.instancia === destino.instancia) continue;
        combinations.push({
          instancia_origem: origem.instancia,
          instancia_destino: destino.instancia,
          numero_whatsapp: destino.numero,
        });
      }
    }

    if (!combinations.length) {
      aquecedorRuntime.lastResult = "Sem combinações válidas.";
      return;
    }

    await ensureAquecedorPendingMessage();

    const { data: cicloData } = await (supabase
      .from("controle_ciclo" as any)
      .select("id, ciclo_global")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()) as any;
    const cicloGlobal =
      typeof cicloData?.ciclo_global === "number" ? Math.floor(cicloData.ciclo_global) : 0;
    if (forceTest) {
      await runAquecedorCycleTestBatch(connected, cicloGlobal, supabase, config);
      return;
    }

    const picked = await pickAquecedorCombinationAsync(
      supabase,
      connected,
      combinations,
      cicloGlobal,
    );
    if (!picked) {
      const retrySeconds = Math.max(60, Math.min(config.waitMinSeconds, 180));
      aquecedorRuntime.nextAllowedAt = new Date(Date.now() + retrySeconds * 1000).toISOString();
      aquecedorRuntime.lastResult =
        "Aguardando turno: cada instância só envia após receber (A→B, depois B→A). Nenhum par elegível agora.";
      return;
    }

    const chosen = picked.chosen;
    const proximo = picked.index + 1;
    const pairContext = buildAquecedorPairContext(chosen, connected);

    const ensured = await ensureAquecedorPendingMessage(pairContext);
    const pendingData = await fetchProcessableAquecedorPending(supabase);
    if (!pendingData?.id) {
      const reason =
        ensured.reason || "Falha ao preparar mensagem pendente na fila do aquecedor.";
      if (!ensured.ok && isSupabaseTransientError({ message: reason })) {
        aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
        aquecedorRuntime.lastResult = await describeSupabaseConnectivityFailure();
      } else {
        aquecedorRuntime.lastResult = ensured.ok
          ? "Sem mensagem pendente para envio (fila vazia após preparação)."
          : reason;
      }
      return;
    }

    const texto = await resolveAquecedorMessageForSend(
      supabase,
      pendingData.id,
      String(pendingData.mensagem || ""),
      pairContext,
    );

    const turnCheck = await verifyAquecedorConversationTurn(
      supabase,
      connected,
      chosen.instancia_origem,
      chosen.instancia_destino,
    );
    if (!turnCheck.ok) {
      aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 90_000).toISOString();
      aquecedorRuntime.lastResult = turnCheck.reason;
      return;
    }

    if (
      await hasRecentAquecedorSendBetween(
        supabase,
        connected,
        chosen.instancia_origem,
        chosen.instancia_destino,
        90,
      )
    ) {
      aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 90_000).toISOString();
      aquecedorRuntime.lastResult = `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} ignorado: envio duplicado detectado no mesmo par.`;
      return;
    }

    const turnRecheck = await verifyAquecedorConversationTurn(
      supabase,
      connected,
      chosen.instancia_origem,
      chosen.instancia_destino,
    );
    if (!turnRecheck.ok) {
      aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 90_000).toISOString();
      aquecedorRuntime.lastResult = turnRecheck.reason;
      return;
    }

    const deliveryTag = buildAquecedorDeliveryTag();
    const textoEnvio = appendAquecedorDeliveryTag(texto, deliveryTag);

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "PROCESSANDO",
        processing_at: new Date().toISOString(),
        instancia: chosen.instancia_origem,
        numero_destino: normalizeWhatsAppNumber(chosen.numero_whatsapp) || chosen.numero_whatsapp,
        mensagem: textoEnvio,
      })
      .eq("id", pendingData.id);

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
    const numero = normalizeWhatsAppNumber(chosen.numero_whatsapp);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: numero, textMessage: { text: textoEnvio } }
      : { number: numero, text: textoEnvio, textMessage: { text: textoEnvio } };
    const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);

    if (!sendResult.ok) {
      await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id);
      const evoDetail =
        sendResult.json?.message ||
        (Array.isArray(sendResult.json?.message) ? sendResult.json.message[0] : null) ||
        sendResult.json?.error ||
        (typeof sendResult.json?.detail === "string" ? sendResult.json.detail : null) ||
        (sendResult.body && sendResult.body.length < 200 ? sendResult.body : null);
      const detail = evoDetail ? ` (${String(evoDetail).slice(0, 120)})` : "";
      aquecedorRuntime.lastResult = `Falha no envio via EVO (HTTP ${sendResult.status})${detail}. Mensagem voltou para pendente.`;
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: String(sendResult.body || "").slice(0, 500),
        instance: chosen.instancia_origem,
        numeroLen: numero.length,
      };
      console.error("[Aquecedor] sendText falhou:", aquecedorRuntime.lastEvoError);
      return;
    }

    const origemConnected = connected.find(
      (item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase(),
    );
    const deliveryCheck = await verifyAquecedorMessageDelivered(
      chosen.instancia_destino,
      String(origemConnected?.numero || ""),
      textoEnvio,
    );
    if (!deliveryCheck.ok) {
      await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id);
      aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 120_000).toISOString();
      aquecedorRuntime.lastResult = `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} não confirmado no destinatário. ${deliveryCheck.detail}`;
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: deliveryCheck.detail.slice(0, 500),
        instance: chosen.instancia_destino,
        numeroLen: numero.length,
      };
      console.warn("[Aquecedor] entrega não confirmada:", aquecedorRuntime.lastEvoError);
      return;
    }
    aquecedorRuntime.lastEvoError = null;

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "ENVIADO",
        sent_at: new Date().toISOString(),
      })
      .eq("id", pendingData.id);

    await (supabase.from("logs_envios" as any) as any).insert({
      instancia_origem: chosen.instancia_origem,
      instancia_destino: chosen.instancia_destino,
      data_envio: new Date().toISOString(),
    });
    await recordAquecedorEnvio({
      instanciaOrigem: chosen.instancia_origem,
      instanciaDestino: chosen.instancia_destino,
      status: "Envio com Sucesso",
    });

    const nextPick = await pickAquecedorCombinationAsync(
      supabase,
      connected,
      combinations,
      proximo,
    );
    await ensureAquecedorPendingMessage(
      nextPick ? buildAquecedorPairContext(nextPick.chosen, connected) : null,
    );

    await (supabase.from("controle_ciclo" as any) as any).upsert(
      { id: 1, ciclo_global: proximo },
      { onConflict: "id" }
    );

    const waitMin = config.waitMinSeconds;
    const waitMax = config.waitMaxSeconds;
    const waitSeconds =
      Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
    aquecedorRuntime.nextAllowedAt = new Date(Date.now() + waitSeconds * 1000).toISOString();
    aquecedorRuntime.lastResult = `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} realizado. Próximo ciclo em ~${waitSeconds}s.`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro no ciclo do aquecedor:", error);
    aquecedorRuntime.lastResult = `Erro no ciclo do aquecedor: ${msg.slice(0, 200)}`;
  } finally {
    aquecedorRuntime.isProcessing = false;
    if (shouldThisProcessLeadAquecedor(aquecedorPersistedBundle)) {
      void persistAquecedorRuntimeSnapshot({
        workerId: getAquecedorWorkerId(),
        workerHeartbeatAt: new Date().toISOString(),
      });
    }
  }
}

function startAquecedorRuntimeLocal(): void {
  if (!ENABLE_AQUECEDOR_PROCESSING) {
    aquecedorRuntime.running = false;
    aquecedorRuntime.lastResult =
      "Aquecedor desativado neste processo (ENABLE_AQUECEDOR_PROCESSING=false).";
    return;
  }
  if (aquecedorInterval) return;
  aquecedorRuntime.running = true;
  aquecedorInterval = setInterval(() => {
    if (!aquecedorRuntime.running) return;
    runAquecedorCycle();
  }, 30000);
  void ensureAquecedorPendingMessage();
  runAquecedorCycle();
}

function startAquecedorRuntime(): void {
  startAquecedorRuntimeLocal();
}

function stopAquecedorRuntime(): void {
  stopAquecedorRuntimeLocal();
  aquecedorRuntimeOwnerEmail = null;
}

let indexHtmlTemplate: string | null = null;
function resolveIndexHtmlPath(): string {
  const rootHtml = path.join(rootPath, "index.html");
  const distHtml = path.join(distPath, "index.html");
  if (RUNTIME_MODE === "development" && existsSync(rootHtml)) {
    return rootHtml;
  }
  return distHtml;
}
function loadIndexHtmlTemplate(): string {
  const htmlPath = resolveIndexHtmlPath();
  if (RUNTIME_MODE === "development") {
    return readFileSync(htmlPath, "utf8");
  }
  if (!indexHtmlTemplate) {
    indexHtmlTemplate = readFileSync(htmlPath, "utf8");
  }
  return indexHtmlTemplate;
}

function resolveUiProfile(): WabaUiProfile {
  const explicit = String(process.env.WABA_UI_PROFILE || "")
    .trim()
    .toLowerCase();
  if (explicit === "production" || explicit === "full") {
    return explicit;
  }
  // V01 = UI pré-disparador comercial (08/06/2026): API não oficial + API Meta.
  if (WABA_ENV === "v01") return "baseline";
  return "production";
}

function sendIndexHtml(res: express.Response) {
  const html = injectRuntimeIntoIndexHtml(loadIndexHtmlTemplate(), {
    basePath: BASE_PATH,
    uiProfile: resolveUiProfile(),
  });
  res.type("html").send(html);
}

const staticNoIndex = { index: false as const };

app.get("/", (req, res) => {
  if (BASE_PATH && !requestUnderBasePath(req)) {
    return res.redirect(301, `${BASE_PATH}/`);
  }
  sendIndexHtml(res);
});

app.get("/index.html", (_req, res) => {
  sendIndexHtml(res);
});

const sendVendasPage = (res: express.Response) => {
  const vendasPath = path.join(rootPath, "public-pages", "vendas.html");
  const cadastroPath = path.join(rootPath, "public-pages", "cadastro.html");
  const sourcePath = existsSync(vendasPath)
    ? vendasPath
    : existsSync(cadastroPath)
      ? cadastroPath
      : null;
  if (!sourcePath) {
    return res.status(404).type("html").send("<p>Página de vendas indisponível.</p>");
  }
  const html = injectRuntimeIntoIndexHtml(readFileSync(sourcePath, "utf8"), {
    basePath: BASE_PATH,
    uiProfile: "full",
  });
  return res.type("html").send(html);
};

app.get("/cadastro", (_req, res) => sendVendasPage(res));

app.get("/vendas", (_req, res) => sendVendasPage(res));

if (BASE_PATH) {
  // Após stripBasePathMiddleware, assets ficam em req.url relativo à raiz.
  app.use((req, res, next) => {
    if (!requestUnderBasePath(req)) return next();
    return express.static(distPath, staticNoIndex)(req, res, next);
  });
} else {
  app.use(express.static(distPath, staticNoIndex));
}

// Dados direto do banco (view logs_envios_br já com fuso tratado)
app.get("/dados", async (req, res) => {
  try {
    const rangeStart =
      typeof req.query.rangeStart === "string" ? req.query.rangeStart : null;
    const rangeEnd =
      typeof req.query.rangeEnd === "string" ? req.query.rangeEnd : null;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const isValidYMD = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd);

    const dateToNextDayYMD = (ymd: string) => {
      // ymd: YYYY-MM-DD
      if (!isValidYMD(ymd)) {
        throw new Error("Formato de data inválido");
      }
      const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    };

    let query = supabase
      .from("logs_envios_br")
      .select(
        "id, ciclo_global, instancia_origem, instancia_destino, created_at, data_envio_br"
      )
      .order("data_envio_br", { ascending: false });

    let totalCount: number | null = null;
    let countsBySender: Record<string, number> | null = null;

    if (rangeStart && rangeEnd) {
      if (!isValidYMD(rangeStart) || !isValidYMD(rangeEnd)) {
        return res.status(400).json({ error: "rangeStart/rangeEnd devem ser YYYY-MM-DD" });
      }
      // data_envio_br já vem da view com fuso tratado (America/Sao_Paulo).
      // Como a query retorna em formato timestamp sem timezone (no geral),
      // comparamos por "timestamp sem fuso" usando literais "YYYY-MM-DD HH:MM:SS".
      const startTs = `${rangeStart} 00:00:00`;
      const endExclusive = dateToNextDayYMD(rangeEnd);
      const endTs = `${endExclusive} 00:00:00`;

      // Count exato para bater com o SQL da view (sem precisar trazer todas as linhas)
      const { count, error: countError } = await supabase
        .from("logs_envios_br")
        .select("id", { count: "exact", head: true })
        .gte("data_envio_br", startTs)
        .lt("data_envio_br", endTs);

      if (!countError && typeof count === "number") {
        totalCount = count;
      } else {
        console.error("Erro count exato:", countError);
      }

      // Distribuição por instância de origem (para gráfico de barras)
      // O PostgREST pode limitar ~1000 linhas por request e agregações podem ser desabilitadas.
      // Então paginamos e contamos no backend para bater exatamente com a contagem exata.
      if (typeof totalCount === "number" && totalCount > 0) {
        countsBySender = {};

        const pageSize = 1000;
        let offset = 0;
        let safety = 0;

        while (offset < totalCount && safety < 50) {
          safety += 1;

          const { data: senderRows, error: senderErr } = await supabase
            .from("logs_envios_br")
            .select("instancia_origem")
            .gte("data_envio_br", startTs)
            .lt("data_envio_br", endTs)
            .order("data_envio_br", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (senderErr) {
            console.error("Erro countsBySender pagination:", senderErr);
            break;
          }

          if (!senderRows || senderRows.length === 0) break;

          senderRows.forEach((r: any) => {
            const key = r?.instancia_origem || "—";
            countsBySender![key] = (countsBySender![key] || 0) + 1;
          });

          offset += senderRows.length;
          if (senderRows.length < pageSize) break;
        }
      }

      // Linhas limitadas para montar lista/gráficos (o PostgREST pode limitar ~1000)
      query = query.gte("data_envio_br", startTs).lt("data_envio_br", endTs).limit(5000);
    } else {
      query = query.limit(2000);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro Supabase:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados no Supabase" });
    }

    const rows = data ?? [];

    const texto = rows
      .map((row: any) => {
        const dataHora = row.data_envio_br || row.created_at || "";
        const quemEnviou = row.instancia_origem || "";
        const quemRecebeu = row.instancia_destino || "";

        return `Data/Hora: ${dataHora}\nQuem enviou: ${quemEnviou}\nQuem recebeu: ${quemRecebeu}`;
      })
      .join("\n-----------------------------\n");

    return res.json({ log: texto, count: rows.length, totalCount, countsBySender });
  } catch (error) {
    console.error("Erro ao buscar dados no Supabase:", error);
    return res.status(500).json({ error: "Erro ao buscar dados no Supabase" });
  }
});

// Status das instancias (Evolution API)
app.get("/instancias/snapshot", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para consultar instâncias." });
    }
    const snapshot = await buildInstancesSnapshotForAuth(auth);
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error("Erro ao carregar snapshot de instâncias:", error);
    return res.status(500).json({ error: "Erro ao carregar instâncias do cache." });
  }
});

// Status das instancias (Evolution API)
app.get("/instancias", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const forceRefresh = String(req.query.refresh ?? "").trim() === "1";
    if (!forceRefresh) {
      const snapshot = await buildInstancesSnapshotForAuth(auth);
      return res.status(200).json(snapshot);
    }

    const aliasesMap = await loadInstanceAliasesMap();
    const whatsappNamesMap = await loadWhatsappProfileNamesMap();
    const evoList = await fetchEvoInstancesList();
    if (!evoList.ok) {
      const evolutionError = describeEvoInstancesFetchError(evoList.status, evoList.detail);
      console.error("Erro Evolution API:", evoList.status, evoList.detail);
      const fallback = await buildFallbackInstancesForAuth(auth, evolutionError);
      if (fallback.items.length > 0) {
        console.warn(
          `[instancias] Evolution indisponível — retornando ${fallback.items.length} instância(s) do cache/dono (${auth.email || "guest"}).`,
        );
        return res.status(200).json(fallback);
      }
      return res.status(500).json({
        error: evolutionError,
        evolutionStatus: evoList.status,
        evolutionDetail: evoList.detail,
      });
    }

    const instances: any[] = evoList.instances;

    let ativas = 0;
    let desconectadas = 0;

    for (const inst of instances) {
      if (inst.connectionStatus === "open") {
        ativas += 1;
      } else {
        desconectadas += 1;
      }
    }

    const total = instances.length;

    const pickNumeric = (...values: any[]): number => {
      for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return 0;
    };

    // Retorna apenas campos úteis para a UI (evita expor payload sensível)
    const baseItems = instances.slice(0, 100).map((inst: any, idx: number) => {
      const candidateName =
        inst.instanceName ??
        inst.name ??
        inst.id ??
        inst.instanceId ??
        inst.instance ??
        null;

      const instanceKey =
        candidateName == null || candidateName === ""
          ? `Instância ${idx + 1}`
          : String(candidateName);
      const displayName = instanceKey;

      const connectionStatus =
        typeof inst.connectionStatus === "string"
          ? inst.connectionStatus
          : "unknown";

      const contacts = pickNumeric(
        inst.contacts,
        inst.contactsCount,
        inst.totalContacts,
        inst._count?.Contact,
        inst._count?.contacts,
        inst.profile?.contacts,
        inst.stats?.contacts
      );

      const messages = pickNumeric(
        inst.messages,
        inst.messagesCount,
        inst.totalMessages,
        inst.chatsCount,
        inst._count?.Message,
        inst._count?.messages,
        inst.profile?.messages,
        inst.stats?.messages
      );

      const number = extractInstanceNumber(inst);

      const profilePicUrl =
        typeof inst.profilePicUrl === "string" ? inst.profilePicUrl : "";

      const avatarVersion =
        typeof inst.updatedAt === "string" ? inst.updatedAt : "";

      const createdAt =
        typeof inst.createdAt === "string"
          ? inst.createdAt
          : typeof inst.created_at === "string"
            ? inst.created_at
            : "";

      const instanceAlias = aliasesMap.get(instanceKey) || "";
      const whatsappNameOverride = whatsappNamesMap.get(instanceKey) || "";
      return {
        name: instanceKey,
        // "Nome" da UI = nome de perfil do WhatsApp (não alias técnico da instância).
        displayName: whatsappNameOverride || String(inst.profileName || displayName),
        whatsappNameOverride,
        instanceAlias,
        connectionStatus,
        number: String(number || ""),
        contacts,
        messages,
        profilePicUrl,
        avatarVersion,
        createdAt,
      };
    });

    let items = baseItems;
    if (EVO_LIVE_PROFILE_SYNC) {
      items = await Promise.all(
        baseItems.map(async (row: any) => {
          const status = String(row?.connectionStatus || "").toLowerCase();
          if (!status.includes("open")) return row;
          const live = await fetchLiveWhatsappProfile(
            String(row?.name || row?.displayName || ""),
            String(row?.number || "")
          );
          return {
            ...row,
            // Prioriza nome vindo da sessão WhatsApp em tempo real.
            displayName: row.whatsappNameOverride || live.profileName || row.displayName,
            profilePicUrl: live.profilePicUrl || row.profilePicUrl,
            avatarVersion: new Date().toISOString(),
          };
        })
      );
    }

    const allNames = baseItems.map((row) => String(row?.name || "").trim()).filter(Boolean);
    const reconciled = await wabaInstanceOwnershipService.reconcileOrphanInstancesForMaster(
      auth,
      allNames,
    );
    if (reconciled > 0) {
      console.info(
        `[instancias] ${reconciled} instância(s) órfã(s) vinculada(s) ao master ${auth.email}.`,
      );
    }
    items = await wabaInstanceOwnershipService.filterItemsForAuth(auth, items, (row) =>
      String(row?.name || "")
    );
    ativas = items.filter((row) => String(row?.connectionStatus || "").toLowerCase().includes("open"))
      .length;
    desconectadas = items.length - ativas;

    void saveEvoInstancesCache(
      baseItems.map((row) => ({ ...row })) as Array<Record<string, unknown>>,
    );

    return res.json({ total: items.length, ativas, desconectadas, items });
  } catch (error) {
    console.error("Erro ao consultar Evolution API:", error);
    return res
      .status(500)
      .json({ error: "Erro ao consultar Evolution API" });
  }
});

function isAllowedAvatarHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  const allowedHosts = [
    "whatsapp.net",
    "whatsapp.com",
    "fbcdn.net",
    "facebook.com",
    "cdninstagram.com",
  ];
  return allowedHosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

const INSTANCE_AVATAR_PLACEHOLDER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Sem foto">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  <text x="32" y="39" text-anchor="middle" fill="#ffffff" font-size="22" font-family="Segoe UI, sans-serif">◎</text>
</svg>`,
  "utf-8",
);

function sendInstanceAvatarPlaceholder(res: express.Response) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(INSTANCE_AVATAR_PLACEHOLDER_SVG);
}

app.get("/instancias/avatar", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      return sendInstanceAvatarPlaceholder(res);
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return sendInstanceAvatarPlaceholder(res);
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return sendInstanceAvatarPlaceholder(res);
    }
    if (!isAllowedAvatarHost(parsed.hostname)) {
      return sendInstanceAvatarPlaceholder(res);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(parsed.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://web.whatsapp.com/",
        },
        redirect: "follow",
      });
      if (!response.ok) {
        return sendInstanceAvatarPlaceholder(res);
      }
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType && !contentType.startsWith("image/")) {
        return sendInstanceAvatarPlaceholder(res);
      }
      const resolvedType = contentType.startsWith("image/") ? contentType : "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length < 16) {
        return sendInstanceAvatarPlaceholder(res);
      }
      res.setHeader("Content-Type", resolvedType);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.send(buffer);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erro ao buscar avatar proxy:", error);
    return sendInstanceAvatarPlaceholder(res);
  }
});

app.post("/instancias/:name/alias", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    const alias = String(req.body?.alias || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;
    if (!alias) {
      return res.status(400).json({ error: "Alias é obrigatório." });
    }

    const map = await loadInstanceAliasesMap();
    map.set(instanceName, alias);
    await persistInstanceAliasesMap(map);
    return res.json({
      ok: true,
      message: "Nome da instância salvo com sucesso.",
      instanceName,
      alias,
    });
  } catch (error) {
    console.error("Erro ao salvar alias da instância:", error);
    return res.status(500).json({ error: "Erro ao salvar nome da instância." });
  }
});

app.post("/instancias/:name/whatsapp-name", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    const whatsappName = String(req.body?.whatsappName || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;
    if (!whatsappName) {
      return res.status(400).json({ error: "Nome (WhatsApp) é obrigatório." });
    }
    const map = await loadWhatsappProfileNamesMap();
    map.set(instanceName, whatsappName);
    await persistWhatsappProfileNamesMap(map);
    return res.json({
      ok: true,
      message: "Nome (WhatsApp) salvo com sucesso.",
      instanceName,
      whatsappName,
    });
  } catch (error) {
    console.error("Erro ao salvar nome WhatsApp da instância:", error);
    return res.status(500).json({ error: "Erro ao salvar nome (WhatsApp)." });
  }
});

app.get("/instancias/uso-config", async (req, res) => {
  try {
    const usageMap = await loadInstanceUsageMap();
    const auth = resolveWabaRequestAuth(req);
    const allowed = await wabaInstanceOwnershipService.filterInstanceNamesForAuth(
      auth,
      Array.from(usageMap.keys())
    );
    const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
    const items = Array.from(usageMap.entries())
      .filter(([instanceName]) => allowedLower.has(String(instanceName).toLowerCase()))
      .map(([instanceName, cfg]) => ({
        instanceName,
        ...cfg,
      }));
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar configuração de uso das instâncias." });
  }
});

app.post("/instancias/uso-config", async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = rawItems
      .map((row: any) => ({
        instanceName: String(row?.instanceName || "").trim(),
        useAquecedor: row?.useAquecedor !== false,
        useDisparador: row?.useDisparador !== false,
        useFazenda: row?.useFazenda === true,
      }))
      .filter((row: any) => row.instanceName);
    const auth = resolveWabaRequestAuth(req);
    const isMaster = auth.role === "master" || isWabaMasterEmail(auth.email);
    const allowed = await rejectForeignInstanceNames(
      req,
      items.map((row: { instanceName: string }) => row.instanceName)
    );
    const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
    const filtered = items.filter((row: { instanceName: string }) =>
      allowedLower.has(row.instanceName.toLowerCase())
    );
    const sanitized = filtered.map((row: { instanceName: string; useAquecedor: boolean; useDisparador: boolean; useFazenda: boolean }) => {
      if (isMaster) return row;
      const { useFazenda: _ignored, ...rest } = row;
      return rest;
    });
    if (!sanitized.length) {
      return res.status(400).json({ error: "Nenhuma instância válida foi informada." });
    }
    await persistInstanceUsage(sanitized);
    return res.json({ ok: true, message: "Configuração de uso das instâncias salva.", items: sanitized });
  } catch {
    return res.status(500).json({ error: "Erro ao salvar configuração de uso das instâncias." });
  }
});

app.post("/webhooks/evolution", (req, res) => {
  try {
    handleEvolutionWebhookPayload(req.body);
    handleInboundValidationWebhook(req.body);
    return res.json({ ok: true });
  } catch (error) {
    console.error("POST /webhooks/evolution", error);
    return res.status(500).json({ error: "Erro ao processar webhook Evolution." });
  }
});

app.post("/instancias/:name/probe-integracao", async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (await rejectForeignInstance(req, res, name)) return;
    const destinationInstanceName = String(req.body?.destinationInstanceName || "").trim() || undefined;
    if (
      destinationInstanceName &&
      (await rejectForeignInstance(req, res, destinationInstanceName))
    ) {
      return;
    }
    const started = await startIntegrationProbe({
      sourceInstanceName: name,
      destinationInstanceName,
      allowMessageSend: req.body?.allowMessageSend === true,
    });
    if (started.error) {
      return res.status(400).json({ ok: false, error: started.error });
    }
    const status = started.status || getIntegrationProbeStatus(String(started.probeId || ""));
    return res.json({ ok: true, probeId: started.probeId, ...status });
  } catch (error: any) {
    console.error("POST /instancias/:name/probe-integracao", error);
    return res.status(500).json({ error: error?.message || "Erro ao iniciar teste de integração." });
  }
});

app.get("/instancias/probe-integracao/:probeId", (req, res) => {
  const probeId = String(req.params.probeId || "").trim();
  if (!probeId) {
    return res.status(400).json({ error: "probeId é obrigatório." });
  }
  const status = getIntegrationProbeStatus(probeId);
  if (!status) {
    return res.status(404).json({ error: "Teste de integração não encontrado ou expirado." });
  }
  return res.json({ ok: true, ...status });
});

app.post("/instancias/:name/validacao-inbound", async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (await rejectForeignInstance(req, res, name)) return;
    const instanceNumberHint = String(req.body?.number || req.body?.instanceNumberHint || "").trim();
    const started = await startInboundValidation({ instanceName: name, instanceNumberHint });
    if (started.error) {
      return res.status(400).json({ ok: false, error: started.error });
    }
    const status =
      started.status || getInboundValidationStatus(String(started.validationId || ""));
    return res.json({ ok: true, validationId: started.validationId, ...status });
  } catch (error: any) {
    console.error("POST /instancias/:name/validacao-inbound", error);
    return res.status(500).json({ error: error?.message || "Erro ao iniciar validação inbound." });
  }
});

app.get("/instancias/validacao-inbound/:validationId", (req, res) => {
  const validationId = String(req.params.validationId || "").trim();
  if (!validationId) {
    return res.status(400).json({ error: "validationId é obrigatório." });
  }
  const status = getInboundValidationStatus(validationId);
  if (!status) {
    return res.status(404).json({ error: "Validação não encontrada ou expirada." });
  }
  return res.json({ ok: true, ...status });
});

function buildTemplateUrl(template: string, instanceName: string) {
  if (!template) return "";
  return template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));
}

function normalizeWhatsAppNumber(num: string): string {
  const raw = String(num || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
    return "55" + digits;
  }
  return digits;
}

function normalizeCampaignPhone(input: string): string {
  const normalized = normalizeWhatsAppNumber(String(input || ""));
  return String(normalized || "").replace(/\D/g, "");
}

/** Uma linha de contato → um destino: remove duplicatas pelo telefone normalizado (55…). */
function deduplicateCampaignDestinationPhones(
  digitCandidates: string[]
): { phones: string[]; removedDuplicates: number } {
  const seen = new Set<string>();
  const phones: string[] = [];
  let removedDuplicates = 0;
  for (const cand of digitCandidates) {
    const digits = normalizeCampaignPhone(String(cand || ""));
    if (digits.length < 12) continue;
    if (seen.has(digits)) {
      removedDuplicates += 1;
      continue;
    }
    seen.add(digits);
    phones.push(digits);
  }
  return { phones, removedDuplicates };
}

function isPlausibleBrWhatsappDestinationDigits(digits: string): boolean {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d.startsWith("55")) return false;
  if (d.length < 12 || d.length > 13) return false;
  if (d.length === 13) return d[4] === "9";
  return true;
}

function classifyEvoSendFailure(status: number, body: string): LeadFailureKind {
  const b = String(body || "").toLowerCase();
  if (
    b.includes("not registered") ||
    b.includes("not exist") ||
    b.includes("not found") ||
    (b.includes("invalid") &&
      (b.includes("number") || b.includes("phone") || b.includes("jid") || b.includes("recipient"))) ||
    b.includes("is not on whatsapp") ||
    b.includes("no whatsapp") ||
    (status === 400 && (b.includes("number") || b.includes("jid")))
  ) {
    return "destination_error";
  }
  return "send_error";
}

function extractNumbersFromXlsxBuffer(
  buffer: Buffer,
  numberColumn: string
): { phones: string[]; removedDuplicates: number } {
  const col = String(numberColumn || "").trim();
  if (!col) return { phones: [], removedDuplicates: 0 };
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { phones: [], removedDuplicates: 0 };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const bucket: string[] = [];
  for (const row of rows) {
    const raw = row[col];
    const digits = normalizeCampaignPhone(String(raw ?? ""));
    if (digits.length >= 12) bucket.push(digits);
  }
  return deduplicateCampaignDestinationPhones(bucket);
}

function extractInstanceNumber(inst: any): string {
  const raw =
    inst?.ownerJid ??
    inst?.owner ??
    inst?.number ??
    inst?.phone ??
    inst?.ownerNumber ??
    inst?.profile?.owner ??
    "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[0] || s;
  return s;
}

function normalizeOwnerNumberForWhatsapp(numberLike: string): string {
  const raw = String(numberLike || "").trim().toLowerCase();
  if (raw.includes("@s.whatsapp.net")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) return `${digits}@s.whatsapp.net`;
  if (digits.length >= 10) return `55${digits}@s.whatsapp.net`;
  return `${digits}@s.whatsapp.net`;
}

function normalizeDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function buildComparableOwnerDigits(ownerDigitsRaw: string): Set<string> {
  const digits = normalizeDigits(ownerDigitsRaw);
  const out = new Set<string>();
  if (!digits) return out;
  out.add(digits);
  if (digits.startsWith("55") && digits.length > 11) out.add(digits.slice(2));
  if (digits.length > 11) out.add(digits.slice(-11));
  if (digits.length > 10) out.add(digits.slice(-10));
  return out;
}

function extractOwnerMatchedName(payload: any, ownerJid: string, ownerDigitsRaw: string): string {
  const ownerDigitsSet = buildComparableOwnerDigits(ownerDigitsRaw);
  const ownerJidLc = String(ownerJid || "").toLowerCase().trim();
  const seen = new Set<any>();
  const queue: any[] = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const idCandidate =
      node?.id ??
      node?.jid ??
      node?.wuid ??
      node?.owner ??
      node?.number ??
      node?.phone ??
      node?.remoteJid ??
      "";
    const idText = String(idCandidate || "").toLowerCase().trim();
    const idDigits = normalizeDigits(idText.includes("@") ? idText.split("@")[0] : idText);
    const idMatchesOwner =
      (ownerJidLc && idText === ownerJidLc) ||
      (idDigits && ownerDigitsSet.has(idDigits));
    if (idMatchesOwner) {
      const maybeName =
        node?.profileName ??
        node?.pushName ??
        node?.pushname ??
        node?.name ??
        node?.notify ??
        node?.verifiedName ??
        node?.businessName ??
        "";
      if (typeof maybeName === "string" && maybeName.trim()) return maybeName.trim();
    }
    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") queue.push(value);
    });
  }
  return "";
}

function pickProfileNameFromPayload(payload: any): string {
  const candidates = [
    payload?.profileName,
    payload?.pushName,
    payload?.businessName,
    payload?.verifiedName,
    payload?.profile?.name,
    payload?.profile?.pushName,
    payload?.profile?.businessName,
    payload?.profile?.verifiedName,
    payload?.response?.profileName,
    payload?.response?.pushName,
    payload?.response?.businessName,
    payload?.response?.verifiedName,
    payload?.response?.profile?.name,
    payload?.response?.profile?.pushName,
    payload?.data?.profileName,
    payload?.data?.pushName,
    payload?.data?.businessName,
    payload?.data?.verifiedName,
    payload?.data?.profile?.name,
    payload?.data?.profile?.pushName,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  // Fallback flexível, sem usar caminhos de contatos para evitar nome de terceiros.
  const seen = new Set<any>();
  const queue: any[] = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (/contact|contacts/i.test(key)) continue;
      if (
        typeof value === "string" &&
        value.trim() &&
        /(profile.?name|push.?name|business.?name|verified.?name)/i.test(key)
      ) {
        return value.trim();
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
}

function pickProfilePictureFromPayload(payload: any): string {
  const candidates = [
    payload?.profilePictureUrl,
    payload?.profilePicUrl,
    payload?.pictureUrl,
    payload?.imageUrl,
    payload?.picUrl,
    payload?.response?.profilePictureUrl,
    payload?.response?.profilePicUrl,
    payload?.data?.profilePictureUrl,
    payload?.data?.profilePicUrl,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
  }
  // Fallback flexível para variações de schema entre versões da EVO
  const seen = new Set<any>();
  const queue: any[] = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (
        typeof value === "string" &&
        /^https?:\/\//i.test(value.trim()) &&
        /(profile.?picture|profile.?pic|picture.?url|image.?url|pic.?url|avatar)/i.test(key)
      ) {
        return value.trim();
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
}

async function fetchLiveWhatsappProfile(instanceName: string, numberLike: string) {
  const safeInstance = String(instanceName || "").trim();
  if (!safeInstance) return { profileName: "", profilePicUrl: "" };

  const digits = String(numberLike || "").replace(/\D/g, "");
  const jid = normalizeOwnerNumberForWhatsapp(numberLike);

  const profileCalls: Array<{ url: string; method: "GET" | "POST"; body?: Record<string, any> }> = [
    { url: `${EVO_API_BASE}/profile/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
    { url: `${EVO_API_BASE}/instance/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
    { url: `${EVO_API_BASE}/chat/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
  ];
  const pictureCalls: Array<{ url: string; method: "GET" | "POST"; body?: Record<string, any> }> = [
    {
      url: `${EVO_API_BASE}/chat/fetchProfilePictureUrl/${encodeURIComponent(safeInstance)}`,
      method: "POST",
      body: digits ? { number: digits } : undefined,
    },
    {
      url: `${EVO_API_BASE}/chat/fetchProfilePictureUrl/${encodeURIComponent(safeInstance)}`,
      method: "POST",
      body: jid ? { number: jid } : undefined,
    },
    {
      url: `${EVO_API_BASE}/chat/fetchProfile/${encodeURIComponent(safeInstance)}`,
      method: "POST",
      body: jid ? { number: jid } : undefined,
    },
    {
      url: `${EVO_API_BASE}/chat/fetchProfile/${encodeURIComponent(safeInstance)}`,
      method: "POST",
      body: digits ? { number: digits } : undefined,
    },
  ];

  let profileName = "";
  let profilePicUrl = "";

  for (const call of profileCalls) {
    if (call.method === "POST" && !call.body) continue;
    try {
      const result = await callEvoAction(call.url, call.method, call.body);
      if (!result.ok) continue;
      const payload = result.json ?? {};
      profileName =
        profileName ||
        extractOwnerMatchedName(payload, jid, digits) ||
        pickProfileNameFromPayload(payload);
      if (profileName) break;
    } catch {
      // fallback silencioso
    }
  }
  for (const call of pictureCalls) {
    if (call.method === "POST" && !call.body) continue;
    try {
      const result = await callEvoAction(call.url, call.method, call.body);
      if (!result.ok) continue;
      const payload = result.json ?? {};
      profilePicUrl = profilePicUrl || pickProfilePictureFromPayload(payload);
      if (profilePicUrl) break;
    } catch {
      // fallback silencioso
    }
  }

  return { profileName, profilePicUrl };
}

function buildConnectedFromEvoResponse(instances: any[]): Array<{ instancia: string; numero: string }> {
  const list = Array.isArray(instances) ? instances : [instances];
  return list
    .map((item) => {
      const inst = item?.instance ?? item;
      const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
      if (!status.includes("open")) return null;
      const instancia = resolveEvoInstanceKey(inst);
      const numero = extractInstanceNumber(inst);
      if (!instancia || !numero) return null;
      return { instancia, numero };
    })
    .filter((x): x is { instancia: string; numero: string } => x != null);
}

/** Uma linha da EVO para casar snapshot com instância atual. */
type EvoInstanceTagRow = {
  /** Chave técnica da instância (ex.: nome na EVO). */
  instanceKey: string;
  /**
   * Mesmo texto da coluna «Nome da Instância» no front: `instanceLabel = instanceAlias || instanceName`
   * (arquivo `instance-aliases.json` → chave técnica). Não usar perfil WhatsApp aqui.
   */
  displayName: string;
  connected: boolean;
  nameKeys: Set<string>;
  digitKeys: Set<string>;
};

function mapGetInsensitive(m: Map<string, string>, k: string): string {
  const key = String(k || "").trim();
  if (!key) return "";
  return (
    m.get(key)?.trim() ||
    m.get(key.toLowerCase())?.trim() ||
    ""
  );
}

function addComparableNameKey(set: Set<string>, value: unknown) {
  const s = String(value || "").trim().toLowerCase();
  if (s) set.add(s);
}

/** Coluna «Nome da Instância» na UI = `instanceAlias || instanceName` (ver index.html). */
function instanceNomeInstanciaForDisparadorTag(
  instanceKey: string,
  aliasesMap: Map<string, string>
): string {
  const key = String(instanceKey || "").trim();
  if (!key) return "";
  const alias = mapGetInsensitive(aliasesMap, key);
  return (alias || key).trim();
}

function buildEvoInstanceTagRowsFromList(
  instances: any[],
  whatsappMap: Map<string, string>,
  aliasesMap: Map<string, string>
): EvoInstanceTagRow[] {
  const list = Array.isArray(instances) ? instances : [instances];
  const rows: EvoInstanceTagRow[] = [];
  for (const item of list) {
    const inst = item?.instance ?? item;
    const candidateName =
      inst?.instanceName ??
      inst?.name ??
      inst?.id ??
      inst?.instanceId ??
      inst?.instance ??
      null;
    const instanceKey =
      candidateName == null || candidateName === ""
        ? ""
        : String(candidateName).trim();
    if (!instanceKey) continue;
    const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
    const connected = status.includes("open");
    const numRaw = extractInstanceNumber(inst);
    const digitKeys = buildComparableOwnerDigits(normalizeDigits(numRaw));
    const nameKeys = new Set<string>();
    for (const v of [
      instanceKey,
      inst?.name,
      inst?.instanceName,
      inst?.instance,
      inst?.id,
      inst?.instanceId,
    ]) {
      addComparableNameKey(nameKeys, v);
    }
    addComparableNameKey(nameKeys, inst?.profileName);
    const whatsappOverride = mapGetInsensitive(whatsappMap, instanceKey);
    const alias = mapGetInsensitive(aliasesMap, instanceKey);
    if (whatsappOverride) addComparableNameKey(nameKeys, whatsappOverride);
    if (alias) addComparableNameKey(nameKeys, alias);

    const displayName = instanceNomeInstanciaForDisparadorTag(
      instanceKey,
      aliasesMap
    );
    rows.push({ instanceKey, displayName, connected, nameKeys, digitKeys });
  }
  return rows;
}

async function fetchEvoInstanceTagRows(): Promise<EvoInstanceTagRow[]> {
  const [whatsappMap, aliasesMap] = await Promise.all([
    loadWhatsappProfileNamesMap(),
    loadInstanceAliasesMap(),
  ]);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const raw = await response.json();
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.response)
        ? raw.response
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
    return buildEvoInstanceTagRowsFromList(list, whatsappMap, aliasesMap);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function digitKeysFromStoredLabel(storedName: string): Set<string> {
  const out = new Set<string>();
  const raw = String(storedName || "").trim();
  if (!raw) return out;
  for (const run of raw.match(/\d+/g) || []) {
    for (const d of buildComparableOwnerDigits(run)) out.add(d);
  }
  for (const d of buildComparableOwnerDigits(normalizeDigits(raw))) out.add(d);
  return out;
}

function resolveStoredNameToEvoTag(
  storedName: string,
  rows: EvoInstanceTagRow[]
): { displayName: string; connected: boolean } {
  const raw = String(storedName || "").trim();
  const rawLc = raw.toLowerCase();
  if (!raw) return { displayName: "", connected: false };
  if (!rows.length) return { displayName: raw, connected: false };

  for (const r of rows) {
    if (r.nameKeys.has(rawLc)) {
      return { displayName: r.displayName, connected: r.connected };
    }
  }

  const storedDigitKeys = digitKeysFromStoredLabel(raw);
  const digitHits: EvoInstanceTagRow[] = [];
  if (storedDigitKeys.size > 0) {
    for (const r of rows) {
      let hit = false;
      for (const d of storedDigitKeys) {
        if (r.digitKeys.has(d)) {
          hit = true;
          break;
        }
      }
      if (hit) digitHits.push(r);
    }
  }
  if (digitHits.length === 1) {
    const r = digitHits[0];
    return { displayName: r.displayName, connected: r.connected };
  }
  if (digitHits.length > 1) {
    const pick = pickBestDigitHitRow(raw, rawLc, digitHits);
    return { displayName: pick.displayName, connected: pick.connected };
  }

  return { displayName: raw, connected: false };
}

/** Quando várias instâncias compartilham dígitos com o snapshot, prioriza quem «casa» melhor com o texto (ex.: «SOMA - 8927»). */
function pickBestDigitHitRow(
  raw: string,
  rawLc: string,
  digitHits: EvoInstanceTagRow[]
): EvoInstanceTagRow {
  if (digitHits.length <= 1) return digitHits[0];
  const runs = (raw.match(/\d+/g) || []).slice().sort((a, b) => b.length - a.length);
  const longestDigits = runs[0] || "";

  const scored = digitHits.map((r) => {
    let score = 0;
    const disp = r.displayName.toLowerCase();
    const ik = r.instanceKey.toLowerCase();
    if (longestDigits.length >= 4) {
      if (disp.includes(longestDigits)) score += 100;
      if (ik.includes(longestDigits)) score += 70;
    } else if (longestDigits.length > 0) {
      if (disp === longestDigits || ik === longestDigits) score += 40;
    }
    if (rawLc.length >= 3) {
      if (disp.includes(rawLc)) score += 90;
      if (ik.includes(rawLc)) score += 50;
    }
    if (r.connected) score += 3;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  const tier = scored.filter((x) => x.score === top);
  const open = tier.find((x) => x.r.connected);
  return (open ?? tier[0] ?? scored[0]).r;
}

function disparadorInstanceTagsForCampaign(
  config: DisparosConfig | undefined | null,
  evoRows: EvoInstanceTagRow[]
): Array<{ instanceName: string; connected: boolean }> {
  const snap = config || DISPAROS_DEFAULTS;
  const raw = Array.isArray(snap.selectedDisparadorInstances)
    ? snap.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  if (!raw.length) return [];

  const accum = new Map<string, { displayName: string; connected: boolean }>();
  for (const name of raw) {
    const r = resolveStoredNameToEvoTag(name, evoRows);
    const display = r.displayName || name;
    const key = display.toLowerCase();
    const prev = accum.get(key);
    if (prev) {
      accum.set(key, {
        displayName: prev.displayName,
        connected: prev.connected || r.connected,
      });
    } else {
      accum.set(key, { displayName: display, connected: r.connected });
    }
  }

  return Array.from(accum.values())
    .map((v) => ({
      instanceName: v.displayName,
      connected: v.connected,
    }))
    .sort((a, b) =>
      a.instanceName.localeCompare(b.instanceName, "pt-BR", { sensitivity: "base" })
    );
}

function getCampaignInstanceHealth(
  config: DisparosConfig | undefined | null,
  evoRows: EvoInstanceTagRow[]
): CampaignInstanceHealth {
  const tags = disparadorInstanceTagsForCampaign(config, evoRows);
  const selectedCount = tags.length;
  const connectedCount = tags.filter((t) => t.connected === true).length;
  const disconnectedCount = Math.max(0, selectedCount - connectedCount);
  const disconnectedPercent =
    selectedCount > 0 ? Math.round((disconnectedCount / selectedCount) * 100) : 0;
  const shouldPauseByDisconnectedRatio =
    selectedCount > 0 && disconnectedCount / selectedCount >= 0.5;
  return {
    selectedCount,
    connectedCount,
    disconnectedCount,
    disconnectedPercent,
    shouldPauseByDisconnectedRatio,
  };
}

function describeEvoQrFailure(
  createStatus: number,
  qrStatus: number,
  createDetail: string,
  qrDetail: string,
): string {
  const detail = String(qrDetail || createDetail || "").trim();
  if (createStatus === 404 || qrStatus === 404 || /404 page not found/i.test(detail)) {
    return "Evolution API indisponível (404). Verifique EVO_API_URL e se o serviço Evolution está no ar.";
  }
  if (createStatus === 0 || qrStatus === 0) {
    if (/self-signed certificate|DEPTH_ZERO_SELF_SIGNED_CERT/i.test(detail)) {
      return "Evolution API com certificado TLS inválido. Defina EVO_TLS_INSECURE=1 no ambiente de desenvolvimento.";
    }
    if (/timeout/i.test(detail)) {
      return "Evolution API demorou para gerar o QRCode (timeout). Tente «Atualizar QR» ou aumente EVO_HTTP_TIMEOUT_MS no servidor.";
    }
    return `Evolution API sem resposta (${detail || "erro de rede ou timeout"}). Verifique EVO_API_URL e se o serviço Evolution está no ar.`;
  }
  return "Dados salvos, mas falha ao gerar QRCode na EVO.";
}

function summarizeEvolutionErrorDetail(detail: string, status = 0): string {
  const raw = String(detail || "").trim();
  if (!raw) return "";

  let parsed: Record<string, unknown> | null = null;
  if (raw.startsWith("{")) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* mantém texto bruto */
    }
  }

  const response = parsed?.response;
  const nested =
    (response && typeof response === "object"
      ? (response as Record<string, unknown>).message
      : null) ??
    parsed?.message ??
    parsed?.error ??
    raw;

  const text = String(nested).trim();
  if (/integrationSession|prismaRepository/i.test(text)) {
    return "Evolution API com erro interno no banco (Prisma/integrationSession). Reinicie o serviço Evolution no Easypanel e confira o PostgreSQL da EVO.";
  }
  if (status === 500 || /internal server error/i.test(text)) {
    const first =
      text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) || text;
    if (first.length > 220) return `Evolution API erro 500: ${first.slice(0, 200)}…`;
    return `Evolution API erro 500: ${first}`;
  }
  if (text.length > 400) return `${text.slice(0, 380)}…`;
  return text;
}

function describeEvoInstancesFetchError(status: number, detail: string): string {
  const normalized = summarizeEvolutionErrorDetail(detail, status);
  if (status === 404 || /404 page not found/i.test(normalized)) {
    return "Evolution API indisponível (404). Verifique EVO_API_URL / Traefik no VPS ou use Evolution local no .env.v02.";
  }
  if (status === 0 && /self-signed certificate|DEPTH_ZERO_SELF_SIGNED_CERT/i.test(normalized)) {
    return "Evolution API com certificado TLS inválido. Defina EVO_TLS_INSECURE=1 no .env.v02.";
  }
  if (status === 0) {
    return `Evolution API sem resposta (${normalized || "erro de rede ou timeout"}).`;
  }
  return normalized || "Erro ao buscar dados na Evolution API.";
}

async function callEvoAction(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, any>,
  options?: { timeoutMs?: number; retries?: number },
) {
  const result = await evoHttpRequest(url, method, {
    apiKey: EVO_API_KEY,
    body,
    timeoutMs: options?.timeoutMs ?? defaultEvoHttpTimeoutMs(),
    retries: options?.retries ?? 1,
  });
  const mergedBody = result.error
    ? [result.error, result.body].filter(Boolean).join(" | ")
    : result.body;
  return {
    ok: result.ok,
    status: result.status,
    body: mergedBody,
    json: result.json as any,
    error: result.error,
  };
}

function parseEvoInstancesList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response as any[];
    if (Array.isArray(record.data)) return record.data as any[];
  }
  return raw ? [raw] : [];
}

async function fetchEvoInstancesList(): Promise<
  { ok: true; instances: any[] } | { ok: false; status: number; detail: string }
> {
  const result = await callEvoAction(EVO_INSTANCES_URL, "GET", undefined, {
    timeoutMs: 12000,
    retries: 1,
  });
  if (!result.ok) {
    const detail = summarizeEvolutionErrorDetail(
      String(result.body || result.error || "Erro ao buscar instâncias na Evolution API."),
      result.status
    );
    return { ok: false, status: result.status, detail };
  }
  return { ok: true, instances: parseEvoInstancesList(result.json) };
}

const EVO_INSTANCES_CACHE_FILE = resolveDataFile("evo-instances-cache.json");

type EvoInstancesCacheStore = {
  updatedAt: string;
  items: Array<Record<string, unknown>>;
};

async function loadEvoInstancesCache(): Promise<EvoInstancesCacheStore | null> {
  try {
    const raw = await fs.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<EvoInstancesCacheStore>;
    if (!Array.isArray(parsed?.items)) return null;
    return {
      updatedAt: String(parsed.updatedAt || ""),
      items: parsed.items as Array<Record<string, unknown>>,
    };
  } catch {
    return null;
  }
}

async function saveEvoInstancesCache(items: Array<Record<string, unknown>>): Promise<void> {
  try {
    const payload: EvoInstancesCacheStore = {
      updatedAt: new Date().toISOString(),
      items,
    };
    await fs.mkdir(path.dirname(EVO_INSTANCES_CACHE_FILE), { recursive: true });
    await fs.writeFile(EVO_INSTANCES_CACHE_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch {
    /* cache opcional */
  }
}

async function removeInstanceFromEvoCache(instanceName: string): Promise<void> {
  const normalized = String(instanceName || "").trim().toLowerCase();
  if (!normalized) return;
  const cache = await loadEvoInstancesCache();
  if (!cache?.items?.length) return;
  const nextItems = cache.items.filter(
    (row) => String(row?.name || "").trim().toLowerCase() !== normalized,
  );
  if (nextItems.length === cache.items.length) return;
  await saveEvoInstancesCache(nextItems);
}

function canDeleteInstanceLocallyAfterEvoFailure(status: number, body: string): boolean {
  if (status === 0) return true;
  if (status === 404) return true;
  const normalized = String(body || "").toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("não encontr") ||
    normalized.includes("nao encontr")
  );
}

async function buildInstancesSnapshotForAuth(
  auth: ReturnType<typeof resolveWabaRequestAuth>,
): Promise<{
  total: number;
  ativas: number;
  desconectadas: number;
  items: any[];
  fromCache: true;
  cacheUpdatedAt: string;
}> {
  const ownedNames = await wabaInstanceOwnershipService.listOwnedInstanceNames(auth.email);
  const cache = await loadEvoInstancesCache();
  const cacheByName = new Map<string, Record<string, unknown>>();
  for (const row of cache?.items || []) {
    const name = String(row?.name || "").trim();
    if (name) cacheByName.set(name.toLowerCase(), row);
  }

  const aliasesMap = await loadInstanceAliasesMap();
  const whatsappNamesMap = await loadWhatsappProfileNamesMap();

  const items = ownedNames.map((instanceName) => {
    const cached = cacheByName.get(instanceName.toLowerCase());
    if (cached) {
      return {
        ...cached,
        name: instanceName,
        displayName:
          String(cached.displayName || cached.name || instanceName).trim() || instanceName,
        connectionStatus: String(cached.connectionStatus || "unknown"),
      };
    }
    const instanceAlias = aliasesMap.get(instanceName) || "";
    const whatsappNameOverride = whatsappNamesMap.get(instanceName) || "";
    return {
      name: instanceName,
      displayName: whatsappNameOverride || instanceAlias || instanceName,
      whatsappNameOverride,
      instanceAlias,
      connectionStatus: "unknown",
      number: "",
      contacts: 0,
      messages: 0,
      profilePicUrl: "",
      avatarVersion: "",
      createdAt: "",
    };
  });

  const ativas = items.filter((row) =>
    String(row?.connectionStatus || "").toLowerCase().includes("open"),
  ).length;

  return {
    total: items.length,
    ativas,
    desconectadas: items.length - ativas,
    items,
    fromCache: true,
    cacheUpdatedAt: String(cache?.updatedAt || ""),
  };
}

async function buildFallbackInstancesForAuth(
  auth: ReturnType<typeof resolveWabaRequestAuth>,
  evolutionError: string,
): Promise<{
  total: number;
  ativas: number;
  desconectadas: number;
  items: any[];
  degraded: true;
  evolutionError: string;
  cacheUpdatedAt: string;
}> {
  const snapshot = await buildInstancesSnapshotForAuth(auth);
  return {
    ...snapshot,
    degraded: true,
    evolutionError,
  };
}

async function callEvoSendTextWithRetry(
  url: string,
  body: Record<string, any>,
  maxAttempts = 3
) {
  let last: Awaited<ReturnType<typeof callEvoAction>> | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await callEvoAction(url, "POST", body);
    last = result;
    const accepted = result.ok && isEvoSendTextAccepted(result.json, result.body);
    if (accepted) return result;
    if (result.ok && !accepted) {
      last = {
        ...result,
        ok: false,
        body: `${result.body || ""} | EVO retornou HTTP OK, mas corpo indica falha no envio.`.slice(
          0,
          500,
        ),
      };
    }
    const bodyLc = String(last.body || "").toLowerCase();
    const isTransient =
      last.status === 429 ||
      last.status === 500 ||
      last.status === 502 ||
      last.status === 503 ||
      last.status === 504 ||
      bodyLc.includes("connection closed") ||
      bodyLc.includes("timeout");
    if (!isTransient || attempt >= maxAttempts) break;
    const waitMs = Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return (
    last || {
      ok: false,
      status: 0,
      body: "Falha sem retorno da EVO.",
      json: null,
    }
  );
}

function isEvoSendTextAccepted(json: unknown, body: string): boolean {
  const rawBody = String(body || "").trim();
  if (rawBody.toLowerCase().includes('"error"')) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (parsed?.error) return false;
    } catch {
      /* */
    }
  }
  if (!json || typeof json !== "object") return true;
  const root = json as Record<string, unknown>;
  if (root.error) return false;
  const status = String(root.status ?? "").trim().toUpperCase();
  if (status === "ERROR" || status === "FAILED") return false;
  const message = root.message;
  if (message && typeof message === "object") {
    const msgStatus = String((message as Record<string, unknown>).status ?? "")
      .trim()
      .toUpperCase();
    if (msgStatus === "ERROR" || msgStatus === "FAILED") return false;
  }
  return true;
}

function toAquecedorRemoteJid(num: string): string {
  const digits = normalizeWhatsAppNumber(String(num || "").trim());
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function buildAquecedorRemoteJidCandidates(num: string): string[] {
  const digits = normalizeWhatsAppNumber(String(num || "").trim());
  if (!digits) return [];
  const out = new Set<string>();
  out.add(`${digits}@s.whatsapp.net`);
  if (digits.startsWith("55") && digits.length > 11) {
    out.add(`${digits.slice(2)}@s.whatsapp.net`);
  }
  const rawDigits = String(num || "").replace(/\D/g, "");
  if (rawDigits && rawDigits !== digits) {
    out.add(`${rawDigits}@s.whatsapp.net`);
  }
  return Array.from(out);
}

function buildAquecedorDeliveryTag(): string {
  const raw = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return raw.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase().padStart(6, "0");
}

function appendAquecedorDeliveryTag(text: string, tag: string): string {
  const base = String(text || "").trim();
  const token = String(tag || "").trim();
  if (!base) return token;
  if (!token) return base;
  return `${base} ${token}`;
}

function extractAquecedorMessageMarker(text: string): string {
  const value = String(text || "").trim();
  const suffix = value.match(/\b([a-z0-9]{5,8})\s*$/i);
  if (suffix?.[1]) return suffix[1].toLowerCase();
  return value.slice(-24).toLowerCase();
}

function collectEvoChatMessageTexts(node: unknown, out: string[], depth = 0): void {
  if (depth > 10 || node == null) return;
  if (typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvoChatMessageTexts(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.conversation === "string" && obj.conversation.trim()) {
    out.push(obj.conversation.trim());
  }
  const ext = obj.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string" && ext.text.trim()) out.push(ext.text.trim());
  if (typeof obj.text === "string" && obj.text.trim()) out.push(obj.text.trim());
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectEvoChatMessageTexts(value, out, depth + 1);
  }
}

function evoChatTextsIncludeMarker(node: unknown, marker: string): boolean {
  return evoChatTextsIncludeNeedle(node, [marker]);
}

function evoChatTextsIncludeNeedle(node: unknown, needles: string[]): boolean {
  const texts: string[] = [];
  collectEvoChatMessageTexts(node, texts);
  const normalizedNeedles = needles
    .map((needle) => String(needle || "").trim().toLowerCase())
    .filter(Boolean);
  if (!normalizedNeedles.length) return false;
  return texts.some((text) => {
    const lowered = text.toLowerCase();
    return normalizedNeedles.some((needle) => lowered.includes(needle));
  });
}

async function verifyAquecedorMessageDelivered(
  instanciaDestino: string,
  numeroOrigem: string,
  messageText: string,
  maxAttempts = 8,
): Promise<{ ok: boolean; detail: string }> {
  const destino = String(instanciaDestino || "").trim();
  const remoteJids = buildAquecedorRemoteJidCandidates(numeroOrigem);
  if (!destino || !remoteJids.length) {
    return { ok: false, detail: "Parâmetros inválidos para conferir entrega no destinatário." };
  }

  const marker = extractAquecedorMessageMarker(messageText);
  const fullText = String(messageText || "").trim().toLowerCase();
  const needles = new Set<string>();
  if (marker) needles.add(marker);
  if (fullText.length >= 6) needles.add(fullText);
  if (fullText.length >= 12) needles.add(fullText.slice(0, 48));

  const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(destino)}`;

  await sleepMs(2500);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await sleepMs(2500);
    for (const remoteJid of remoteJids) {
      const bodies: Array<Record<string, unknown>> = [
        { where: { key: { remoteJid } }, limit: 50 },
        { where: { key: { remoteJid } }, take: 50 },
        { where: { key: { remoteJid: remoteJid.replace("@s.whatsapp.net", "") } }, limit: 50 },
        { limit: 80 },
        {},
      ];
      for (const body of bodies) {
        const result = await callEvoAction(url, "POST", body, {
          timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 25000),
          retries: 1,
        });
        if (!result.ok) continue;
        if (evoChatTextsIncludeNeedle(result.json, Array.from(needles))) {
          return { ok: true, detail: "" };
        }
      }
    }
  }

  return {
    ok: false,
    detail:
      "EVO aceitou o envio, mas a mensagem não apareceu no WhatsApp do destinatário (conferência findMessages).",
  };
}

async function revertAquecedorPendingAfterFailedSend(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  pendingId: string | number,
): Promise<void> {
  await (supabase.from("aquecedor" as any) as any)
    .update({
      status: "PENDENTE",
      instancia: null,
      numero_destino: null,
      processing_at: null,
      sent_at: null,
    })
    .eq("id", pendingId);
}

const META_GRAPH_BASE = String(process.env.META_GRAPH_BASE || "https://graph.facebook.com").replace(
  /\/+$/,
  ""
);
const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v22.0").trim();

function sanitizeMetaId(value: any): string {
  return String(value || "").trim();
}

async function callMetaGraphApi(input: {
  token: string;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, any>;
  maxAttempts?: number;
}) {
  const token = String(input.token || "").trim();
  if (!token) throw new Error("Token da Meta não informado.");
  const path = String(input.path || "").trim().replace(/^\/+/, "");
  if (!path) throw new Error("Path da API da Meta não informado.");
  const endpoint = `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${path}`;
  const maxAttempts = Math.max(1, Number(input.maxAttempts || 3));

  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (response.ok) {
        return { ok: true, status: response.status, json, body: text, endpoint };
      }
      lastStatus = response.status;
      lastBody = text;
      const transient =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;
      if (!transient || attempt >= maxAttempts) {
        return { ok: false, status: response.status, json, body: text, endpoint };
      }
      const waitMs = Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { ok: false, status: lastStatus, json: null, body: lastBody, endpoint };
}

function metaAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac("sha256", String(appSecret || "")).update(String(accessToken || "")).digest("hex");
}

function buildDisparosAiPrompt(input: {
  briefing?: string;
  tone?: string;
  audience?: string;
  cta?: string;
  objective?: string;
  accessLink?: string;
}) {
  const briefing = String(input.briefing || "").trim();
  const tone = String(input.tone || "consultivo").trim();
  const audience = String(input.audience || "CORBAN").trim();
  const cta = String(input.cta || "Responda no link abaixo").trim();
  const objective = String(input.objective || "gerar mensagem de prospeccao via WhatsApp").trim();
  const accessLink = String(input.accessLink || "").trim();
  return [
    "Voce e um copywriter especialista em vendas consultivas via WhatsApp.",
    `Objetivo: ${objective}.`,
    `Publico alvo: ${audience}.`,
    `Tom: ${tone}.`,
    `CTA obrigatoria: ${cta}.`,
    "Regras:",
    "- Retorne apenas uma mensagem final pronta para envio.",
    "- Mensagem curta (maximo 400 caracteres).",
    "- Nao use markdown, aspas ou explicacoes extras.",
    accessLink ? `- Inclua obrigatoriamente este link na mensagem: ${accessLink}` : "- Quando houver link de acesso, inclua-o na mensagem.",
    briefing ? `Contexto adicional:\n${briefing}` : "Contexto adicional: sem observacoes.",
  ].join("\n");
}

function ensureMessageContainsLink(message: string, link: string, cta: string) {
  const text = String(message || "").trim();
  const safeLink = String(link || "").trim();
  if (!safeLink) return text;
  // Se a IA incluir o link longo do WhatsApp (wa.me), substituímos por shortUrl
  // para que o usuário receba sempre a URL curta e para manter o relatório consistente.
  const waMeRegex = /https?:\/\/wa\.me\/[0-9]+[^\s)"]*/gi;
  const replaced = text.replace(waMeRegex, safeLink);
  if (replaced.includes(safeLink)) return replaced;
  const safeCta = String(cta || "Acesse aqui").trim();
  const joiner = text ? "\n\n" : "";
  return `${replaced}${joiner}${safeCta}: ${safeLink}`.trim();
}

async function generateShortUrlForDisparos(longUrl: string) {
  const baseUrl = String(longUrl || "").trim();
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("accessUrl deve ser uma URL válida (http/https).");
  }
  const providers = getAutoShortenerProviderOrder();
  const maxAttempts = 5;
  let shortUrl = "";
  let sourceUrlUsed = baseUrl;
  let providerUsed: DisparosConfig["shortenerProvider"] | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidateUrl = attempt === 1 ? baseUrl : appendAntiRepeatParam(baseUrl, attempt);
    for (const provider of providers) {
      try {
        const candidateShort = await shortenUrlWithProvider(candidateUrl, provider, "");
        shortUrl = candidateShort;
        sourceUrlUsed = candidateUrl;
        providerUsed = provider;
        break;
      } catch {
        // tenta proximo provider
      }
    }
    if (shortUrl) break;
  }

  if (!shortUrl) {
    throw new Error("Nao foi possivel gerar link curto para a mensagem teste.");
  }
  return {
    shortUrl,
    sourceUrlUsed,
    provider: providerUsed || providers[0],
  };
}

function extractFirstHttpUrl(text: string): string | null {
  const raw = String(text || "");
  const match = raw.match(/https?:\/\/[^\s)]+/i);
  if (!match?.[0]) return null;
  return match[0].trim();
}

function parseEncurtadorProClicks(payload: any): number {
  const asNumber = (value: any): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const direct = asNumber(payload?.clicks);
  if (direct != null) return direct;
  const dataClicks = asNumber(payload?.data?.clicks);
  if (dataClicks != null) return dataClicks;
  const urls = Array.isArray(payload?.data?.urls) ? payload.data.urls : [];
  if (urls.length > 0) {
    const fromList = asNumber(urls[0]?.clicks);
    if (fromList != null) return fromList;
  }
  return 0;
}

async function fetchClicksForShortUrl(shortUrl: string): Promise<number> {
  if (isWabaManagedShortUrl(shortUrl)) {
    const local = await fetchWabaShortUrlClicks(shortUrl);
    if (local != null) return local;
  }
  return fetchClicksForShortUrlFromEncurtadorPro(shortUrl);
}

async function fetchClicksForShortUrlFromEncurtadorPro(shortUrl: string): Promise<number> {
  const safeShort = String(shortUrl || "").trim();
  if (!/^https?:\/\//i.test(safeShort)) return 0;
  const cached = shortUrlClicksCache.get(safeShort);
  const nowMs = Date.now();
  if (cached && nowMs - cached.checkedAtMs < 120_000) {
    return cached.clicks;
  }
  const apiKey = String(process.env.ENCURTADORPRO_API_KEY || "").trim();
  if (!apiKey) return 0;

  const endpoint = `https://app.encurtadorpro.com.br/api/urls?short=${encodeURIComponent(safeShort)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || Number(data?.error || 0) !== 0) {
      return 0;
    }
    const clicks = parseEncurtadorProClicks(data);
    shortUrlClicksCache.set(safeShort, { clicks, checkedAtMs: nowMs });
    return clicks;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractOpenAiText(payload: any): string {
  const direct = String(payload?.output_text || "").trim();
  if (direct) return direct;
  const out = Array.isArray(payload?.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const text = String(part?.text || part?.output_text || "").trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAiGenerateMessage(input: {
  prompt: string;
  model?: string;
  maxOutputTokens?: number;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada no servidor.");
  }
  const safePrompt = String(input.prompt || "").trim();
  if (!safePrompt) {
    throw new Error("Prompt vazio para geração de mensagem.");
  }

  let lastError = "Falha ao gerar mensagem com OpenAI.";
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const startedAt = Date.now();
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: String(input.model || OPENAI_MODEL || "gpt-5-nano"),
          input: safePrompt,
          store: false,
          max_output_tokens: Number(input.maxOutputTokens || 220),
        }),
      });
      const bodyText = await response.text();
      let json: any = null;
      try {
        json = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        json = null;
      }

      if (response.ok) {
        const text = extractOpenAiText(json);
        if (!text) throw new Error("OpenAI retornou resposta sem texto.");
        return {
          ok: true,
          text,
          model: String(json?.model || input.model || OPENAI_MODEL),
          latencyMs: Date.now() - startedAt,
        };
      }

      const isTransient = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
      const safeErr = String(json?.error?.message || "").slice(0, 240);
      lastError = `OpenAI HTTP ${response.status}${safeErr ? `: ${safeErr}` : ""}`;
      if (!isTransient || attempt >= maxAttempts) break;
      const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
      await new Promise((r) => setTimeout(r, sleepMs));
    } catch (error: any) {
      const message = String(error?.message || "Erro de rede/timeout ao chamar OpenAI.");
      lastError = message;
      if (attempt >= maxAttempts) break;
      const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
      await new Promise((r) => setTimeout(r, sleepMs));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(lastError);
}

async function shortenUrlWithProvider(
  longUrl: string,
  provider: DisparosConfig["shortenerProvider"],
  customDomain = ""
) {
  const safeLongUrl = String(longUrl || "").trim();
  if (!safeLongUrl) {
    throw new Error("URL original é obrigatória.");
  }
  if (provider === "waba") {
    try {
      return await createWabaShortUrl(safeLongUrl, { tenantId: "disparador" });
    } catch (error: any) {
      throw new Error(String(error?.message || "Falha no encurtador WABA."));
    }
  }
  if (provider === "encurtadorpro") {
    const apiKey = String(process.env.ENCURTADORPRO_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("ENCURTADORPRO_API_KEY não configurada.");
    }
    const payload: Record<string, any> = {
      url: safeLongUrl,
      status: "private",
    };
    const customAliasEnv = String(process.env.ENCURTADORPRO_CUSTOM_ALIAS || "").trim();
    if (customAliasEnv) {
      payload.custom = customAliasEnv;
    } else {
      // EncurtadorPro pode deduplicar pelo "longUrl" ignorando query/tracking.
      // Para isolar cliques, usamos um alias derivado do nonce inserido no longUrl.
      const nonceMatch = safeLongUrl.match(/_n8n_link_nonce=([^&]+)/i);
      const rawNonce = String(nonceMatch?.[1] || "").trim();
      const clean = rawNonce.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (clean) {
        // Alias curto para melhor UX no texto final, mantendo chance baixa de colisão.
        payload.custom = `n${clean.slice(-7)}`;
      }
    }
    const preferredDomain = String(customDomain || process.env.ENCURTADORPRO_DOMAIN || "").trim();
    if (preferredDomain) payload.domain = preferredDomain;

    const maxAttempts = 3;
    let lastErrorMessage = "Falha no encurtador EncurtadorPro.";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("https://app.encurtadorpro.com.br/api/url/add", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        const short = String(data?.shorturl || data?.short || "").trim();
        const responseError = Number(data?.error || 0);
        if (response.ok && responseError === 0 && /^https?:\/\//i.test(short)) {
          return short;
        }
        const message = String(data?.message || "").slice(0, 200);
        lastErrorMessage = `EncurtadorPro HTTP ${response.status}${message ? `: ${message}` : ""}`;
        const isTransient =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;
        if (!isTransient || attempt >= maxAttempts) break;
      } catch (error: any) {
        const message = String(error?.message || "Erro de rede ao chamar EncurtadorPro.");
        lastErrorMessage = message;
        if (attempt >= maxAttempts) break;
      } finally {
        clearTimeout(timeoutId);
      }
      const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
      await new Promise((r) => setTimeout(r, sleepMs));
    }
    throw new Error(lastErrorMessage);
  }

  throw new Error("Provedor de encurtador não suportado.");
}

function appendAntiRepeatParam(rawUrl: string, attempt: number) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set("_n8n_link_nonce", `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${attempt}`);
    return u.toString();
  } catch {
    // fallback em caso de URL não parseável pelo construtor URL
    const sep = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${sep}_n8n_link_nonce=${Date.now()}-${attempt}`;
  }
}

function tryExtractQrCode(payload: any): string | null {
  const normalizeCandidate = (value: any): string | null => {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith("data:image")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.length >= 100) return raw;
    return null;
  };

  const visit = (node: any, depth = 0): string | null => {
    if (depth > 6 || node == null) return null;

    const normalizedDirect = normalizeCandidate(node);
    if (normalizedDirect) return normalizedDirect;

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (typeof node !== "object") return null;

    const priorityKeys = [
      "qrcode",
      "qrCode",
      "qr",
      "base64",
      "code",
      "pairingCode",
      "pairingcode",
      "data",
    ];

    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = visit((node as Record<string, any>)[key], depth + 1);
        if (found) return found;
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (!/(qr|qrcode|base64|code|pairing)/i.test(key)) continue;
      const found = visit(value, depth + 1);
      if (found) return found;
    }

    return null;
  };

  return visit(payload);
}

async function fetchInstanceQrCodeFromEvo(
  instanceName: string,
  number = "",
): Promise<
  | { ok: true; qrCode: string; providerResponse: unknown }
  | { ok: false; lastQrStatus: number; lastQrDetail: string }
> {
  const connectCandidates: Array<{ url: string; method: "GET" | "POST" }> = [
    { url: buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName), method: "GET" as const },
    { url: `${EVO_API_BASE}/instance/connect/${encodeURIComponent(instanceName)}`, method: "GET" as const },
    { url: `${EVO_API_BASE}/instance/qrcode/${encodeURIComponent(instanceName)}`, method: "GET" as const },
    { url: `${EVO_API_BASE}/instance/qr/${encodeURIComponent(instanceName)}`, method: "GET" as const },
    { url: `${EVO_API_BASE}/instance/connect/${encodeURIComponent(instanceName)}`, method: "POST" as const },
  ].filter((candidate) => candidate.url);

  let lastQrStatus = 0;
  let lastQrDetail = "";

  for (const candidate of connectCandidates) {
    const targetUrl = number
      ? `${candidate.url}${candidate.url.includes("?") ? "&" : "?"}number=${encodeURIComponent(number)}`
      : candidate.url;

    const result = await callEvoAction(targetUrl, candidate.method, undefined, {
      timeoutMs: defaultEvoHttpTimeoutMs(),
      retries: 3,
    });
    lastQrStatus = result.status;
    lastQrDetail = String(result.body || result.error || "").slice(0, 400);

    if (!result.ok) continue;

    const qrCode = tryExtractQrCode(result.json) || tryExtractQrCode(result.body);
    if (qrCode) {
      return { ok: true, qrCode, providerResponse: result.json ?? null };
    }
  }

  return { ok: false, lastQrStatus, lastQrDetail };
}

app.post("/instancias/:name/atualizar", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const url = buildTemplateUrl(EVO_REFRESH_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação atualizar não configurada. Defina EVO_REFRESH_URL_TEMPLATE no backend.",
      });
    }

    const result = await callEvoAction(url, "POST");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao executar atualização da instância na EVO.",
        status: result.status,
      });
    }
    return res.json({ ok: true, message: "Atualização solicitada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar instância:", error);
    return res.status(500).json({ error: "Erro ao atualizar instância." });
  }
});

app.post("/instancias/:name/qrcode", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const url = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação QRCode não configurada. Defina EVO_QRCODE_URL_TEMPLATE no backend.",
      });
    }

    const number = typeof req.query.number === "string" ? req.query.number.trim() : "";

    const qrFetch = await fetchInstanceQrCodeFromEvo(instanceName, number);
    if (!qrFetch.ok) {
      return res.status(502).json({
        error: describeEvoQrFailure(0, qrFetch.lastQrStatus, "", qrFetch.lastQrDetail),
        evoQrStatus: qrFetch.lastQrStatus,
        detail: qrFetch.lastQrDetail,
      });
    }
    return res.json({
      ok: true,
      message: "QRCode solicitado com sucesso.",
      qrCode: qrFetch.qrCode,
      providerResponse: qrFetch.providerResponse,
    });
  } catch (error) {
    console.error("Erro ao solicitar QRCode:", error);
    return res.status(500).json({ error: "Erro ao solicitar QRCode." });
  }
});

app.post("/instancias/registrar-qrcode", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const name = String(req.body?.name || "").trim();
    const rawToken = String(req.body?.token || "").trim();
    const number = String(req.body?.number || "").trim();
    const token =
      rawToken ||
      crypto
        .randomUUID()
        .replace(/-/g, "")
        .toUpperCase()
        .replace(/(.{12})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

    if (!name) {
      return res.status(400).json({ error: "Campo 'name' é obrigatório." });
    }

    if (isWabaAuthConfigured()) {
      const ownerEmail = String(auth.email || "").trim().toLowerCase();
      if (!ownerEmail.includes("@")) {
        return res.status(401).json({ error: "Faça login para registrar uma instância." });
      }
      const reserve = await wabaInstanceOwnershipService.claimOnRegister(name, ownerEmail);
      if (!reserve.ok) {
        return res.status(409).json({ error: reserve.error });
      }
      void ensureAquecedorInstanceRegistered(name);
    }

    // Regra de segurança operacional:
    // não permitir criar instância com nome já usado por outra instância ativa/conectada.
    // Instâncias desconectadas são desconsideradas nesse comparativo.
    try {
      const checkResult = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
        apiKey: EVO_API_KEY,
        timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 15000),
        retries: 2,
      });

      if (checkResult.ok) {
        const rawInstances: any = checkResult.json ?? checkResult.body;
        const parsed =
          typeof rawInstances === "string"
            ? (() => {
                try {
                  return JSON.parse(rawInstances);
                } catch {
                  return [];
                }
              })()
            : rawInstances;
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.response)
            ? parsed.response
            : Array.isArray(parsed?.data)
              ? parsed.data
              : [];

        const alreadyActive = list.some((item: any) => {
          const inst = item?.instance ?? item;
          const existingName = String(
            inst?.name ?? inst?.instanceName ?? inst?.instance ?? ""
          ).trim();
          const status = String(inst?.connectionStatus ?? inst?.status ?? "")
            .toLowerCase()
            .trim();
          return existingName.toLowerCase() === name.toLowerCase() && status.includes("open");
        });

        if (alreadyActive) {
          return res.status(409).json({
            error:
              "Já existe uma instância ativa/conectada com este nome. Use outro nome para registrar.",
          });
        }
      }
    } catch {
      // Se a verificação falhar por indisponibilidade externa, não bloqueamos o fluxo.
    }

    // Payload aceito pela Evolution API v2 (sem channel/number vazio — causam HTTP 400).
    const createPayload: Record<string, unknown> = {
      instanceName: name,
      name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };
    if (number) {
      createPayload.number = number;
    }

    // Fallbacks para versões diferentes da Evolution API
    const createUrls = [
      EVO_CREATE_INSTANCE_URL,
      `${EVO_API_BASE}/instance/create`,
      `${EVO_API_BASE}/instance/create/${encodeURIComponent(name)}`,
    ].filter(Boolean);

    let createOk = false;
    let lastCreateStatus = 0;
    let lastCreateDetail = "";
    let qrFromCreate: string | null = null;
    for (const createUrl of createUrls) {
      const createResult = await callEvoAction(createUrl, "POST", createPayload, {
        timeoutMs: defaultEvoHttpTimeoutMs(),
        retries: 3,
      });
      lastCreateStatus = createResult.status;
      lastCreateDetail = String(createResult.body || createResult.error || "").slice(0, 400);
      if (createResult.ok || createResult.status === 409) {
        // 409 pode ocorrer quando instância já existe; seguimos para QRCode
        createOk = true;
        qrFromCreate =
          tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
        if (qrFromCreate) break;
        break;
      }
    }

    let createWarning: string | null = null;
    if (!createOk) {
      createWarning = `Não foi possível salvar/atualizar a instância (status ${lastCreateStatus}). Tentando gerar QRCode da instância existente.`;
    }

    if (qrFromCreate) {
      const claim = await wabaInstanceOwnershipService.claimOnRegister(name, auth.email);
      if (!claim.ok) {
        return res.status(409).json({ error: claim.error });
      }
      void ensureAquecedorInstanceRegistered(name);
      return res.json({
        ok: true,
        message: createWarning
          ? "QRCode gerado com sucesso para a instância existente."
          : "Dados salvos e QRCode gerado com sucesso.",
        warning: createWarning,
        qrCode: qrFromCreate,
      });
    }

    const qrFetch = await fetchInstanceQrCodeFromEvo(name, number);
    if (!qrFetch.ok) {
      return res.status(502).json({
        error: describeEvoQrFailure(lastCreateStatus, qrFetch.lastQrStatus, lastCreateDetail, qrFetch.lastQrDetail),
        evoCreateStatus: lastCreateStatus,
        evoQrStatus: qrFetch.lastQrStatus,
        detail: qrFetch.lastQrDetail || lastCreateDetail,
      });
    }

    const claim = await wabaInstanceOwnershipService.claimOnRegister(name, auth.email);
    if (!claim.ok) {
      return res.status(409).json({ error: claim.error });
    }
    void ensureAquecedorInstanceRegistered(name);
    return res.json({
      ok: true,
      message: createWarning
        ? "QRCode gerado com sucesso para a instância existente."
        : "Dados salvos e QRCode gerado com sucesso.",
      warning: createWarning,
      qrCode: qrFetch.qrCode,
      providerResponse: qrFetch.providerResponse,
    });
  } catch (error) {
    console.error("Erro ao registrar instância e gerar QRCode:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Erro ao gerar QRCode da instância.",
      detail,
    });
  }
});

app.delete("/instancias/:name", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const url = buildTemplateUrl(EVO_DELETE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação deletar não configurada. Defina EVO_DELETE_URL_TEMPLATE no backend.",
      });
    }

    const result = await callEvoAction(url, "DELETE", undefined, {
      timeoutMs: 12000,
      retries: 1,
    });

    const evoDeleted = result.ok;
    const evoSoftDelete = !evoDeleted && canDeleteInstanceLocallyAfterEvoFailure(
      result.status,
      String(result.body || result.error || ""),
    );

    if (!evoDeleted && !evoSoftDelete) {
      return res.status(502).json({
        error: "Falha ao deletar instância na Evolution API.",
        status: result.status,
        detail: summarizeEvolutionErrorDetail(
          String(result.body || result.error || ""),
          result.status,
        ),
      });
    }

    await wabaInstanceOwnershipService.removeOwner(instanceName);
    await removeInstanceFromEvoCache(instanceName);

    const message = evoDeleted
      ? "Instância deletada com sucesso."
      : result.status === 404
        ? "Instância removida do painel (não encontrada na Evolution)."
        : "Instância removida do painel. A Evolution está offline — remova na EVO quando voltar, se ainda existir.";

    return res.json({
      ok: true,
      message,
      degraded: !evoDeleted,
    });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    return res.status(500).json({ error: "Erro ao deletar instância." });
  }
});

app.post("/instancias/:name/renomear", async (req, res) => {
  try {
    const oldName = String(req.params.name || "").trim();
    const newName = String(req.body?.newName || "").trim();
    if (!oldName || !newName) {
      return res.status(400).json({ error: "Nome atual e novo nome são obrigatórios." });
    }
    if (oldName === newName) {
      return res.status(400).json({ error: "O novo nome deve ser diferente do nome atual." });
    }
    if (await rejectForeignInstance(req, res, oldName)) return;

    // Regra operacional: não permitir colisão com instância ativa/conectada.
    try {
      const checkController = new AbortController();
      const checkTimeout = setTimeout(() => checkController.abort(), 8000);
      const checkResponse = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: checkController.signal,
      }).finally(() => clearTimeout(checkTimeout));
      if (checkResponse.ok) {
        const rawInstances: any = await checkResponse.json().catch(() => []);
        const list = Array.isArray(rawInstances)
          ? rawInstances
          : Array.isArray(rawInstances?.response)
            ? rawInstances.response
            : Array.isArray(rawInstances?.data)
              ? rawInstances.data
              : [];
        const conflict = list.some((item: any) => {
          const inst = item?.instance ?? item;
          const existingName = String(
            inst?.name ?? inst?.instanceName ?? inst?.instance ?? ""
          ).trim();
          const status = String(inst?.connectionStatus ?? inst?.status ?? "")
            .toLowerCase()
            .trim();
          return (
            existingName &&
            existingName.toLowerCase() === newName.toLowerCase() &&
            status.includes("open") &&
            existingName.toLowerCase() !== oldName.toLowerCase()
          );
        });
        if (conflict) {
          return res.status(409).json({
            error:
              "Já existe uma instância ativa/conectada com este nome. Informe outro nome.",
          });
        }
      }
    } catch {
      // Se a verificação externa falhar, não bloqueamos a ação.
    }

    const candidateCalls: Array<{ url: string; method: "POST" | "PUT"; body: Record<string, any> }> =
      [
        {
          url: buildTemplateUrl(EVO_RENAME_URL_TEMPLATE, oldName),
          method: "POST" as const,
          body: { newName, name: newName, instanceName: newName },
        },
        {
          url: `${EVO_API_BASE}/instance/rename`,
          method: "POST" as const,
          body: { instanceName: oldName, newName },
        },
        {
          url: `${EVO_API_BASE}/instance/update/${encodeURIComponent(oldName)}`,
          method: "PUT" as const,
          body: { name: newName, instanceName: newName, newName },
        },
      ].filter((c) => Boolean(c.url));

    let lastStatus = 0;
    for (const candidate of candidateCalls) {
      const result = await callEvoAction(candidate.url, candidate.method, candidate.body);
      lastStatus = result.status;
      if (result.ok) {
        await wabaInstanceOwnershipService.renameInstance(oldName, newName);
        return res.json({ ok: true, message: "Nome da instância alterado com sucesso." });
      }
    }

    return res.status(502).json({
      error: "Não foi possível renomear a instância na EVO.",
      status: lastStatus,
    });
  } catch (error) {
    console.error("Erro ao renomear instância:", error);
    return res.status(500).json({ error: "Erro ao renomear instância." });
  }
});

app.get("/aquecedor/config", async (_req, res) => {
  try {
    const { record, storageSource } = await loadAquecedorConfigRecord();
    const useRecommended = record.useRecommended !== false;
    const customConfig = record.customConfig;
    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
      updatedAt: record.updatedAt,
      storageSource,
    });
  } catch (error) {
    console.error("Erro inesperado ao buscar configuração do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao buscar configuração do aquecedor." });
  }
});

app.post("/aquecedor/config", async (req, res) => {
  try {
    const useRecommended = req.body?.useRecommended !== false;
    const customConfig = parseAquecedorConfig(req.body?.customConfig || AQUECEDOR_DEFAULTS);
    const storageSource = await saveAquecedorConfigRecord(useRecommended, customConfig);
    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      ok: true,
      message:
        storageSource === "local"
          ? "Configuração salva localmente (Supabase indisponível)."
          : "Configuração do aquecedor salva com sucesso.",
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
      storageSource,
    });
  } catch (error: any) {
    const message = error?.message || "Erro ao validar configuração do aquecedor.";
    return res.status(400).json({ error: message });
  }
});

app.get("/aquecedor/status", async (_req, res) => {
  try {
    await reloadAquecedorPersistedBundleFromDisk();
    applyPersistedSnapshotToLocal(aquecedorPersistedBundle.snapshot);
    return res.json(buildAquecedorStatusPayload());
  } catch (error) {
    console.error("[Aquecedor] erro em GET /aquecedor/status:", error);
    return res.json({
      ...buildAquecedorStatusPayload(),
      statusReadError: true,
      statusReadMessage: "Falha ao ler estado persistido; exibindo último snapshot conhecido.",
    });
  }
});

app.get("/aquecedor/envios", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = auth.email?.trim().toLowerCase() || "";
    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 50;

    const items: Array<{
      instanciaOrigem: string;
      instanciaDestino: string;
      dataEnvio: string | null;
      dataEnvioBr: string;
      status: "Em Fila" | "Envio com Sucesso";
    }> = [];
    const aliasesMap = await loadInstanceAliasesMap();
    const withAlias = (instanceName: string) => {
      const key = String(instanceName || "").trim();
      if (!key) return "—";
      return aliasesMap.get(key) || key;
    };
    const allowed = await resolveAquecedorEnviosAllowedInstances(ownerEmail);

    const pushItem = (
      instanciaOrigem: string,
      instanciaDestino: string,
      dataEnvio: string | null,
      status: "Em Fila" | "Envio com Sucesso"
    ) => {
      if (!aquecedorEnvioMatchesOwner(instanciaOrigem, instanciaDestino, allowed)) return;
      items.push({
        instanciaOrigem: withAlias(instanciaOrigem),
        instanciaDestino: withAlias(instanciaDestino),
        dataEnvio,
        dataEnvioBr: formatDateBr(dataEnvio),
        status,
      });
    };

    const supabase = getSupabaseClient();
    const localRows = await readAquecedorEnviosLog();
    for (const row of localRows) {
      if (ownerEmail && row.ownerEmail && row.ownerEmail !== ownerEmail) continue;
      // Com Supabase, envios concluídos vêm só de logs_envios (evita linha duplicada no painel).
      if (supabase && row.status === "Envio com Sucesso") continue;
      pushItem(row.instanciaOrigem, row.instanciaDestino, row.dataEnvio, row.status);
    }

    let pendingCount = 0;
    if (supabase) {
      const numToInst = await buildControleInstanciaNumToNameMap(supabase);

      const { data: processandoData } = await (supabase
        .from("aquecedor" as any)
        .select("instancia, numero_destino, scheduled_at, processing_at")
        .eq("status", "PROCESSANDO")
        .order("processing_at", { ascending: false })
        .limit(5)) as any;

      if (Array.isArray(processandoData) && processandoData.length > 0) {
        for (const row of processandoData) {
          const origem = String(row?.instancia || "").trim() || "—";
          const numDest = normalizeWhatsAppNumber(String(row?.numero_destino || "").trim());
          const destino = numToInst.get(numDest) || String(row?.numero_destino || "").trim() || "—";
          const dataEnvio = String(row?.scheduled_at || row?.processing_at || "").trim() || null;
          pushItem(origem, destino, dataEnvio, "Em Fila");
        }
      }

      const { count: pendingTotal } = (await (supabase
        .from("aquecedor" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDENTE"))) as { count: number | null };
      pendingCount = typeof pendingTotal === "number" ? pendingTotal : 0;

      const { data: pendingData } = await (supabase
        .from("aquecedor" as any)
        .select("scheduled_at, instancia, numero_destino")
        .eq("status", "PENDENTE")
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle()) as any;

      if (pendingData) {
        let origem = String(pendingData?.instancia || "").trim();
        let destino = "—";
        const dataEnvio = String(pendingData?.scheduled_at || "").trim() || null;
        const numDest = normalizeWhatsAppNumber(String(pendingData?.numero_destino || "").trim());
        if (numDest) {
          destino = numToInst.get(numDest) || "—";
        }
        if (!origem || destino === "—") {
          const connected = await buildAquecedorConnectedFromControleInstancia(supabase, ownerEmail);
          if (connected.length >= 2) {
            const combinations = connected.flatMap((origemItem) =>
              connected
                .filter((destinoItem) => destinoItem.instancia !== origemItem.instancia)
                .map((destinoItem) => ({
                  instancia_origem: origemItem.instancia,
                  instancia_destino: destinoItem.instancia,
                  numero_whatsapp: destinoItem.numero,
                })),
            );
            const { data: cicloData } = await (supabase
              .from("controle_ciclo" as any)
              .select("ciclo_global")
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle()) as any;
            const cicloGlobal =
              typeof cicloData?.ciclo_global === "number"
                ? Math.floor(cicloData.ciclo_global)
                : 0;
            const picked = await pickAquecedorCombinationAsync(
              supabase,
              connected,
              combinations,
              cicloGlobal,
            );
            if (picked) {
              origem = picked.chosen.instancia_origem;
              destino = picked.chosen.instancia_destino;
            }
          }
        }
        pushItem(origem || "—", destino, dataEnvio, "Em Fila");
      }

      const { data: logsData, error } = await (supabase
        .from("logs_envios_br" as any)
        .select("instancia_origem, instancia_destino, data_envio_br")
        .order("data_envio_br", { ascending: false })
        .limit(limit)) as any;

      if (!error && Array.isArray(logsData)) {
        for (const row of logsData) {
          const dataEnvio =
            String(row?.data_envio_br || row?.data_envio || "").trim() || null;
          pushItem(
            String(row?.instancia_origem || "").trim() || "—",
            String(row?.instancia_destino || "").trim() || "—",
            dataEnvio,
            "Envio com Sucesso"
          );
        }
      }
    }

    const dedup = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const key = buildAquecedorEnvioDedupKey(item);
      if (!dedup.has(key)) dedup.set(key, item);
    }
    const merged = Array.from(dedup.values());
    merged.sort((a, b) => {
      const tsA = parseWabaInstant(a.dataEnvio)?.getTime() ?? 0;
      const tsB = parseWabaInstant(b.dataEnvio)?.getTime() ?? 0;
      return tsB - tsA;
    });

    const sliced = merged.slice(0, limit);
    let hint = "";
    if (!sliced.length && aquecedorRuntime.running) {
      hint =
        pendingCount > 0
          ? "Motor ativo com mensagens na fila. O próximo envio aparecerá aqui."
          : "Motor ativo, mas sem mensagens na fila. Aguarde o próximo ciclo ou reinicie o aquecedor.";
    }

    return res.json({
      items: sliced,
      motorRunning: aquecedorRuntime.running,
      pendingCount,
      ownerEmail: ownerEmail || null,
      hint,
    });
  } catch (error) {
    console.error("Erro inesperado ao listar envios do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao listar envios do aquecedor." });
  }
});

app.post("/aquecedor/start", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  if (!ENABLE_AQUECEDOR_PROCESSING) {
    return res.status(409).json({
      ok: false,
      message:
        "Aquecedor desativado neste processo. Defina ENABLE_AQUECEDOR_PROCESSING=true ou use o runtime de produção.",
      status: aquecedorRuntime,
      runtime: {
        mode: RUNTIME_MODE,
        backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
        aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
      },
    });
  }
  const auth = resolveWabaRequestAuth(req);
  aquecedorRuntimeOwnerEmail = auth.email?.trim().toLowerCase() || null;
  if (!aquecedorRuntimeOwnerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
  }
  startAquecedorRuntimeLocal();
  void ensureAquecedorPendingMessage();
  await persistAquecedorRuntimeIntent(true, aquecedorRuntimeOwnerEmail);
  await reloadAquecedorPersistedBundleFromDisk();
  return res.json({
    ok: true,
    message: "Aquecedor iniciado.",
    status: {
      ...aquecedorPersistedBundle.snapshot,
      running: true,
      desiredRunning: true,
    },
    desiredRunning: true,
  });
});

app.post("/aquecedor/stop", async (_req, res) => {
  stopAquecedorRuntime();
  aquecedorRuntime.lastResult = "Aquecedor parado.";
  await persistAquecedorRuntimeIntent(false, null);
  await reloadAquecedorPersistedBundleFromDisk();
  return res.json({
    ok: true,
    message: "Aquecedor parado.",
    status: {
      ...aquecedorPersistedBundle.snapshot,
      running: false,
      desiredRunning: false,
      isProcessing: false,
      lastResult: "Aquecedor parado.",
    },
    desiredRunning: false,
  });
});

app.post("/aquecedor/run-once", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  const auth = resolveWabaRequestAuth(req);
  aquecedorRuntimeOwnerEmail = auth.email?.trim().toLowerCase() || null;
  if (!aquecedorRuntimeOwnerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
  }
  await runAquecedorCycle(true); // bypass janela e cooldown para teste
  stopAquecedorRuntime(); // execução única: para o motor ao finalizar
  void persistAquecedorRuntimeIntent(false, null);
  return res.json({ ok: true, message: "Ciclo executado.", status: aquecedorRuntime });
});

app.post("/aquecedor/criar-mensagem-teste", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    aquecedorRuntimeOwnerEmail = auth.email?.trim().toLowerCase() || null;
    if (!aquecedorRuntimeOwnerEmail) {
      return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor.",
      });
    }
    const mensagem = String(req.body?.mensagem ?? "").trim() || "Mensagem de teste do aquecedor.";
    const scheduledAt = new Date().toISOString();
    const { data, error } = await (supabase.from("aquecedor" as any) as any)
      .insert({
        mensagem,
        status: "PENDENTE",
        scheduled_at: scheduledAt,
      })
      .select("id, scheduled_at")
      .single();
    if (error) {
      console.error("Erro ao criar mensagem de teste:", error);
      return res.status(500).json({ error: "Erro ao criar mensagem de teste." });
    }
    const dataEnvio = data?.scheduled_at || scheduledAt;
    const item = {
      instanciaOrigem: "—",
      instanciaDestino: "—",
      dataEnvio,
      dataEnvioBr: formatDateBr(dataEnvio),
      status: "Em Fila" as const,
    };
    await runAquecedorCycle(true); // executa um ciclo para processar a mensagem criada
    stopAquecedorRuntime(); // execução única: para o motor ao finalizar
    void persistAquecedorRuntimeIntent(false, null);
    return res.json({
      ok: true,
      message: "Mensagem de teste criada e ciclo executado.",
      id: data?.id,
      item,
      status: aquecedorRuntime,
    });
  } catch (error) {
    console.error("Erro ao criar mensagem de teste:", error);
    return res.status(500).json({ error: "Erro ao criar mensagem de teste." });
  }
});

app.get("/aquecedor/fila-localizar", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase não configurado." });
    }
    const now = new Date().toISOString();
    const { data: pendentes } = await (supabase
      .from("aquecedor" as any)
      .select("id, status, scheduled_at, instancia, numero_destino")
      .eq("status", "PENDENTE")
      .order("scheduled_at", { ascending: true })
      .limit(10)) as any;
    const { data: processando } = await (supabase
      .from("aquecedor" as any)
      .select("id, status, scheduled_at, processing_at, instancia, numero_destino")
      .eq("status", "PROCESSANDO")
      .order("processing_at", { ascending: false })
      .limit(10)) as any;
    const processandoComMinutos = (processando || []).map((r: any) => {
      const pt = r?.processing_at ? new Date(r.processing_at).getTime() : 0;
      const minutos = pt ? Math.floor((Date.now() - pt) / 60000) : 0;
      return { ...r, minutosEmProcessando: minutos };
    });
    return res.json({
      pendenteCount: (pendentes || []).length,
      processandoCount: (processando || []).length,
      pendentes: pendentes || [],
      processando: processandoComMinutos,
      motorRodando: aquecedorRuntime.running,
      proximoPermitido: aquecedorRuntime.nextAllowedAt,
      ultimoResultado: aquecedorRuntime.lastResult,
      lastEvoError: aquecedorRuntime.lastEvoError,
    });
  } catch (error) {
    console.error("Erro ao localizar fila:", error);
    return res.status(500).json({ error: "Erro ao localizar fila." });
  }
});

app.get("/aquecedor/diagnostico", async (req, res) => {
  await reloadAquecedorPersistedBundleFromDisk();
  const persistedStatus = buildAquecedorStatusPayload();
  const diag: Record<string, any> = {
    runtime: {
      ...aquecedorRuntime,
      ...persistedStatus,
      localRunning: aquecedorRuntime.running,
      persistedRunning: persistedStatus.running,
    },
    evo: { ok: false, connectedCount: 0, instances: [] as string[] },
    supabase: { ok: false, pendingCount: 0, messageBankCount: 0 },
    janela: { aberta: false, motivo: "" },
    proximaCombinacao: null as { origem: string; destino: string } | null,
    cicloGlobal: null as number | null,
  };

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    if (response.ok) {
      const instances: any[] = (await response.json().catch(() => [])) || [];
      const connectedAll = await filterConnectedInstanciasForRequest(
        req,
        buildConnectedFromEvoResponse(instances)
      );
      const usageMap = await loadInstanceUsageMap();
      const connected = connectedAll.filter((item) => {
        const usage = getInstanceUsageFromMap(usageMap, item.instancia);
        return usage ? usage.useAquecedor !== false : true;
      });
      diag.evo.ok = true;
      diag.evo.connectedCount = connected.length;
      diag.evo.instances = connected.map((c) => c.instancia);
      if (connected.length >= 2) {
        const combinations: Array<{
          origem: string;
          destino: string;
          numero_whatsapp: string;
        }> = [];
        for (const origem of connected) {
          for (const destino of connected) {
            if (origem.instancia === destino.instancia) continue;
            combinations.push({
              origem: origem.instancia,
              destino: destino.instancia,
              numero_whatsapp: destino.numero,
            });
          }
        }
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { count } = await (supabase
              .from("aquecedor" as any)
              .select("id", { count: "exact", head: true })
              .eq("status", "PENDENTE")
              .lte("scheduled_at", new Date().toISOString())) as any;
            diag.supabase.ok = true;
            diag.supabase.pendingCount = typeof count === "number" ? count : 0;
            const messageBank = await loadAquecedorMessageBank(supabase);
            diag.supabase.messageBankCount = messageBank.length;
            const { data: cicloData } = await (supabase
              .from("controle_ciclo" as any)
              .select("ciclo_global")
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle()) as any;
            const cicloGlobal =
              typeof cicloData?.ciclo_global === "number"
                ? Math.floor(cicloData.ciclo_global)
                : 0;
            diag.cicloGlobal = cicloGlobal;
            if (combinations.length) {
              const comboRows = combinations.map((combo) => ({
                instancia_origem: combo.origem,
                instancia_destino: combo.destino,
                numero_whatsapp: combo.numero_whatsapp,
              }));
              const picked = await withAquecedorTimeout(
                pickAquecedorCombinationAsync(supabase, connected, comboRows, cicloGlobal),
                4000,
                null,
              );
              if (picked) {
                diag.proximaCombinacao = {
                  origem: picked.chosen.instancia_origem,
                  destino: picked.chosen.instancia_destino,
                };
              } else {
                diag.proximaCombinacao = null;
                diag.turnoBloqueado = true;
              }
            }
          } catch (supErr) {
            diag.supabase.mensagem = (supErr as Error)?.message || "Erro ao consultar Supabase.";
          }
        } else {
          diag.supabase.mensagem = "Supabase não configurado.";
        }
      }
      try {
        const config = await loadAquecedorEffectiveConfig();
        const nowSp = nowInSaoPaulo();
        diag.janela.aberta = isAquecedorWindowOpen(config, nowSp);
        diag.janela.motivo = diag.janela.aberta
          ? "Dentro da janela humanizada."
          : "Fora da janela humanizada.";
      } catch (cfgErr) {
        diag.janela.motivo = (cfgErr as Error)?.message || "Erro ao carregar janela.";
      }
    } else {
      diag.evo.mensagem = `EVO retornou status ${response.status}.`;
    }
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    diag.evo.mensagem = (e as Error)?.message || "Erro ao conectar na EVO (timeout ou rede).";
  }

  if (!diag.supabase.ok && getSupabaseClient()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { count } = await (supabase
          .from("aquecedor" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE")
          .lte("scheduled_at", new Date().toISOString())) as any;
        diag.supabase.ok = true;
        diag.supabase.pendingCount = typeof count === "number" ? count : 0;
      }
    } catch (_) {
      if (!diag.supabase.mensagem) diag.supabase.mensagem = "Erro ao consultar fila.";
    }
  }

  try {
    const auth = resolveWabaRequestAuth(req);
    const motorOwner =
      aquecedorRuntimeOwnerEmail || auth.email?.trim().toLowerCase() || null;
    const instAnalysis = await analyzeAquecedorInstances(motorOwner);
    diag.instancias = instAnalysis;
    if (instAnalysis.eligible.length) {
      diag.evo.instances = instAnalysis.eligible.map((row) => row.instancia);
      diag.evo.connectedCount = instAnalysis.eligible.length;
    }
  } catch (instErr) {
    diag.instancias = {
      erro: (instErr as Error)?.message || "Erro ao analisar instâncias do aquecedor.",
    };
  }

  return res.status(200).json(diag);
});

/**
 * Token de aplicativo (grant client_credentials). Uso típico: etapa inicial / chamadas limitadas;
 * não substitui token de System User com escopos no WABA.
 */
app.post("/meta-oficial/tokens/app-access", parseJsonDefault, async (req, res) => {
  try {
    const appId = String(req.body?.appId || "").trim();
    const appSecret = String(req.body?.appSecret || "").trim();
    if (!appId || !/^\d+$/.test(appId)) {
      return res.status(400).json({ error: "Campo 'appId' (numérico, App Dashboard) é obrigatório." });
    }
    if (!appSecret) {
      return res.status(400).json({ error: "Campo 'appSecret' é obrigatório." });
    }
    const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail = String(
        json?.error?.message || json?.error_description || text || ""
      ).slice(0, 280);
      return res.status(502).json({
        error: "Falha ao gerar token de aplicativo na Meta.",
        status: response.status,
        detail: detail || undefined,
      });
    }
    const accessToken = String(json?.access_token || "").trim();
    if (!accessToken) {
      return res.status(502).json({ error: "Resposta da Meta sem access_token." });
    }
    return res.json({
      ok: true,
      tokenType: json?.token_type || "bearer",
      accessToken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar token de aplicativo." });
  }
});

/**
 * Gera access token para System User (permanente ou 60 dias), conforme Business Management APIs.
 * Exige token de admin da BM / system user com permissão (não use o token client_credentials do passo anterior).
 */
app.post("/meta-oficial/tokens/system-user-access", parseJsonDefault, async (req, res) => {
  try {
    const businessAppId = String(req.body?.appId || req.body?.businessAppId || "").trim();
    const appSecret = String(req.body?.appSecret || "").trim();
    const systemUserId = sanitizeMetaId(req.body?.systemUserId);
    const adminAccessToken = String(req.body?.adminAccessToken || "").trim();
    const setTokenExpiresIn60Days = req.body?.setTokenExpiresIn60Days === true;
    const scopes = String(
      req.body?.scopes ||
        "business_management,whatsapp_business_management,whatsapp_business_messaging"
    ).trim();

    if (!businessAppId || !/^\d+$/.test(businessAppId)) {
      return res.status(400).json({ error: "Campo 'appId' do aplicativo Meta é obrigatório." });
    }
    if (!appSecret) {
      return res.status(400).json({ error: "Campo 'appSecret' é obrigatório." });
    }
    if (!systemUserId || !/^\d+$/.test(systemUserId)) {
      return res.status(400).json({ error: "Campo 'systemUserId' numérico é obrigatório." });
    }
    if (!adminAccessToken) {
      return res.status(400).json({
        error:
          "Campo 'adminAccessToken' é obrigatório (token de admin BM ou token temporário com permissão na BM).",
      });
    }

    const proof = metaAppSecretProof(adminAccessToken, appSecret);
    const endpoint = `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${systemUserId}/access_tokens`;
    const form = new URLSearchParams();
    form.set("business_app", businessAppId);
    form.set("scope", scopes);
    form.set("appsecret_proof", proof);
    form.set("access_token", adminAccessToken);
    if (setTokenExpiresIn60Days) {
      form.set("set_token_expires_in_60_days", "true");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail = String(json?.error?.message || text || "").slice(0, 280);
      return res.status(502).json({
        error: "Falha ao gerar token do system user na Meta.",
        status: response.status,
        detail: detail || undefined,
      });
    }
    const accessToken = String(json?.access_token || "").trim();
    if (!accessToken) {
      return res.status(502).json({ error: "Resposta da Meta sem access_token." });
    }
    return res.json({ ok: true, accessToken });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar token do system user." });
  }
});

/** Configuração pública para Embedded Signup (Facebook Login for Business). */
app.get("/meta-oficial/embedded-signup/config", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  const appId = String(process.env.META_APP_ID || "").trim();
  const configId = String(process.env.META_ES_CONFIG_ID || "").trim();
  const redirectUri = String(process.env.META_OAUTH_REDIRECT_URI || "").trim();
  res.json({
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    redirectUri: redirectUri || undefined,
    graphVersion: META_GRAPH_VERSION,
  });
});

/**
 * Troca o código do Embedded Signup por business token (Tech Provider / doc Meta nov/2025).
 * Usa META_APP_ID e META_APP_SECRET do ambiente — não envie app secret do cliente.
 *
 * Rotas duplicadas:
 * - `/api/meta/embedded-signup/exchange-code` — prefixo `/api` comum em proxies.
 * - `/meta/embedded-signup/exchange-code` — quando o proxy faz strip de `/api` e encaminha só o sufixo
 *   (ex.: nginx `proxy_pass http://node:3000/` dentro de `location /api/`).
 * - `/waba-embedded-signup-exchange` — path curto (menos regras de CDN/nginx que quebram POST aninhado).
 * - `/meta-oficial/...` — legado.
 */
async function metaEmbeddedSignupExchangeCodeHandler(req: express.Request, res: express.Response) {
  try {
    const code = String(req.body?.code || "").trim();
    const appId = String(process.env.META_APP_ID || "").trim();
    const appSecret = String(process.env.META_APP_SECRET || "").trim();
    const redirectFromBody = String(req.body?.redirectUri || req.body?.redirect_uri || "").trim();
    const redirectFromEnv = String(process.env.META_OAUTH_REDIRECT_URI || "").trim();
    if (!code) {
      return res.status(400).json({ error: "Campo 'code' é obrigatório (código de ~30s do Embedded Signup)." });
    }
    if (!appId || !appSecret) {
      return res.status(503).json({
        error: "Servidor sem META_APP_ID / META_APP_SECRET configurados para Embedded Signup.",
      });
    }

    const tryExchange = async (redirectUri: string | undefined) => {
      const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_VERSION}/oauth/access_token`);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("client_secret", appSecret);
      url.searchParams.set("code", code);
      if (redirectUri) {
        url.searchParams.set("redirect_uri", redirectUri);
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let response: Response;
      try {
        response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { response, text, json };
    };

    // Prioriza redirect_uri fixo do ambiente para bater 1:1 com o OAuth dialog.
    const uniqueRedirects = Array.from(
      new Set([redirectFromEnv, redirectFromBody].filter((u) => Boolean(String(u || "").trim())))
    ) as string[];
    const candidates: (string | undefined)[] = [...uniqueRedirects, undefined];

    let last: { response: Response; text: string; json: any } | null = null;
    for (const redirectUri of candidates) {
      last = await tryExchange(redirectUri);
      if (last.response.ok) break;
      const msg = String(
        last.json?.error?.message || last.json?.error_description || last.text || ""
      ).toLowerCase();
      const retryWithoutRedirect =
        redirectUri &&
        (msg.includes("redirect_uri") ||
          msg.includes("redirect uri") ||
          msg.includes("matching") ||
          msg.includes("doesn't match"));
      if (retryWithoutRedirect) {
        last = await tryExchange(undefined);
        if (last.response.ok) break;
      }
    }

    if (!last) {
      return res.status(500).json({ error: "Falha interna ao consultar a Meta." });
    }
    const { response, text, json } = last;
    if (!response.ok) {
      const detail = String(
        json?.error?.message || json?.error_description || text || ""
      ).slice(0, 500);
      const upstreamStatus = Number(response.status) || 500;
      // EasyPanel mascara 502 com página HTML; preferimos manter JSON para erro da Meta.
      const clientStatus =
        upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 424;
      return res.status(clientStatus).json({
        error: "Falha ao trocar código por token na Meta.",
        status: response.status,
        detail: detail || undefined,
      });
    }
    const accessToken = String(json?.access_token || text || "").trim();
    if (!accessToken) {
      return res.status(424).json({ error: "Resposta da Meta sem access_token." });
    }
    return res.json({ ok: true, accessToken });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao trocar código Embedded Signup." });
  }
}

app.post("/waba-embedded-signup-exchange", metaEmbeddedSignupExchangeCodeHandler);
app.post("/meta/embedded-signup/exchange-code", metaEmbeddedSignupExchangeCodeHandler);
app.post("/meta-oficial/embedded-signup/exchange-code", metaEmbeddedSignupExchangeCodeHandler);
app.post("/api/meta/embedded-signup/exchange-code", metaEmbeddedSignupExchangeCodeHandler);

/** Inscreve o app nos webhooks do WABA do cliente (pós-Embedded Signup). */
app.post("/meta-oficial/embedded-signup/subscribe-webhooks", parseJsonDefault, async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    const subscribedFields = String(
      req.body?.subscribedFields || "messages,message_status,messaging_postbacks"
    ).trim();
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' é obrigatório." });

    const existing = await callMetaGraphApi({
      token,
      method: "GET",
      path: `${wabaId}/subscribed_apps`,
    });
    if (!existing.ok) {
      return res.status(502).json({
        error: "Falha ao consultar subscribed_apps.",
        status: existing.status,
        detail: String(existing.json?.error?.message || existing.body || "").slice(0, 260),
      });
    }
    const currentItems = Array.isArray(existing.json?.data) ? existing.json.data : [];
    if (currentItems.length > 0) {
      return res.json({ ok: true, alreadySubscribed: true, items: currentItems });
    }
    const subscribe = await callMetaGraphApi({
      token,
      method: "POST",
      path: `${wabaId}/subscribed_apps`,
      body: { subscribed_fields: subscribedFields },
    });
    if (!subscribe.ok) {
      return res.status(502).json({
        error: "Falha ao inscrever app nos webhooks do WABA.",
        status: subscribe.status,
        detail: String(subscribe.json?.error?.message || subscribe.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, alreadySubscribed: false, data: subscribe.json || null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao inscrever webhooks." });
  }
});

app.post("/meta-oficial/ativos/phone-numbers/list", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });

    const result = await callMetaGraphApi({
      token,
      method: "GET",
      path: `${wabaId}/phone_numbers`,
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao listar números da API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({
      ok: true,
      items: Array.isArray(result.json?.data) ? result.json.data : [],
      paging: result.json?.paging || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar números da API Meta." });
  }
});

app.post("/meta-oficial/ativos/phone-numbers/register", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const phoneNumberId = sanitizeMetaId(req.body?.phoneNumberId);
    const pin = String(req.body?.pin || "").trim();
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!phoneNumberId) return res.status(400).json({ error: "Campo 'phoneNumberId' é obrigatório." });
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: "Campo 'pin' deve ter 6 dígitos numéricos." });
    }

    const result = await callMetaGraphApi({
      token,
      method: "POST",
      path: `${phoneNumberId}/register`,
      body: { messaging_product: "whatsapp", pin },
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao registrar número na API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, data: result.json || null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao registrar número na API Meta." });
  }
});

app.post("/meta-oficial/ativos/subscribed-apps/list", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });

    const result = await callMetaGraphApi({
      token,
      method: "GET",
      path: `${wabaId}/subscribed_apps`,
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao consultar apps inscritos na API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, items: Array.isArray(result.json?.data) ? result.json.data : [] });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar apps inscritos." });
  }
});

app.post("/meta-oficial/ativos/subscribed-apps/ensure", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    const subscribedFields = String(
      req.body?.subscribedFields || "messages,message_status,messaging_postbacks"
    ).trim();
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });

    const existing = await callMetaGraphApi({
      token,
      method: "GET",
      path: `${wabaId}/subscribed_apps`,
    });
    if (!existing.ok) {
      return res.status(502).json({
        error: "Falha ao consultar inscrição atual do app.",
        status: existing.status,
        detail: String(existing.json?.error?.message || existing.body || "").slice(0, 260),
      });
    }
    const currentItems = Array.isArray(existing.json?.data) ? existing.json.data : [];
    if (currentItems.length > 0) {
      return res.json({ ok: true, alreadySubscribed: true, items: currentItems });
    }

    const subscribe = await callMetaGraphApi({
      token,
      method: "POST",
      path: `${wabaId}/subscribed_apps`,
      body: { subscribed_fields: subscribedFields },
    });
    if (!subscribe.ok) {
      return res.status(502).json({
        error: "Falha ao inscrever app na API Meta.",
        status: subscribe.status,
        detail: String(subscribe.json?.error?.message || subscribe.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, alreadySubscribed: false, data: subscribe.json || null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao inscrever app na API Meta." });
  }
});

app.post("/meta-oficial/templates/list", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    const limit = Math.max(1, Math.min(200, Number(req.body?.limit || 30)));
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });

    const result = await callMetaGraphApi({
      token,
      method: "GET",
      path: `${wabaId}/message_templates?limit=${limit}`,
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao listar templates da API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({
      ok: true,
      items: Array.isArray(result.json?.data) ? result.json.data : [],
      paging: result.json?.paging || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar templates." });
  }
});

app.post("/meta-oficial/templates/create-utility", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
    const rawName = String(req.body?.name || "").trim().toLowerCase();
    const name = rawName.replace(/[^a-z0-9_]/g, "_").slice(0, 512);
    const language = String(req.body?.language || "pt_BR").trim();
    const bodyText = String(req.body?.bodyText || "").trim();
    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!wabaId) return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
    if (!name) return res.status(400).json({ error: "Campo 'name' é obrigatório." });
    if (!bodyText) return res.status(400).json({ error: "Campo 'bodyText' é obrigatório." });

    const payload = {
      name,
      category: "UTILITY",
      language,
      components: [{ type: "BODY", text: bodyText }],
    };
    const result = await callMetaGraphApi({
      token,
      method: "POST",
      path: `${wabaId}/message_templates`,
      body: payload,
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao criar template utilidade na API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, data: result.json || null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar template utilidade." });
  }
});

app.post("/meta-oficial/disparo/send-template", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const phoneNumberId = sanitizeMetaId(req.body?.phoneNumberId);
    const toRaw = String(req.body?.to || "").trim();
    const to = toRaw.replace(/\D+/g, "");
    const templateName = String(req.body?.templateName || "").trim().toLowerCase();
    const languageCode = String(req.body?.languageCode || "pt_BR").trim();
    const bodyParamsInput = Array.isArray(req.body?.bodyParams) ? req.body.bodyParams : [];
    const bodyParams = bodyParamsInput
      .map((v: any) => String(v ?? "").trim())
      .filter((v: string) => v.length > 0)
      .slice(0, 20);

    if (!token) return res.status(400).json({ error: "Campo 'token' é obrigatório." });
    if (!phoneNumberId) return res.status(400).json({ error: "Campo 'phoneNumberId' é obrigatório." });
    if (!to) return res.status(400).json({ error: "Campo 'to' é obrigatório." });
    if (!templateName) return res.status(400).json({ error: "Campo 'templateName' é obrigatório." });

    const payload: Record<string, any> = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (bodyParams.length) {
      payload.template.components = [
        {
          type: "body",
          parameters: bodyParams.map((text: string) => ({ type: "text", text })),
        },
      ];
    }

    const result = await callMetaGraphApi({
      token,
      method: "POST",
      path: `${phoneNumberId}/messages`,
      body: payload,
    });
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao disparar template via API Meta.",
        status: result.status,
        detail: String(result.json?.error?.message || result.body || "").slice(0, 260),
      });
    }
    return res.json({ ok: true, data: result.json || null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao disparar template." });
  }
});

app.get("/disparos/config", async (req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const auth = resolveWabaRequestAuth(req);
    const selectedDisparadorInstances = await wabaFazendaPoolService.filterDisparadorInstancesForAuth(
      auth,
      Array.isArray(config.selectedDisparadorInstances) ? config.selectedDisparadorInstances : []
    );
    const autoProviders = getAutoShortenerProviderOrder();
    const currentShortenerProvider = autoProviders[0];
    return res.json({
      config: { ...config, selectedDisparadorInstances },
      shortenerAuto: true,
      currentShortenerProvider,
      alternativaDispatch:
        auth.email && (await shouldApplyAlternativaDispatchProfile(auth.email))
          ? {
              active: true,
              rules: getAlternativaDispatchRulesMeta(),
              throttle: computeAlternativaThrottle({
                startHour: config.startHour,
                endHour: config.endHour,
              }),
            }
          : { active: false, rules: getAlternativaDispatchRulesMeta() },
      shortenerProviders: [
        { id: "waba", label: "WABA (encurtador próprio)", auth: "interno" },
        { id: "encurtadorpro", label: "EncurtadorPro", auth: "requer API key (Bearer)" },
      ],
    });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar configuração do Disparador." });
  }
});

app.post("/disparos/config", async (req, res) => {
  try {
    const rawConfig = req.body?.config || {};
    const allowPartialSave = req.body?.allowPartialSave === true;
    const currentConfig = await loadDisparosConfigFromDb();
    const mergedConfig = { ...currentConfig, ...rawConfig };
    if (!allowPartialSave) {
      const validationError = validateRequiredDisparosConfigPayload(mergedConfig);
      if (validationError) return res.status(400).json({ error: validationError });
    }
    let config = parseDisparosConfig(mergedConfig);
    const auth = resolveWabaRequestAuth(req);
    if (auth.email && (await shouldApplyAlternativaDispatchProfile(auth.email))) {
      config = applyAlternativaDispatchProfile(config);
    }
    config = {
      ...config,
      selectedDisparadorInstances: await wabaFazendaPoolService.filterDisparadorInstancesForAuth(
        auth,
        config.selectedDisparadorInstances
      ),
    };
    await saveDisparosConfigToDb(config);
    return res.json({ ok: true, message: "Configuração do Disparador salva.", config });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Configuração inválida." });
  }
});

app.get("/disparos/alternativa/estimate", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para consultar a projeção." });
    }
    const plannedSendCount = Math.floor(Number(req.query.plannedSendCount) || 0);
    const summary = await alternativaNumbersService.getSummaryAsync(auth.email);
    const config = await loadDisparosConfigFromDb();
    const workingDaysPerWeek = Array.isArray(config.workingDays) ? config.workingDays.length : 5;
    const estimate = estimateAlternativaCampaignDuration({
      plannedSendCount,
      activatedInstanceCount: summary.activatedCount,
      workingDaysPerWeek,
    });
    return res.json({
      ...estimate,
      dispatchRules: getAlternativaDispatchRulesMeta(),
      canSend: summary.canSend,
      activatedCount: summary.activatedCount,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Erro ao estimar duração da campanha." });
  }
});

app.get("/disparos/messenger-products", async (_req, res) => {
  try {
    const items = await runMessengerProductsLocked(() =>
      loadMessengerProductsFromFile()
    );
    const sorted = [...items].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "pt-BR", { sensitivity: "base" })
    );
    return res.json({ items: sorted });
  } catch {
    return res
      .status(500)
      .json({ error: "Erro ao carregar biblioteca de produtos do Mensageiro." });
  }
});

app.post("/disparos/messenger-products", async (req, res) => {
  try {
    const incoming = parseMessengerProductFromBody(req.body || {});
    if (!incoming) {
      return res
        .status(400)
        .json({ error: "Informe um nome de produto (até 200 caracteres)." });
    }
    const saved = await runMessengerProductsLocked(async () => {
      const items = await loadMessengerProductsFromFile();
      const key = incoming.displayName.toLowerCase();
      const idx = items.findIndex(
        (row) => row.displayName.toLowerCase() === key
      );
      const next: MessengerProductRow =
        idx >= 0
          ? { ...incoming, id: items[idx].id, updatedAt: incoming.updatedAt }
          : incoming;
      const merged =
        idx >= 0
          ? items.map((row, i) => (i === idx ? next : row))
          : [...items, next];
      await saveMessengerProductsToFile(merged);
      return next;
    });
    return res.json({
      ok: true,
      message: "Produto salvo na biblioteca do Mensageiro.",
      product: saved,
    });
  } catch {
    return res
      .status(500)
      .json({ error: "Erro ao gravar produto na biblioteca." });
  }
});

app.get("/disparos/diagnostico", async (req, res) => {
  try {
    const nowSp = nowInSaoPaulo();
    const fullConfig = await loadDisparosConfigFromDb();
    const janelaBase = isDisparosWindowOpen(fullConfig, nowSp);
    const janelaPrevisaoGlobal =
      !janelaBase.aberta
        ? (() => {
            const n = findNextDisparosWindowStart(fullConfig, nowSp);
            return n ? formatDateBr(n.toISOString()) : null;
          })()
        : null;
    const janela = {
      ...janelaBase,
      previsaoRetornoBr: janelaPrevisaoGlobal,
    };
    const wapp = normalizeWhatsAppNumber(String(fullConfig.whatsappTargetNumber || ""));
    const whatsappAlvoMascarado =
      wapp.length >= 4 ? `…${wapp.slice(-4)}` : wapp.length > 0 ? "definido" : "não definido";

    const diag: Record<string, any> = {
      tickCampanhasMs: 7000,
      horarioReferenciaBr: formatDateBr(nowSp.toISOString()),
      janela,
      configResumo: {
        delayMinSeconds: fullConfig.delayMinSeconds,
        delayMaxSeconds: fullConfig.delayMaxSeconds,
        maxPerHourPerInstance: fullConfig.maxPerHourPerInstance,
        maxPerDayPerInstance: fullConfig.maxPerDayPerInstance,
        workingDays: fullConfig.workingDays,
        startHour: fullConfig.startHour,
        endHour: fullConfig.endHour,
        instanciasSelecionadasCount: fullConfig.selectedDisparadorInstances.length,
        shortenerProvider: fullConfig.shortenerProvider,
        whatsappAlvoMascarado,
      },
      evo: {
        ok: false,
        eligibleCount: 0,
        instances: [] as string[],
        semSelecaoNaUi: false,
        mensagem: "" as string,
      },
      campanhas: {
        totalNaMemoria: disparosCampaignsMemory.length,
        emExecucao: [] as Array<Record<string, unknown>>,
      },
      templatesAtivosNaMemoria: disparosTemplatesMemory.filter((t) => t.active !== false)
        .length,
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(EVO_INSTANCES_URL, {
        headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.response)
            ? raw.response
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
        const connected = await filterConnectedInstanciasForRequest(
          req,
          buildConnectedFromEvoResponse(list)
        );
        const usageMap = await loadInstanceUsageMap();
        const selectedSet = new Set(
          Array.isArray(fullConfig.selectedDisparadorInstances)
            ? fullConfig.selectedDisparadorInstances
                .map((n) => String(n || "").trim())
                .filter(Boolean)
            : []
        );
        const hasSelection = selectedSet.size > 0;
        const eligible = connected.filter((item) => {
          const usage = usageMap.get(item.instancia);
          const byUsage = usage ? usage.useDisparador !== false : true;
          const bySelection = hasSelection ? selectedSet.has(item.instancia) : true;
          return byUsage && bySelection;
        });
        diag.evo.ok = true;
        diag.evo.eligibleCount = eligible.length;
        diag.evo.instances = eligible.map((e) => e.instancia).slice(0, 40);
        diag.evo.semSelecaoNaUi = !hasSelection;
      } else {
        diag.evo.mensagem = `EVO HTTP ${response.status}`;
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      diag.evo.mensagem =
        (e as Error)?.message || "Falha ao consultar instâncias na EVO.";
    }

    for (const c of disparosCampaignsMemory) {
      if (c.status !== "running") continue;
      const leads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === c.id);
      const pending = leads.filter((l) => l.status === "pending").length;
      const failed = leads.filter((l) => l.status === "failed").length;
      const nextMs = campaignNextAllowedSendAt.get(c.id) || 0;
      const nowMs = Date.now();
      const snap = c.configSnapshot || DISPAROS_DEFAULTS;
      const janelaCampanha = isDisparosWindowOpen(snap, nowSp);
      const previsaoCampanhaBr =
        !janelaCampanha.aberta
          ? (() => {
              const n = findNextDisparosWindowStart(snap, nowSp);
              return n ? formatDateBr(n.toISOString()) : null;
            })()
          : null;

      let proximoEnvio: string;
      if (!janelaCampanha.aberta) {
        proximoEnvio = previsaoCampanhaBr
          ? `ciclo em execução · fora do expediente (normal) · retorno previsto ~ ${previsaoCampanhaBr} · ${janelaCampanha.motivo}`
          : `fora do expediente · ${janelaCampanha.motivo}`;
      } else if (nextMs > nowMs) {
        const remainingSeconds = Math.max(1, Math.ceil((nextMs - nowMs) / 1000));
        proximoEnvio = `ciclo em execução · dentro do expediente · intervalo operacional (normal) · próximo envio em ~${remainingSeconds}s (${formatDateBr(new Date(nextMs).toISOString())})`;
      } else {
        proximoEnvio = "ciclo em execução · dentro do expediente · pronto para envio no próximo ciclo (~7s)";
      }

      diag.campanhas.emExecucao.push({
        id: c.id,
        nome: c.name,
        enviados: c.sentCount,
        total: c.totalNumbers,
        pendentesNaMemoria: pending,
        falhasNaMemoria: failed,
        proximoEnvio,
        janelaExpedienteAberta: janelaCampanha.aberta,
        janelaExpedienteMotivo: janelaCampanha.motivo,
        previsaoRetornoExpedienteBr: previsaoCampanhaBr,
      });
    }

    return res.json(diag);
  } catch (error) {
    console.error("Erro em /disparos/diagnostico:", error);
    return res.status(500).json({ error: "Erro ao montar diagnóstico do Disparador." });
  }
});

app.post("/disparos/shorten", async (req, res) => {
  try {
    const longUrl = String(req.body?.longUrl || "").trim();
    const domain = ""; // domínio custom removido da UI por simplicidade operacional
    if (!/^https?:\/\//i.test(longUrl)) {
      return res.status(400).json({ error: "longUrl deve ser uma URL válida." });
    }

    let shortUrl = "";
    let finalLongUrl = longUrl;
    let providerUsed: DisparosConfig["shortenerProvider"] | null = null;
    const maxAttempts = 5;
    const providers = getAutoShortenerProviderOrder();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const candidateUrl =
        attempt === 1 ? longUrl : appendAntiRepeatParam(longUrl, attempt);
      for (const provider of providers) {
        try {
          const candidateShort = await shortenUrlWithProvider(
            candidateUrl,
            provider,
            domain
          );
          shortUrl = candidateShort;
          finalLongUrl = candidateUrl;
          providerUsed = provider;
          break;
        } catch {
          // tenta próximo provedor
        }
      }
      if (shortUrl) break;
    }

    if (!shortUrl) {
      return res.status(502).json({
        error: "Não foi possível gerar link curto.",
      });
    }
    return res.json({
      ok: true,
      shortUrl,
      provider: providerUsed || providers[0],
      nonRepeated: true,
      sourceUrlUsed: finalLongUrl,
      shortenerAuto: true,
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Falha ao encurtar URL." });
  }
});

app.post("/disparos/gerar-mensagem-ai", async (req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const customBriefing = String(req.body?.briefing || "").trim();
    const briefing = customBriefing || String(config.aiBriefing || "").trim();
    const tone = String(req.body?.tone || config.aiTone || "consultivo").trim();
    const audience = String(req.body?.audience || config.aiAudience || "CORBAN").trim();
    const cta = String(req.body?.cta || config.aiCta || "Responda no link abaixo").trim();
    const objective = String(req.body?.objective || "gerar mensagem de prospeccao").trim();
    const targetNumber = normalizeWhatsAppNumber(
      String(req.body?.whatsappTargetNumber || config.whatsappTargetNumber || "")
    );
    if (!targetNumber) {
      return res.status(400).json({
        error: "Número alvo não configurado na seção Encurtador de URL.",
      });
    }
    // longUrl único para o teste de geração (evita acúmulo de cliques em shortUrl reaproveitado)
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const accessUrlRaw = `https://wa.me/${targetNumber}?text=Ol%C3%A1&_n8n_link_nonce=${nonce}`;
    let shortUrl = "";
    let shortenerProvider = "";
    const shortened = await generateShortUrlForDisparos(accessUrlRaw);
    shortUrl = shortened.shortUrl;
    shortenerProvider = String(shortened.provider || "");
    const prompt = buildDisparosAiPrompt({
      briefing,
      tone,
      audience,
      cta,
      objective,
      accessLink: shortUrl,
    });
    const generated = await callOpenAiGenerateMessage({
      prompt,
      model: String(req.body?.model || OPENAI_MODEL),
      maxOutputTokens: Number(req.body?.maxOutputTokens || 220),
    });
    const finalMessage = ensureMessageContainsLink(generated.text, shortUrl, cta);
    return res.json({
      ok: true,
      message: finalMessage,
      model: generated.model,
      latencyMs: generated.latencyMs,
      shortUrl,
      shortenerProvider,
    });
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || "Erro ao gerar mensagem com OpenAI.",
    });
  }
});

app.post("/disparos/teste-mensagem-ai", async (req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const instanceName = String(req.body?.instanceName || "").trim();
    const targetNumber = normalizeWhatsAppNumber(String(req.body?.targetNumber || config.whatsappTargetNumber || ""));
    if (!instanceName) {
      return res.status(400).json({ error: "Campo 'instanceName' é obrigatório." });
    }
    if (!targetNumber) {
      return res.status(400).json({ error: "Campo 'targetNumber' é obrigatório." });
    }

    const prompt = buildDisparosAiPrompt({
      briefing: String(req.body?.briefing || config.aiBriefing || "").trim(),
      tone: String(req.body?.tone || config.aiTone || "consultivo").trim(),
      audience: String(req.body?.audience || config.aiAudience || "CORBAN").trim(),
      cta: String(req.body?.cta || config.aiCta || "Responda no link abaixo").trim(),
      objective: String(req.body?.objective || "gerar mensagem de teste para WhatsApp").trim(),
    });
    const generated = await callOpenAiGenerateMessage({
      prompt,
      model: String(req.body?.model || OPENAI_MODEL),
      maxOutputTokens: Number(req.body?.maxOutputTokens || 220),
    });

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instanceName);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: targetNumber, textMessage: { text: generated.text } }
      : { number: targetNumber, text: generated.text, textMessage: { text: generated.text } };
    const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
    if (!sendResult.ok) {
      const detail =
        sendResult.json?.message ||
        sendResult.json?.error ||
        (typeof sendResult.body === "string" ? sendResult.body.slice(0, 180) : "");
      return res.status(502).json({
        error: "Falha ao enviar mensagem teste via EVO.",
        status: sendResult.status,
        detail: String(detail || "").slice(0, 180),
      });
    }

    return res.json({
      ok: true,
      message: "Mensagem teste gerada com OpenAI e enviada com sucesso.",
      generatedMessage: generated.text,
      model: generated.model,
      instanceName,
      targetNumber,
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Erro ao executar teste de mensagem AI." });
  }
});

app.get("/disparos/next-instance", async (req, res) => {
  try {
    const previewOnly =
      String(req.query.preview || "").toLowerCase() === "1" ||
      String(req.query.preview || "").toLowerCase() === "true";

    const parseInstancesQueryParam = (): string[] | null => {
      const raw = req.query.instances;
      if (raw === undefined) return null;
      if (typeof raw === "string") {
        const parts = raw.split(",").map((s) => String(s || "").trim()).filter(Boolean);
        return parts;
      }
      if (Array.isArray(raw)) {
        return raw
          .flatMap((r) => String(r || "").split(","))
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return null;
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!response.ok) {
      return res.status(502).json({ error: "Falha ao consultar instâncias na EVO." });
    }
    const raw = await response.json();
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.response)
        ? raw.response
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
    const connected = await filterConnectedInstanciasForRequest(
      req,
      buildConnectedFromEvoResponse(list)
    );
    const usageMap = await loadInstanceUsageMap();
    const fromQuery = parseInstancesQueryParam();
    const disparosConfig = await loadDisparosConfigFromDb();
    const dbSelected = Array.isArray(disparosConfig.selectedDisparadorInstances)
      ? disparosConfig.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
      : [];

    let selectedSet: Set<string>;
    let hasSelection: boolean;
    if (fromQuery !== null) {
      selectedSet = new Set(fromQuery);
      hasSelection = selectedSet.size > 0;
    } else {
      selectedSet = new Set(dbSelected);
      hasSelection = selectedSet.size > 0;
    }

    const eligible = connected.filter((item) => {
      const usage = usageMap.get(item.instancia);
      const byUsage = usage ? usage.useDisparador !== false : true;
      const bySelection = hasSelection ? selectedSet.has(item.instancia) : true;
      return byUsage && bySelection;
    });
    if (!eligible.length) {
      return res.status(409).json({
        error: "Nenhuma instância conectada e habilitada para Disparador.",
      });
    }
    const idx = disparosRoundRobinCounter % eligible.length;
    const selected = eligible[idx];
    if (!previewOnly) {
      disparosRoundRobinCounter += 1;
    }
    return res.json({
      ok: true,
      selected,
      totalEligible: eligible.length,
      fallbackEnabled: true,
      preview: previewOnly,
      note:
        "Quando a instância atual desconectar/bloquear, o próximo ciclo deve usar a próxima conectada.",
    });
  } catch {
    return res.status(500).json({ error: "Erro ao selecionar próxima instância do Disparador." });
  }
});

app.get("/disparos/templates", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await (supabase
          .from("disparos_message_templates" as any)
          .select("id, message_text, alias, segment, source, created_at, active")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(200)) as any;
        if (Array.isArray(data)) {
          const items = data.map((row: any) => ({
            id: String(row?.id || ""),
            text: String(row?.message_text || ""),
            alias: String(row?.alias || ""),
            segment: String(row?.segment || ""),
            source: row?.source === "manual" ? "manual" : "spreadsheet",
            createdAt: String(row?.created_at || ""),
            active: row?.active !== false,
          }));
          return res.json({ items });
        }
      } catch {
        // fallback em memória
      }
    }
    return res.json({ items: disparosTemplatesMemory.slice(0, 200) });
  } catch {
    return res.status(500).json({ error: "Erro ao listar templates de mensagem." });
  }
});

app.post("/disparos/templates/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const mapped = rows
      .map((row: any) => ({
        id: crypto.randomUUID(),
        text: String(row?.text || "").trim(),
        alias: String(row?.alias || "").trim(),
        segment: String(row?.segment || "").trim(),
        source: "spreadsheet" as const,
        createdAt: new Date().toISOString(),
        active: true,
      }))
      .filter((row: MessageTemplate) => row.text.length > 0);
    if (!mapped.length) {
      return res.status(400).json({ error: "Nenhuma mensagem válida encontrada para importar." });
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const payload = mapped.map((row: MessageTemplate) => ({
          id: row.id,
          message_text: row.text,
          alias: row.alias,
          segment: row.segment,
          source: row.source,
          created_at: row.createdAt,
          active: row.active,
        }));
        await (supabase.from("disparos_message_templates" as any) as any).insert(payload);
      } catch {
        disparosTemplatesMemory.unshift(...mapped);
      }
    } else {
      disparosTemplatesMemory.unshift(...mapped);
    }
    return res.json({
      ok: true,
      imported: mapped.length,
      message: `${mapped.length} mensagem(ns) importada(s) com sucesso.`,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao importar templates de mensagem." });
  }
});

async function hydrateCampaignFromDbIfNeeded(
  campaignId: string,
  options: { skipQueueLocalPersist?: boolean } = {}
): Promise<DisparosCampaign | null> {
  const existing = disparosCampaignsMemory.find((c) => c.id === campaignId);
  const supabase = getSupabaseClient();
  if (!supabase) return existing || null;

  try {
    const { data: row, error: rowErr } = await (supabase
      .from("disparos_campaigns" as any)
      .select("id, campaign_name, status, total_numbers, sent_count, created_at")
      .eq("id", campaignId)
      .maybeSingle()) as any;
    if (rowErr) {
      console.error("[Campanha] hydrate linha:", campaignId, rowErr.message || rowErr);
      return existing || null;
    }

    let configSnapshot: DisparosConfig = existing?.configSnapshot ?? { ...DISPAROS_DEFAULTS };
    try {
      const { data: cfgRow, error: cfgErr } = await (supabase
        .from("disparos_campaigns" as any)
        .select("config_snapshot")
        .eq("id", campaignId)
        .maybeSingle()) as any;
      if (!cfgErr && cfgRow?.config_snapshot != null) {
        try {
          const rawCfg =
            typeof cfgRow.config_snapshot === "string"
              ? JSON.parse(cfgRow.config_snapshot)
              : cfgRow.config_snapshot;
          configSnapshot = parseDisparosConfig(rawCfg);
        } catch {
          /* mantém configSnapshot acima */
        }
      }
    } catch {
      /* coluna ausente */
    }

    let leadRows: any[] = [];
    try {
      let lr: any[] | null = null;
      const withMessage = await (supabase
        .from("disparos_campaign_leads" as any)
        .select("id, campaign_id, phone, status, created_at, sent_at, short_url, message_text")
        .eq("campaign_id", campaignId)
        .limit(100000)) as any;
      if (!withMessage.error && Array.isArray(withMessage.data)) {
        lr = withMessage.data;
      } else {
        const legacy = await (supabase
          .from("disparos_campaign_leads" as any)
          .select("id, campaign_id, phone, status, created_at, sent_at")
          .eq("campaign_id", campaignId)
          .limit(100000)) as any;
        if (!legacy.error && Array.isArray(legacy.data)) lr = legacy.data;
      }
      if (Array.isArray(lr)) leadRows = lr;
    } catch (e) {
      console.error("[Campanha] Falha ao ler leads no hydrate:", campaignId, e);
    }

    if (!row?.id) {
      return existing || null;
    }

    const stRow = String(row.status || "paused").toLowerCase();
    const status: DisparosCampaign["status"] =
      stRow === "running" || stRow === "paused" || stRow === "finished" || stRow === "draft"
        ? stRow
        : "paused";

    if (existing) {
      existing.name = String(row.campaign_name || existing.name);
      existing.status = status;
      existing.totalNumbers = Number(row.total_numbers ?? existing.totalNumbers);
      existing.sentCount = Number(row.sent_count ?? existing.sentCount);
      existing.configSnapshot = configSnapshot;
      if (leadRows.length > 0) {
        removeLeadsForCampaignFromMemory(campaignId);
        for (const lr of leadRows) {
          const st = String(lr?.status || "pending").toLowerCase();
          disparosCampaignLeadsMemory.push({
            id: String(lr?.id || crypto.randomUUID()),
            campaignId: String(lr?.campaign_id || campaignId),
            phone: String(lr?.phone || ""),
            status: st === "sent" ? "sent" : st === "failed" ? "failed" : "pending",
            shortUrl: typeof lr?.short_url === "string" ? String(lr.short_url) : undefined,
            messageText: typeof lr?.message_text === "string" ? String(lr.message_text) : undefined,
            createdAt: String(lr?.created_at || new Date().toISOString()),
            sentAt: lr?.sent_at ? String(lr.sent_at) : null,
          });
        }
      }
      if (!options.skipQueueLocalPersist) queuePersistDisparosLocalState();
      return existing;
    }

    const campaign: DisparosCampaign = {
      id: String(row.id),
      name: String(row.campaign_name || ""),
      createdAt: String(row.created_at || new Date().toISOString()),
      status,
      totalNumbers: Number(row.total_numbers || 0),
      sentCount: Number(row.sent_count || 0),
      configSnapshot,
    };
    disparosCampaignsMemory.push(campaign);
    if (leadRows.length > 0) {
      for (const lr of leadRows) {
        const st = String(lr?.status || "pending").toLowerCase();
        disparosCampaignLeadsMemory.push({
          id: String(lr?.id || crypto.randomUUID()),
          campaignId: String(lr?.campaign_id || campaignId),
          phone: String(lr?.phone || ""),
          status: st === "sent" ? "sent" : st === "failed" ? "failed" : "pending",
          shortUrl: typeof lr?.short_url === "string" ? String(lr.short_url) : undefined,
          messageText: typeof lr?.message_text === "string" ? String(lr.message_text) : undefined,
          createdAt: String(lr?.created_at || new Date().toISOString()),
          sentAt: lr?.sent_at ? String(lr.sent_at) : null,
        });
      }
    }
    if (!options.skipQueueLocalPersist) queuePersistDisparosLocalState();
    return campaign;
  } catch (e) {
    console.error("[Campanha] Falha ao hidratar campanha do banco:", campaignId, e);
    return existing || null;
  }
}

/** Sobe todas as campanhas do Postgres para memória (lista + disparos após restart). */
async function syncDisparosCampaignsFromDbOnStartup(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { data: rows, error } = await (supabase
      .from("disparos_campaigns" as any)
      .select("id")
      .order("created_at", { ascending: false })
      .limit(200)) as any;
    if (error) {
      console.error("[Campanhas] startup sync (lista):", error.message || error);
      return;
    }
    if (!Array.isArray(rows) || !rows.length) {
      console.log("[Campanhas] nenhuma campanha no Supabase para sincronizar.");
      return;
    }
    for (const r of rows) {
      const id = String(r?.id || "").trim();
      if (!id) continue;
      await hydrateCampaignFromDbIfNeeded(id, { skipQueueLocalPersist: true });
    }
    console.log(`[Campanhas] sincronizadas do Supabase na subida: ${rows.length} campanha(s).`);
    queuePersistDisparosLocalState();
  } catch (e) {
    console.error("[Campanhas] startup sync:", e);
  }
}

async function pickDisparadorInstanceForConfig(
  config: DisparosConfig
): Promise<{ instancia: string; numero: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const raw = await response.json();
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.response)
        ? raw.response
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
    const connected = buildConnectedFromEvoResponse(list);
    const usageMap = await loadInstanceUsageMap();
    const selectedList =
      Array.isArray(config.selectedDisparadorInstances)
        ? config.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
        : [];
    if (!selectedList.length) return null;
    const selectedSet = new Set(selectedList);
    const eligible = connected.filter((item) => {
      const usage = usageMap.get(item.instancia);
      const byUsage = usage ? usage.useDisparador !== false : true;
      return byUsage && selectedSet.has(item.instancia);
    });
    if (!eligible.length) return null;
    const maxPerDay = Math.max(
      1,
      Number(config.maxPerDayPerInstance) || DISPAROS_DEFAULTS.maxPerDayPerInstance
    );
    const dateKey = saoPauloDateKey();
    const pool = eligible.filter(
      (item) => getInstanceDailySendCount(item.instancia, dateKey) < maxPerDay
    );
    if (!pool.length) return null;
    const key = "__global_rr__";
    const cur = campaignDisparadorRoundRobin.get(key) ?? disparosRoundRobinCounter;
    const idx = cur % pool.length;
    campaignDisparadorRoundRobin.set(key, cur + 1);
    disparosRoundRobinCounter = cur + 1;
    return pool[idx];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function composeOutboundMessageForConfig(
  config: DisparosConfig
): Promise<{ text: string; shortUrl: string | null }> {
  if (config.messageMode === "database") {
    let templates: MessageTemplate[] = [];
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await (supabase
          .from("disparos_message_templates" as any)
          .select("id, message_text, alias, segment, source, created_at, active")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(200)) as any;
        if (Array.isArray(data)) {
          templates = data.map((row: any) => ({
            id: String(row?.id || ""),
            text: String(row?.message_text || ""),
            alias: String(row?.alias || ""),
            segment: String(row?.segment || ""),
            source: row?.source === "manual" ? "manual" : "spreadsheet",
            createdAt: String(row?.created_at || ""),
            active: row?.active !== false,
          }));
        }
      } catch {
        /* */
      }
    }
    if (!templates.length) {
      templates = disparosTemplatesMemory.filter((t) => t.active !== false);
    }
    const pick = templates[Math.floor(Math.random() * templates.length)];
    if (!pick?.text?.trim()) {
      return {
        text: "Olá! Temos uma informação importante para você. Responda quando puder.",
        shortUrl: null,
      };
    }
    const text = pick.text.trim();
    return { text, shortUrl: extractFirstHttpUrl(text) };
  }

  const targetNumber = normalizeWhatsAppNumber(String(config.whatsappTargetNumber || ""));
  if (!targetNumber) {
    throw new Error("Snapshot da campanha sem número alvo (Encurtador).");
  }
  // Importante: gerar um longUrl "único" por lead (via nonce) para evitar reuso do mesmo shortUrl
  // e acúmulo de cliques históricos entre execuções/campanhas.
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const accessUrlRaw = `https://wa.me/${targetNumber}?text=Ol%C3%A1&_n8n_link_nonce=${nonce}`;
  const shortened = await generateShortUrlForDisparos(accessUrlRaw);
  const shortUrl = shortened.shortUrl;
  const briefing = String(config.aiBriefing || "");
  const prompt = buildDisparosAiPrompt({
    briefing,
    tone: String(config.aiTone || "consultivo"),
    audience: String(config.aiAudience || "CORBAN"),
    cta: String(config.aiCta || "Responda no link abaixo"),
    objective: "gerar mensagem de prospeccao via WhatsApp",
    accessLink: shortUrl,
  });
  const generated = await callOpenAiGenerateMessage({
    prompt,
    model: OPENAI_MODEL,
    maxOutputTokens: 220,
  });
  return {
    text: ensureMessageContainsLink(
      generated.text,
      shortUrl,
      String(config.aiCta || "Responda no link abaixo")
    ),
    shortUrl,
  };
}

async function persistLeadSentAndCampaignCount(
  campaignId: string,
  leadId: string,
  nextSentCount: number,
  payload?: { shortUrl?: string | null; messageText?: string | null }
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const sentAt = new Date().toISOString();
    const shortUrl = String(payload?.shortUrl || "").trim();
    const messageText = String(payload?.messageText || "").trim();
    try {
      await (supabase.from("disparos_campaign_leads" as any) as any)
        .update({
          status: "sent",
          sent_at: sentAt,
          short_url: shortUrl || null,
          message_text: messageText || null,
        })
        .eq("id", leadId);
    } catch {
      await (supabase.from("disparos_campaign_leads" as any) as any)
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", leadId);
    }
    await (supabase.from("disparos_campaigns" as any) as any)
      .update({ sent_count: nextSentCount })
      .eq("id", campaignId);
  } catch {
    /* */
  }
  queuePersistDisparosLocalState();
}

async function persistLeadFailed(lead: DisparosCampaignLead, kind: LeadFailureKind): Promise<void> {
  lead.status = "failed";
  lead.failureKind = kind;
  lead.messageText = undefined;
  lead.sentAt = null;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await (supabase.from("disparos_campaign_leads" as any) as any)
      .update({ status: "failed" })
      .eq("id", lead.id);
  } catch {
    /* */
  }
  queuePersistDisparosLocalState();
}

function scheduleNextCampaignDispatchDelay(campaignId: string, config: DisparosConfig) {
  const minS = Math.max(10, Number(config.delayMinSeconds) || DISPAROS_DEFAULTS.delayMinSeconds);
  const maxS = Math.max(minS, Number(config.delayMaxSeconds) || DISPAROS_DEFAULTS.delayMaxSeconds);
  const waitSec = minS + Math.random() * (maxS - minS);
  campaignNextAllowedSendAt.set(campaignId, Date.now() + waitSec * 1000);
}

async function processOneCampaignDispatch(campaignId: string): Promise<void> {
  const campaign = disparosCampaignsMemory.find((c) => c.id === campaignId);
  if (!campaign || campaign.status !== "running") return;

  const nextAt = campaignNextAllowedSendAt.get(campaignId) || 0;
  if (Date.now() < nextAt) return;

  const lead = disparosCampaignLeadsMemory.find(
    (l) => l.campaignId === campaignId && l.status === "pending"
  );
  if (!lead) {
    campaign.status = "finished";
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ status: "finished" })
          .eq("id", campaignId);
      } catch {
        /* */
      }
    }
    queuePersistDisparosLocalState();
    return;
  }

  let outbound: { text: string; shortUrl: string | null };
  try {
    outbound = await composeOutboundMessageForConfig(campaign.configSnapshot);
  } catch (err) {
    console.error("[Campanha] Falha ao montar mensagem:", err);
    return;
  }

  const instancePick = await pickDisparadorInstanceForConfig(campaign.configSnapshot);
  if (!instancePick) {
    console.error(
      "[Campanha] Nenhuma instância disponível entre as selecionadas no snapshot da campanha (conectadas + com Disparador ativo)."
    );
    return;
  }

  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instancePick.instancia);
  const numero = normalizeWhatsAppNumber(lead.phone);
  const digitsCheck = String(numero || "").replace(/\D/g, "");
  if (!isPlausibleBrWhatsappDestinationDigits(digitsCheck)) {
    await persistLeadFailed(lead, "invalid_phone");
    scheduleNextCampaignDispatchDelay(campaignId, campaign.configSnapshot);
    return;
  }
  const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
    ? { number: numero, textMessage: { text: outbound.text } }
    : { number: numero, text: outbound.text, textMessage: { text: outbound.text } };
  const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
  if (!sendResult.ok) {
    console.error(
      "[Campanha] EVO send falhou:",
      sendResult.status,
      String(sendResult.body || "").slice(0, 200)
    );
    const failKind = classifyEvoSendFailure(sendResult.status, sendResult.body);
    await persistLeadFailed(lead, failKind);
    scheduleNextCampaignDispatchDelay(campaignId, campaign.configSnapshot);
    return;
  }

  const sentIso = new Date().toISOString();
  lead.status = "sent";
  lead.messageText = outbound.text;
  lead.sentAt = sentIso;
  lead.shortUrl = outbound.shortUrl || undefined;
  campaign.sentCount += 1;
  recordInstanceDailySend(instancePick.instancia);
  const ownerEmail = String(campaign.ownerEmail || "").trim();
  if (ownerEmail) {
    disparosCreditsService.recordShipmentConsumed(ownerEmail, 1);
  }
  await persistLeadSentAndCampaignCount(campaign.id, lead.id, campaign.sentCount, {
    shortUrl: lead.shortUrl || null,
    messageText: lead.messageText || null,
  });

  scheduleNextCampaignDispatchDelay(campaignId, campaign.configSnapshot);
}

async function runCampaignDispatchTick(): Promise<void> {
  const nowSp = nowInSaoPaulo();
  let evoRows: EvoInstanceTagRow[] = [];
  try {
    evoRows = await fetchEvoInstanceTagRows();
  } catch {
    evoRows = [];
  }
  const running = disparosCampaignsMemory.filter((c) => c.status === "running");
  for (const c of running) {
    const health = getCampaignInstanceHealth(c.configSnapshot, evoRows);
    if (health.shouldPauseByDisconnectedRatio) {
      c.status = "paused";
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await (supabase.from("disparos_campaigns" as any) as any)
            .update({ status: "paused" })
            .eq("id", c.id);
        } catch {
          /* */
        }
      }
      queuePersistDisparosLocalState();
      continue;
    }
    const snap = c.configSnapshot || DISPAROS_DEFAULTS;
    const janela = isDisparosWindowOpen(snap, nowSp);
    if (!janela.aberta) {
      continue;
    }
    await processOneCampaignDispatch(c.id);
  }
}

/** Para aquecedor + todas as campanhas com disparo em andamento (memória e Postgres). */
async function stopAllDispatchActivityOnServer(): Promise<{ pausedCampaignIds: string[] }> {
  stopAquecedorRuntime();
  const pausedSet = new Set<string>();

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: rows } = await (supabase
        .from("disparos_campaigns" as any)
        .select("id")
        .eq("status", "running")) as any;
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const id = String(r?.id || "").trim();
          if (id) pausedSet.add(id);
        }
      }
      await (supabase.from("disparos_campaigns" as any) as any)
        .update({ status: "paused" })
        .eq("status", "running");
    } catch (e) {
      console.error("[parar-envios] atualização Supabase:", e);
    }
  }

  for (const c of disparosCampaignsMemory) {
    if (c.status === "running") {
      c.status = "paused";
      pausedSet.add(c.id);
    }
  }

  queuePersistDisparosLocalState();
  void persistAquecedorRuntimeIntent(false, null);
  return { pausedCampaignIds: Array.from(pausedSet) };
}

function countCampaignLeadsProcessed(campaignId: string, sentFallback: number, totalNumbers: number): number {
  const memLeads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === campaignId);
  if (memLeads.length > 0) {
    return memLeads.filter((l) => l.status !== "pending").length;
  }
  const sent = Number(sentFallback || 0);
  const cap = Number(totalNumbers || 0);
  if (cap > 0) return Math.min(cap, sent);
  return sent;
}

/** Progresso = destinos já processados (enviado ou falha), sem reenvio; pendências não entram. */
function progressPercentForCampaignListItem(
  campaignId: string,
  totalNumbers: number,
  sentCount: number
): number {
  const total = Number(totalNumbers || 0);
  if (total <= 0) return 0;
  const processed = countCampaignLeadsProcessed(campaignId, sentCount, totalNumbers);
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

app.post(
  "/disparos/campanhas",
  (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (isDisparosCampaignCreatePost(req) && ct.includes("multipart/form-data")) {
      return uploadCampaignSpreadsheet.single("spreadsheet")(req, res, (err) => {
        if (err) {
          const limitErr = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
          const msg = limitErr
            ? "Arquivo acima do limite. Ajuste CAMPAIGN_UPLOAD_MAX_MB ou use planilha menor."
            : (err as Error).message || "Falha no upload da planilha.";
          return res.status(400).json({ error: msg });
        }
        next();
      });
    }
    next();
  },
  async (req, res) => {
  try {
    let name: string;
    let numbers: string[];
    let configSnapshot: DisparosConfig;
    let duplicatesRemoved = 0;

    const ct = String(req.headers["content-type"] || "");
    if (ct.includes("multipart/form-data") && req.file) {
      name = String(req.body?.name || "").trim();
      const numberColumn = String(req.body?.numberColumn || "").trim();
      let rawConfig: any = {};
      try {
        rawConfig = JSON.parse(String(req.body?.configSnapshot || "{}"));
      } catch {
        rawConfig = {};
      }
      configSnapshot = parseDisparosConfig(rawConfig);
      if (!numberColumn) {
        return res.status(400).json({ error: "Coluna do número é obrigatória." });
      }
      try {
        const extracted = extractNumbersFromXlsxBuffer(req.file.buffer, numberColumn);
        numbers = extracted.phones;
        duplicatesRemoved = extracted.removedDuplicates;
      } catch (e: any) {
        return res.status(400).json({
          error: e?.message || "Não foi possível ler a planilha enviada.",
        });
      }
    } else {
      name = String(req.body?.name || "").trim();
      const numbersRaw = Array.isArray(req.body?.numbers) ? req.body.numbers : [];
      configSnapshot = parseDisparosConfig(req.body?.configSnapshot || {});
      const bucket = numbersRaw
        .map((n: any) => normalizeCampaignPhone(String(n || "")))
        .filter((n: string) => n.length >= 12);
      const extracted = deduplicateCampaignDestinationPhones(bucket);
      numbers = extracted.phones;
      duplicatesRemoved = extracted.removedDuplicates;
    }

    if (!name) {
      return res.status(400).json({ error: "Nome da campanha é obrigatório." });
    }
    if (!numbers.length) {
      return res.status(400).json({ error: "Nenhum número válido foi encontrado na planilha." });
    }

    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = String(auth.email || "").trim().toLowerCase() || undefined;

    let importedLineCount = numbers.length;
    if (ct.includes("multipart/form-data") && req.file) {
      importedLineCount = countSpreadsheetImportedRows(req.file.buffer);
    }
    if (importedLineCount < 1) {
      importedLineCount = numbers.length;
    }

    let plannedSendCount = importedLineCount;
    if (ownerEmail && !disparosCreditsService.isMasterUnlimited(ownerEmail)) {
      const remaining = disparosCreditsService.getCreditsSummary(ownerEmail).remainingShipments;
      if (remaining <= 0) {
        return res.status(400).json({
          error:
            "Você não possui envios contratados disponíveis. Contrate um pacote antes de criar a campanha.",
        });
      }
      plannedSendCount = Math.min(importedLineCount, remaining);
      numbers = numbers.slice(0, plannedSendCount);
      if (!numbers.length) {
        return res.status(400).json({
          error: "Não há números válidos suficientes na planilha para os envios disponíveis.",
        });
      }
      disparosCreditsService.recordShipmentConsumed(ownerEmail, numbers.length);
    }

    if (ownerEmail && (await shouldApplyAlternativaDispatchProfile(ownerEmail))) {
      try {
        await assertAlternativaDispatchReady(ownerEmail);
      } catch (err: any) {
        return res.status(400).json({
          error: err?.message || "Requisitos da API Alternativa não atendidos.",
        });
      }
      configSnapshot = applyAlternativaDispatchProfile(configSnapshot);
    }

    const campaignInstances =
      Array.isArray(configSnapshot.selectedDisparadorInstances)
        ? configSnapshot.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
        : [];
    if (!campaignInstances.length) {
      return res.status(400).json({
        error:
          "Selecione ao menos uma instância na lista «Números utilizados no disparador» (Seção 1) antes de criar a campanha. Só essas instâncias poderão enviar as mensagens.",
      });
    }

    const now = new Date().toISOString();
    const campaignId = crypto.randomUUID();
    const campaign: DisparosCampaign = {
      id: campaignId,
      name,
      createdAt: now,
      status: "paused",
      totalNumbers: numbers.length,
      sentCount: 0,
      ownerEmail,
      configSnapshot,
    };
    const leads: DisparosCampaignLead[] = numbers.map((phone) => ({
      id: crypto.randomUUID(),
      campaignId,
      phone,
      status: "pending",
      createdAt: now,
      sentAt: null,
    }));

    disparosCampaignsMemory.unshift(campaign);
    disparosCampaignLeadsMemory.unshift(...leads);

    const supabase = getSupabaseClient();
    let persistedCampaignToSupabase = !supabase;
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any).insert({
          id: campaign.id,
          campaign_name: campaign.name,
          status: campaign.status,
          total_numbers: campaign.totalNumbers,
          sent_count: campaign.sentCount,
          config_snapshot: campaign.configSnapshot,
          created_at: campaign.createdAt,
        });
        await (supabase.from("disparos_campaign_leads" as any) as any).insert(
          leads.map((lead) => ({
            id: lead.id,
            campaign_id: lead.campaignId,
            phone: lead.phone,
            status: lead.status,
            created_at: lead.createdAt,
            sent_at: lead.sentAt,
          }))
        );
        persistedCampaignToSupabase = true;
      } catch (dbErr) {
        console.error(
          "[Campanha] Falha ao gravar campanha/leads no Supabase (dados ficam na memória e em data/disparos-local-state.json):",
          dbErr
        );
      }
    }

    queuePersistDisparosLocalState();

    const msgExtra =
      duplicatesRemoved > 0
        ? ` Foram ignoradas ${duplicatesRemoved} linha(s) com número duplicado (cada destino recebe no máximo uma mensagem).`
        : "";
    const importSummary =
      plannedSendCount < importedLineCount
        ? `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${numbers.length} envios (limite do seu pacote contratado).`
        : `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${numbers.length} envios.`;

    return res.json({
      ok: true,
      message:
        "Campanha criada com sucesso. Ative-a à direita para iniciar os disparos." + msgExtra,
      duplicatesRemoved,
      importedLineCount,
      plannedSendCount: numbers.length,
      importSummary,
      durability: {
        /** Sempre que `queuePersistDisparosLocalState` rodou após criar. */
        localStateFile: true,
        /** Só true se insert no Postgres concluiu (ou Supabase não configurado). */
        supabase: persistedCampaignToSupabase,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt,
        status: campaign.status,
        totalNumbers: campaign.totalNumbers,
        sentCount: campaign.sentCount,
        progressPercent: 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar campanha." });
  }
});

app.get("/disparos/campanhas", async (req, res) => {
  try {
    type CampaignRuntimeStage = {
      phase: "draft" | "sending" | "waiting_interval" | "outside_window" | "paused" | "finished";
      label: string;
      detail: string;
      fillPercent: number;
    };
    const buildCampaignRuntimeStage = (
      item: { id: string; status: string },
      configSnapshot: DisparosConfig | undefined,
      nowSp: Date
    ): CampaignRuntimeStage => {
      const st = String(item.status || "").toLowerCase();
      if (st === "finished") {
        return {
          phase: "finished",
          label: "Finalizada",
          detail: "Todos os destinos foram processados.",
          fillPercent: 100,
        };
      }
      if (st === "paused") {
        return {
          phase: "paused",
          label: "Pausada",
          detail: "Pausa manual ou automática por regra de saúde.",
          fillPercent: 100,
        };
      }
      if (st === "draft") {
        return {
          phase: "draft",
          label: "Rascunho",
          detail: "Campanha criada e aguardando ativação.",
          fillPercent: 14,
        };
      }
      const snap = configSnapshot || DISPAROS_DEFAULTS;
      const janela = isDisparosWindowOpen(snap, nowSp);
      if (!janela.aberta) {
        return {
          phase: "outside_window",
          label: "Fora do expediente",
          detail: `Fora do expediente · ${janela.motivo}`,
          fillPercent: 24,
        };
      }
      const nextAt = campaignNextAllowedSendAt.get(item.id) || 0;
      if (nextAt > Date.now()) {
        const secs = Math.max(1, Math.ceil((nextAt - Date.now()) / 1000));
        return {
          phase: "waiting_interval",
          label: "Aguardando intervalo",
          detail: `Pausa operacional entre envios (${secs}s restantes).`,
          fillPercent: 56,
        };
      }
      return {
        phase: "sending",
        label: "Enviando agora",
        detail: "Elegível para envio neste ciclo.",
        fillPercent: 90,
      };
    };

    const mapRowToItem = (row: any) => {
      const id = String(row?.id || "");
      const total = Number(row?.total_numbers ?? row?.totalNumbers ?? 0);
      const sent = Number(row?.sent_count ?? row?.sentCount ?? 0);
      const progressPercent = progressPercentForCampaignListItem(id, total, sent);
      const processedCount = countCampaignLeadsProcessed(id, sent, total);
      const nextAllowedAtMs = campaignNextAllowedSendAt.get(id) || 0;
      return {
        id,
        name: String(row?.campaign_name ?? (row?.name || "")),
        status: String(row?.status || "paused"),
        createdAt: String(row?.created_at ?? (row?.createdAt || "")),
        totalNumbers: total,
        sentCount: sent,
        processedCount,
        progressPercent,
        nextAllowedAt: nextAllowedAtMs > 0 ? new Date(nextAllowedAtMs).toISOString() : null,
      };
    };

    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        createdAt: string;
        totalNumbers: number;
        sentCount: number;
        processedCount: number;
        progressPercent: number;
        nextAllowedAt: string | null;
      }
    >();

    const configByCampaignId = new Map<string, DisparosConfig>();

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let rows: any[] | null = null;
        const withSnap = await (supabase
          .from("disparos_campaigns" as any)
          .select("id, campaign_name, status, total_numbers, sent_count, created_at, config_snapshot")
          .order("created_at", { ascending: false })
          .limit(200)) as any;
        if (withSnap.error) {
          const noSnap = await (supabase
            .from("disparos_campaigns" as any)
            .select("id, campaign_name, status, total_numbers, sent_count, created_at")
            .order("created_at", { ascending: false })
            .limit(200)) as any;
          if (!noSnap.error && Array.isArray(noSnap.data)) {
            rows = noSnap.data;
          }
        } else if (Array.isArray(withSnap.data)) {
          rows = withSnap.data;
        }
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const item = mapRowToItem(row);
            if (item.id) {
              byId.set(item.id, item);
              try {
                const snap = row?.config_snapshot;
                if (snap != null) {
                  const raw = typeof snap === "string" ? JSON.parse(snap) : snap;
                  configByCampaignId.set(item.id, parseDisparosConfig(raw));
                }
              } catch {
                /* */
              }
            }
          }
        }
      } catch {
        /* */
      }
    }

    for (const c of disparosCampaignsMemory) {
      const total = Number(c.totalNumbers || 0);
      const sent = Number(c.sentCount || 0);
      const progressPercent = progressPercentForCampaignListItem(c.id, total, sent);
      const processedCount = countCampaignLeadsProcessed(c.id, sent, total);
      byId.set(c.id, {
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt,
        totalNumbers: total,
        sentCount: sent,
        processedCount,
        progressPercent,
        nextAllowedAt:
          (campaignNextAllowedSendAt.get(c.id) || 0) > 0
            ? new Date(campaignNextAllowedSendAt.get(c.id) || 0).toISOString()
            : null,
      });
      configByCampaignId.set(c.id, c.configSnapshot);
    }

    const evoRows = await fetchEvoInstanceTagRowsForRequest(req);
    const globalDisparos = await loadDisparosConfigFromDb();
    const auth = resolveWabaRequestAuth(req);
    const globalSelected = await wabaFazendaPoolService.filterDisparadorInstancesForAuth(
      auth,
      Array.isArray(globalDisparos.selectedDisparadorInstances)
        ? globalDisparos.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
        : []
    );
    const nowSp = nowInSaoPaulo();

    const items = Array.from(byId.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => {
        const snapshotTags = disparadorInstanceTagsForCampaign(
          configByCampaignId.get(item.id),
          evoRows
        );
        const st = String(item.status || "").toLowerCase();
        const useGlobal =
          !snapshotTags.length && st === "running" && globalSelected.length > 0;
        const tags = useGlobal
          ? disparadorInstanceTagsForCampaign(
              { ...DISPAROS_DEFAULTS, selectedDisparadorInstances: globalSelected },
              evoRows
            )
          : snapshotTags;
        const selectedCount = tags.length;
        const connectedCount = tags.filter((t) => t.connected === true).length;
        const disconnectedCount = Math.max(0, selectedCount - connectedCount);
        const disconnectedPercent =
          selectedCount > 0 ? Math.round((disconnectedCount / selectedCount) * 100) : 0;
        const shouldPauseByDisconnectedRatio =
          selectedCount > 0 && disconnectedCount / selectedCount >= 0.5;
        const runtimeStage = buildCampaignRuntimeStage(
          item,
          configByCampaignId.get(item.id),
          nowSp
        );
        return {
          ...item,
          disparadorInstances: tags,
          disparadorInstancesFromGlobalFallback: Boolean(useGlobal && tags.length > 0),
          instanceHealth: {
            selectedCount,
            connectedCount,
            disconnectedCount,
            disconnectedPercent,
            shouldPauseByDisconnectedRatio,
          },
          runtimeStage,
        };
      });

    return res.json({ items });
  } catch {
    return res.status(500).json({ error: "Erro ao listar campanhas do Disparador." });
  }
});

async function fetchLeadsFromDbForCampaignReport(
  campaignId: string
): Promise<DisparosCampaignLead[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await (supabase
      .from("disparos_campaign_leads" as any)
      .select("id, campaign_id, phone, status, created_at, sent_at")
      .eq("campaign_id", campaignId)) as any;
    if (error || !Array.isArray(data)) return [];
    return data.map((lr: any) => {
      const st = String(lr?.status || "pending").toLowerCase();
      const status: DisparosCampaignLead["status"] =
        st === "sent" ? "sent" : st === "failed" ? "failed" : "pending";
      return {
        id: String(lr?.id || crypto.randomUUID()),
        campaignId: String(lr?.campaign_id || campaignId),
        phone: String(lr?.phone || ""),
        status,
        failureKind: status === "failed" ? ("send_error" as LeadFailureKind) : undefined,
        createdAt: String(lr?.created_at || new Date().toISOString()),
        sentAt: lr?.sent_at ? String(lr.sent_at) : null,
      };
    });
  } catch {
    return [];
  }
}

async function fetchCampaignHeaderFromDb(campaignId: string): Promise<DisparosCampaign | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data: row } = await (supabase
      .from("disparos_campaigns" as any)
      .select("id, campaign_name, status, total_numbers, sent_count, created_at")
      .eq("id", campaignId)
      .maybeSingle()) as any;
    if (!row?.id) return null;
    return {
      id: String(row.id),
      name: String(row.campaign_name || ""),
      createdAt: String(row.created_at || new Date().toISOString()),
      status: (String(row.status || "paused") as DisparosCampaign["status"]) || "paused",
      totalNumbers: Number(row.total_numbers || 0),
      sentCount: Number(row.sent_count || 0),
      configSnapshot: { ...DISPAROS_DEFAULTS },
    };
  } catch {
    return null;
  }
}

app.get("/disparos/campanhas/:id/relatorio", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }

    let leads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === id);
    if (!leads.length) {
      leads = await fetchLeadsFromDbForCampaignReport(id);
    }

    let campaign = disparosCampaignsMemory.find((c) => c.id === id) || null;
    if (!campaign) {
      campaign = await fetchCampaignHeaderFromDb(id);
    }

    if (!campaign && !leads.length) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }

    const totalNumeros =
      campaign?.totalNumbers && campaign.totalNumbers > 0
        ? campaign.totalNumbers
        : Math.max(leads.length, 1);

    let enviadosComSucesso = 0;
    let totalCliques = 0;
    let invalidPhone = 0;
    let destinationError = 0;
    let falhaTecnica = 0;
    let pendentes = 0;
    for (const l of leads) {
      if (l.status === "sent") enviadosComSucesso += 1;
      else if (l.status === "failed") {
        const k = l.failureKind;
        if (k === "invalid_phone") invalidPhone += 1;
        else if (k === "destination_error") destinationError += 1;
        else falhaTecnica += 1;
      } else pendentes += 1;
    }

    const sentLeadsWithShortUrl = leads.filter((l) => l.status === "sent" && !!l.shortUrl);
    const uniqueShortUrls = Array.from(
      new Set(sentLeadsWithShortUrl.map((l) => String(l.shortUrl)))
    ).slice(0, 25);
    const cliqueChecksDisponiveis = uniqueShortUrls.length;
    for (const shortUrl of uniqueShortUrls) {
      const clicks = await fetchClicksForShortUrl(String(shortUrl));
      totalCliques += clicks;
    }
    const cliqueChecksExecutados = uniqueShortUrls.length;

    const numerosErrados = invalidPhone + destinationError;
    const totalProcessados = enviadosComSucesso + numerosErrados + falhaTecnica;
    const top = Math.max(totalNumeros, leads.length, 1);
    const pct = (n: number) => Math.round((n / top) * 1000) / 10;
    const conversaoPercent =
      enviadosComSucesso > 0 ? Math.round((totalCliques / enviadosComSucesso) * 1000) / 10 : 0;

    const funnel = [
      {
        key: "total",
        label: "Total na campanha",
        count: top,
        pctOfTop: 100,
      },
      {
        key: "success",
        label: "Enviados com sucesso",
        count: enviadosComSucesso,
        pctOfTop: pct(enviadosComSucesso),
      },
      {
        key: "conversion",
        label: "Conversão (cliques)",
        count: totalCliques,
        pctOfTop: Math.max(0, Math.min(100, Number(conversaoPercent) || 0)),
        isConversion: true,
        pctLabelMode: "success",
      },
      {
        key: "wrong",
        label: "Número / destino inválido",
        count: numerosErrados,
        pctOfTop: pct(numerosErrados),
      },
      {
        key: "tech",
        label: "Falha técnica (API / rede)",
        count: falhaTecnica,
        pctOfTop: pct(falhaTecnica),
      },
    ];
    if (pendentes > 0) {
      funnel.push({
        key: "pending",
        label: "Ainda não processados",
        count: pendentes,
        pctOfTop: pct(pendentes),
      });
    }

    return res.json({
      campaignId: id,
      name: campaign?.name ?? "—",
      status: campaign?.status ?? "—",
      totalNumeros: top,
      totalProcessados,
      enviadosComSucesso,
      clicaramNoLink: totalCliques,
      conversaoPercent,
      conversaoTexto: `${conversaoPercent.toFixed(1)}% (${totalCliques}/${enviadosComSucesso})`,
      cliqueChecksExecutados,
      cliqueChecksDisponiveis,
      numerosErrados,
      textoNumerosErrados: `Foram processados ${totalProcessados} contatos; destes, ${numerosErrados} com telefone/destino inválido ou indisponível no WhatsApp.`,
      detalheErros: {
        formatoOuNumeroInvalido: invalidPhone,
        destinoWhatsAppIndisponivel: destinationError,
        falhaTecnica,
      },
      pendentes,
      funnel,
    });
  } catch (error) {
    console.error("GET /disparos/campanhas/:id/relatorio", error);
    return res.status(500).json({ error: "Erro ao montar relatório da campanha." });
  }
});

app.get("/disparos/campanhas/:id/ultimo-disparo", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    const campaign =
      disparosCampaignsMemory.find((c) => c.id === id) || (await hydrateCampaignFromDbIfNeeded(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    let sentLeads = disparosCampaignLeadsMemory
      .filter((l) => l.campaignId === id && l.status === "sent")
      .sort((a, b) => {
        const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return tb - ta;
      });
    if (!sentLeads.length) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          let rows: any[] = [];
          const withMessage = await (supabase
            .from("disparos_campaign_leads" as any)
            .select("id, campaign_id, phone, status, created_at, sent_at, short_url, message_text")
            .eq("campaign_id", id)
            .eq("status", "sent")
            .order("sent_at", { ascending: false })
            .limit(1)) as any;
          if (!withMessage.error && Array.isArray(withMessage.data)) {
            rows = withMessage.data;
          } else {
            const legacy = await (supabase
              .from("disparos_campaign_leads" as any)
              .select("id, campaign_id, phone, status, created_at, sent_at")
              .eq("campaign_id", id)
              .eq("status", "sent")
              .order("sent_at", { ascending: false })
              .limit(1)) as any;
            if (!legacy.error && Array.isArray(legacy.data)) rows = legacy.data;
          }
          if (rows.length) {
            const r = rows[0];
            sentLeads = [
              {
                id: String(r?.id || crypto.randomUUID()),
                campaignId: String(r?.campaign_id || id),
                phone: String(r?.phone || ""),
                status: "sent",
                messageText: typeof r?.message_text === "string" ? String(r.message_text) : undefined,
                shortUrl: typeof r?.short_url === "string" ? String(r.short_url) : undefined,
                createdAt: String(r?.created_at || new Date().toISOString()),
                sentAt: r?.sent_at ? String(r.sent_at) : null,
              },
            ];
          }
        } catch {
          /* */
        }
      }
    }
    const last = sentLeads[0];
    const message = String(last?.messageText || "").trim();
    const shortUrl = String(last?.shortUrl || "").trim();
    return res.json({
      campaignId: id,
      campaignName: campaign.name,
      found: Boolean(last),
      sentAt: last?.sentAt || null,
      phone: last?.phone || null,
      message: message || null,
      shortUrl: shortUrl || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar último disparo." });
  }
});

app.post("/disparos/parar-envios", async (_req, res) => {
  try {
    const { pausedCampaignIds } = await stopAllDispatchActivityOnServer();
    return res.json({
      ok: true,
      message:
        "Envios interrompidos: aquecedor parado e campanhas em execução foram pausadas (se houver).",
      aquecedorRodando: aquecedorRuntime.running,
      campanhasPausadas: pausedCampaignIds.length,
      idsCampanhasPausadas: pausedCampaignIds,
    });
  } catch (error: any) {
    console.error("POST /disparos/parar-envios", error);
    return res.status(500).json({ error: error?.message || "Erro ao parar envios." });
  }
});

app.post("/disparos/campanhas/:id/estado", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    const ativa = req.body?.ativa === true;
    const nextStatus: DisparosCampaign["status"] = ativa ? "running" : "paused";

    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    if (!campaign) {
      campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    if (ativa && campaign.status === "finished") {
      return res.status(409).json({
        error:
          "Campanha já finalizada: cada número da lista foi processado uma vez (envio ou falha). Crie uma nova campanha para novo disparo.",
      });
    }
    if (ativa) {
      const ownerEmail = String(campaign.ownerEmail || "").trim().toLowerCase();
      if (ownerEmail) {
        try {
          await assertAlternativaDispatchReady(ownerEmail);
        } catch (err: any) {
          return res.status(400).json({
            error: err?.message || "Requisitos da API Alternativa não atendidos.",
          });
        }
      }
      let evoRows: EvoInstanceTagRow[] = [];
      try {
        evoRows = await fetchEvoInstanceTagRows();
      } catch {
        evoRows = [];
      }
      const health = getCampaignInstanceHealth(campaign.configSnapshot, evoRows);
      if (health.shouldPauseByDisconnectedRatio) {
        return res.status(409).json({
          error:
            "Campanha bloqueada para ativação: 50% ou mais das instâncias selecionadas estão desconectadas. Use o botão '+ Instâncias' para ampliar a base conectada.",
          instanceHealth: health,
        });
      }
    }
    campaign.status = nextStatus;
    if (ativa) {
      campaignNextAllowedSendAt.set(id, 0);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ status: nextStatus })
          .eq("id", id);
      } catch {
        /* */
      }
    }

    queuePersistDisparosLocalState();

    return res.json({
      ok: true,
      id,
      status: nextStatus,
      ativa,
      message: ativa ? "Campanha ativada. Os disparos serão processados em sequência." : "Campanha pausada.",
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar estado da campanha." });
  }
});

/**
 * Atualiza trechos do `config_snapshot` (expediente, delays, etc.) sem recriar a campanha.
 * Corpo parcial é mesclado ao snapshot atual e revalidado com `parseDisparosConfig`.
 */
app.patch("/disparos/campanhas/:id/config", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    if (!campaign) {
      campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    const prev = campaign.configSnapshot || { ...DISPAROS_DEFAULTS };
    const merged: Record<string, unknown> = {
      ...prev,
      ...body,
    };
    if (body.selected_disparador_instances != null && body.selectedDisparadorInstances == null) {
      merged.selectedDisparadorInstances = body.selected_disparador_instances;
    }
    campaign.configSnapshot = parseDisparosConfig(merged);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ config_snapshot: campaign.configSnapshot })
          .eq("id", id);
      } catch {
        /* */
      }
    }

    queuePersistDisparosLocalState();

    return res.json({
      ok: true,
      id,
      configSnapshot: campaign.configSnapshot,
      message: "Configuração da campanha atualizada.",
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar config da campanha." });
  }
});

app.post("/disparos/campanhas/:id/instancias", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    const raw = Array.isArray(req.body?.instanceNames) ? req.body.instanceNames : [];
    const incoming = await wabaFazendaPoolService.filterDisparadorInstancesForAuth(
      resolveWabaRequestAuth(req),
      raw.map((n: any) => String(n || "").trim()).filter(Boolean)
    );
    if (!incoming.length) {
      return res.status(400).json({ error: "Informe ao menos uma instância válida para adicionar." });
    }

    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    if (!campaign) {
      campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }

    const prev = campaign.configSnapshot || { ...DISPAROS_DEFAULTS };
    const prevSelected = Array.isArray(prev.selectedDisparadorInstances)
      ? prev.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
    const mergedSelected = Array.from(new Set([...prevSelected, ...incoming]));
    campaign.configSnapshot = parseDisparosConfig({
      ...prev,
      selectedDisparadorInstances: mergedSelected,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ config_snapshot: campaign.configSnapshot })
          .eq("id", id);
      } catch {
        /* */
      }
    }

    queuePersistDisparosLocalState();

    let evoRows: EvoInstanceTagRow[] = [];
    try {
      evoRows = await fetchEvoInstanceTagRowsForRequest(req);
    } catch {
      evoRows = [];
    }
    const instanceHealth = getCampaignInstanceHealth(campaign.configSnapshot, evoRows);

    return res.json({
      ok: true,
      id,
      selectedDisparadorInstances: campaign.configSnapshot.selectedDisparadorInstances,
      addedCount: Math.max(0, mergedSelected.length - prevSelected.length),
      instanceHealth,
      message: "Instâncias adicionadas à campanha.",
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao adicionar instâncias na campanha." });
  }
});

app.patch("/disparos/campanhas/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    if (!name) {
      return res.status(400).json({ error: "Nome da campanha é obrigatório." });
    }
    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    if (!campaign) {
      campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
    }
    const supabase = getSupabaseClient();
    if (!campaign && supabase) {
      try {
        const { data: rows, error } = await (supabase.from("disparos_campaigns" as any) as any)
          .update({ campaign_name: name })
          .eq("id", id)
          .select("id, campaign_name, status, total_numbers, sent_count, created_at");
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (!error && row?.id) {
          await hydrateCampaignFromDbIfNeeded(id);
          const c2 = disparosCampaignsMemory.find((c) => c.id === id);
          if (c2) c2.name = name;
          const total = Number(row.total_numbers || 0);
          const sent = Number(row.sent_count || 0);
          queuePersistDisparosLocalState();
          return res.json({
            ok: true,
            message: "Nome da campanha atualizado.",
            campaign: {
              id: String(row.id),
              name,
              createdAt: String(row.created_at || ""),
              status: String(row.status || "paused"),
              totalNumbers: total,
              sentCount: sent,
              progressPercent:
                total > 0 ? Math.max(0, Math.min(100, Math.round((sent / total) * 100))) : 0,
            },
          });
        }
      } catch {
        /* */
      }
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    campaign.name = name;
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ campaign_name: name })
          .eq("id", id);
      } catch {
        /* */
      }
    }
    queuePersistDisparosLocalState();
    return res.json({
      ok: true,
      message: "Nome da campanha atualizado.",
      campaign: {
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt,
        status: campaign.status,
        totalNumbers: campaign.totalNumbers,
        sentCount: campaign.sentCount,
        progressPercent:
          campaign.totalNumbers > 0
            ? Math.max(0, Math.min(100, Math.round((campaign.sentCount / campaign.totalNumbers) * 100)))
            : 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao renomear campanha." });
  }
});

app.delete("/disparos/campanhas/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
    }
    if (!disparosCampaignsMemory.find((c) => c.id === id)) {
      await hydrateCampaignFromDbIfNeeded(id);
    }
    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    const supabase = getSupabaseClient();
    if (!campaign && supabase) {
      try {
        await (supabase.from("disparos_campaign_leads" as any) as any).delete().eq("campaign_id", id);
        const { error: delCampErr, data: delData } = await (supabase.from("disparos_campaigns" as any) as any)
          .delete()
          .eq("id", id)
          .select("id");
        if (!delCampErr && Array.isArray(delData) && delData.length > 0) {
          queuePersistDisparosLocalState();
          return res.json({ ok: true, message: "Campanha excluída." });
        }
      } catch {
        /* */
      }
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    const idx = disparosCampaignsMemory.findIndex((c) => c.id === id);
    if (idx !== -1) disparosCampaignsMemory.splice(idx, 1);
    for (let k = disparosCampaignLeadsMemory.length - 1; k >= 0; k--) {
      if (disparosCampaignLeadsMemory[k].campaignId === id) disparosCampaignLeadsMemory.splice(k, 1);
    }
    campaignNextAllowedSendAt.delete(id);

    if (supabase) {
      try {
        await (supabase.from("disparos_campaign_leads" as any) as any).delete().eq("campaign_id", id);
        await (supabase.from("disparos_campaigns" as any) as any).delete().eq("id", id);
      } catch {
        /* memória já limpa */
      }
    }

    queuePersistDisparosLocalState();

    return res.json({ ok: true, message: "Campanha excluída." });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao excluir campanha." });
  }
});

configureWabaFazendaPool({ loadInstanceUsageMap });
registerWabaBillingRoutes(app);
registerWabaCampaignIntakeRoutes(app);
registerWabaSupportRoutes(app);
registerWabaAdminRoutes(app);
registerWabaOperacionalCampanhasRoutes(app);

new WabaSystemUserService().ensureBootstrapFromEnvMaster();

app.listen(PORT, () => {
  const publicRoot = BASE_PATH
    ? `http://localhost:${PORT}${BASE_PATH}/`
    : `http://localhost:${PORT}/`;
  console.log(`Disparador N8 [${WABA_ENV}] - servidor rodando em ${publicRoot}`);
  if (BASE_PATH) {
    console.log(`[base-path] prefixo público: ${BASE_PATH}`);
  }
  draxLogoBytes = undefined;
  const logoProbe = resolveDraxLogoPng();
  console.log(
    `[brand] logo PNG: ${logoProbe ? `${logoProbe.length} bytes (ok)` : "FALHOU — embed vazio ou ficheiros em falta"} | use GET /logo.png ou /media/Drax-logo-footer.png`
  );
  console.log(
    `[runtime] mode=${RUNTIME_MODE} backgroundProcessing=${ENABLE_BACKGROUND_PROCESSING} aquecedorProcessing=${ENABLE_AQUECEDOR_PROCESSING}`
  );
  console.log(
    `[evo] base=${describeEvoApiBaseForOps(EVO_API_BASE)} tlsInsecure=${isEvoTlsInsecure()} timeoutMs=${defaultEvoHttpTimeoutMs()}`
  );
  if (/walkup[-_]evo|evo-walkup-api:8080/i.test(EVO_API_BASE)) {
    console.warn(
      "[evo] EVO_API_URL parece hostname interno Docker/Swarm. Se QRCode falhar em producao, use https://walkup-evo-walkup-api.achpyp.easypanel.host ou http://172.17.0.1:30181"
    );
  }
  console.log(
    `[campanhas] upload planilha até ${Math.round(CAMPAIGN_UPLOAD_MAX_BYTES / 1024 / 1024)}MB (multipart) | JSON legado=${CAMPAIGN_CREATE_JSON_LIMIT}`
  );
  if (MAINTENANCE_MODE) {
    console.log(
      `[maintenance] ativo — tráfego de API bloqueado; probes em /health, /ready, /service/maintenance (porta ${PORT})`
    );
  }

  void (async () => {
    try {
      await loadDisparosLocalState();
      await syncDisparosCampaignsFromDbOnStartup();
    } catch (e) {
      console.error("[Campanhas] bootstrap (estado local + Supabase):", e);
    }

    setInterval(() => {
      queuePersistDisparosLocalState();
    }, DISPAROS_CHECKPOINT_MS);
    console.log(
      `[durabilidade] checkpoint campanhas a cada ${Math.round(DISPAROS_CHECKPOINT_MS / 1000)}s → data/disparos-local-state.json`
    );

    const desiredHeater = await loadAquecedorRuntimeIntent();
    if (
      desiredHeater.desired === true &&
      ENABLE_AQUECEDOR_PROCESSING &&
      !MAINTENANCE_MODE
    ) {
      aquecedorRuntimeOwnerEmail = desiredHeater.ownerEmail;
      if (!aquecedorRuntimeOwnerEmail) {
        console.warn(
          "[Aquecedor] runtime-intent pede motor ligado, mas sem aquecedorOwnerEmail — aguardando POST /aquecedor/start.",
        );
      } else {
        await syncAquecedorWorkerLeadership();
        console.log(
          "[Aquecedor] retomado após restart (data/runtime-intent.json — último «Iniciar» explícito).",
        );
      }
    }

    setInterval(() => {
      syncAquecedorWorkerLeadership().catch((err) =>
        console.error("[Aquecedor] sync worker:", err),
      );
    }, AQUECEDOR_WORKER_SYNC_MS);

    if (ENABLE_BACKGROUND_PROCESSING && !MAINTENANCE_MODE) {
      if (WABA_ENV === "v01") {
        console.log("[campanhas] Disparador EVO ativo (ambiente v01 — tick a cada 7s).");
      }
      setInterval(() => {
        runCampaignDispatchTick().catch((err) => console.error("[Campanhas] tick:", err));
      }, 7000);
    } else if (!ENABLE_BACKGROUND_PROCESSING) {
      console.log(
        WABA_ENV === "v01"
          ? "[campanhas] Disparador EVO desativado neste processo (WABA_EVO_DISPARADOR=false)."
          : "[campanhas] processamento automático desativado neste processo (dev isolado)."
      );
    }
  })();
});

