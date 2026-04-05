process.env.TZ = process.env.TZ || "America/Sao_Paulo";
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import crypto from "crypto";
import { promises as fs, existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const app = express();

/** UI estática: raiz do projeto e pasta dist (antes de middlewares que possam interferir). */
const rootPath = path.join(__dirname, "..");
const distPath = path.join(rootPath, "dist");

/** Logo DRAX: primeiro middleware — não depende da ordem das outras rotas. */
let draxLogoBytes: Buffer | null | undefined;
function resolveDraxLogoPng(): Buffer | null {
  if (draxLogoBytes !== undefined) {
    return draxLogoBytes;
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
    "[brand] Drax-logo-footer.png não encontrado. cwd=%s __dirname=%s tentou: %s",
    process.cwd(),
    __dirname,
    candidates.join(" | ")
  );
  return null;
}

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const raw =
    typeof req.path === "string" && req.path.length > 0
      ? req.path
      : String(req.url || "").split("?")[0] || "/";
  const norm = raw.replace(/\/+$/, "") || "/";
  if (norm.toLowerCase() !== "/media/drax-logo-footer.png") {
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

const PORT = process.env.PORT || 3000;
const RUNTIME_MODE = String(process.env.RUNTIME_MODE || "production").toLowerCase();
const ENABLE_BACKGROUND_PROCESSING = ["1", "true", "yes", "on"].includes(
  String(process.env.ENABLE_BACKGROUND_PROCESSING || "true").toLowerCase()
);

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

function isMaintenanceBypassPath(method: string, reqPath: string): boolean {
  const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
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
    port: PORT,
    maintenanceMode: MAINTENANCE_MODE,
    runtimeMode: RUNTIME_MODE,
    backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
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

// Supabase (criado sob demanda para evitar travamentos quando faltar config)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

function normalizeInstanceUsageRow(row: any): InstanceUsageConfig {
  return {
    useAquecedor: row?.use_aquecedor !== false,
    useDisparador: row?.use_disparador !== false,
    updatedAt: String(row?.updated_at || new Date().toISOString()),
  };
}

async function loadInstanceUsageMap(): Promise<Map<string, InstanceUsageConfig>> {
  const result = new Map<string, InstanceUsageConfig>();
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await (supabase
        .from("instancias_uso_config" as any)
        .select("instance_name, use_aquecedor, use_disparador, updated_at")
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
  items: Array<{ instanceName: string; useAquecedor: boolean; useDisparador: boolean }>
) {
  const now = new Date().toISOString();
  for (const item of items) {
    const key = String(item.instanceName || "").trim();
    if (!key) continue;
    instanceUsageMemory.set(key, {
      useAquecedor: item.useAquecedor !== false,
      useDisparador: item.useDisparador !== false,
      updatedAt: now,
    });
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const rows = items
      .map((item) => ({
        instance_name: String(item.instanceName || "").trim(),
        use_aquecedor: item.useAquecedor !== false,
        use_disparador: item.useDisparador !== false,
        updated_at: now,
      }))
      .filter((r) => r.instance_name);
    if (!rows.length) return;
    await (supabase.from("instancias_uso_config" as any) as any).upsert(rows, {
      onConflict: "instance_name",
    });
  } catch {
    // fallback em memória
  }
}

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
    provider === "encurtadorpro" || provider === "isgd" || provider === "tinyurl"
      ? (provider as DisparosConfig["shortenerProvider"])
      : "encurtadorpro";
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
const INSTANCE_ALIASES_FILE = path.join(process.cwd(), "data", "instance-aliases.json");
const WHATSAPP_PROFILE_NAMES_FILE = path.join(process.cwd(), "data", "whatsapp-profile-names.json");
/** Backup local de campanhas + leads (sobrevive a restart; não substitui Supabase quando ambos existem). */
const DISPAROS_LOCAL_STATE_FILE = path.join(process.cwd(), "data", "disparos-local-state.json");
/** Última intenção explícita: aquecedor ligado/desligado (retoma após restart do processo na porta 3000). */
const RUNTIME_INTENT_FILE = path.join(process.cwd(), "data", "runtime-intent.json");
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
  shortenerProvider: "encurtadorpro" | "isgd" | "tinyurl";
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
  shortenerProvider: "encurtadorpro",
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

async function persistAquecedorRuntimeDesired(desired: boolean): Promise<void> {
  try {
    await fs.mkdir(path.dirname(RUNTIME_INTENT_FILE), { recursive: true });
    const payload = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      aquecedorRuntimeDesired: desired,
    };
    const tmp = `${RUNTIME_INTENT_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(tmp, RUNTIME_INTENT_FILE);
    console.log(`[Runtime] runtime-intent: aquecedor desejado = ${desired ? "ligado" : "desligado"}.`);
  } catch (e) {
    console.error("[Runtime] falha ao gravar runtime-intent.json:", e);
  }
}

async function loadAquecedorRuntimeDesired(): Promise<boolean | null> {
  try {
    const raw = await fs.readFile(RUNTIME_INTENT_FILE, "utf-8");
    const p = JSON.parse(raw);
    if (p?.version !== 1 || typeof p.aquecedorRuntimeDesired !== "boolean") return null;
    return p.aquecedorRuntimeDesired;
  } catch {
    return null;
  }
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
let lastShortUrlIssued = "";
const shortUrlClicksCache = new Map<string, { clicks: number; checkedAtMs: number }>();

function normalizeShortenerProvider(
  value: string | null | undefined
): DisparosConfig["shortenerProvider"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "encurtadorpro") return "encurtadorpro";
  return "encurtadorpro";
}

function getAutoShortenerProviderOrder(): DisparosConfig["shortenerProvider"][] {
  // Regra operacional: usar apenas EncurtadorPro.
  return ["encurtadorpro"];
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

function formatDateBr(isoOrNull: string | null | undefined): string {
  if (!isoOrNull || typeof isoOrNull !== "string") return "sem data";
  try {
    let s = isoOrNull.trim();
    if (!s) return "sem data";
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s) && (s.includes("T") || /\d{4}-\d{2}-\d{2}\s+\d/.test(s))) {
      s = s.replace(" ", "T") + "Z";
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return "sem data";
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

async function loadAquecedorConfigFromDb() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await (supabase
    .from("aquecedor_config" as any)
    .select("use_recommended, custom_config")
    .eq("id", 1)
    .maybeSingle()) as any;

  if (error) throw new Error("Falha ao buscar configuração do aquecedor.");

  const useRecommended = data?.use_recommended !== false;
  const customConfigRaw =
    data?.custom_config && typeof data.custom_config === "object"
      ? data.custom_config
      : AQUECEDOR_DEFAULTS;

  let customConfig: AquecedorConfig = AQUECEDOR_DEFAULTS;
  try {
    customConfig = parseAquecedorConfig(customConfigRaw);
  } catch {
    customConfig = AQUECEDOR_DEFAULTS;
  }
  return useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
}

async function runAquecedorCycleTestBatch(
  connected: Array<{ instancia: string; numero: string }>,
  cicloGlobal: number,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  _config: AquecedorConfig
) {
  const originIdx = cicloGlobal % connected.length;
  const origem = connected[originIdx];
  const destinos = connected.filter((_, i) => i !== originIdx);
  const texto = "Mensagem de teste do aquecedor.";
  let ok = 0;
  let fail = 0;
  const delayMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const destino of destinos) {
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, origem.instancia);
    const numero = normalizeWhatsAppNumber(destino.numero);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: numero, textMessage: { text: texto } }
      : { number: numero, text: texto, textMessage: { text: texto } };
    const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);
    if (sendResult.ok) {
      ok += 1;
      await (supabase.from("logs_envios" as any) as any).insert({
        instancia_origem: origem.instancia,
        instancia_destino: destino.instancia,
        data_envio: new Date().toISOString(),
      });
      aquecedorRuntime.lastEvoError = null;
    } else {
      fail += 1;
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: String(sendResult.body || "").slice(0, 500),
        instance: origem.instancia,
        numeroLen: numero.length,
      };
    }
    if (destinos.indexOf(destino) < destinos.length - 1) {
      await delayMs(3000);
    }
  }

  const proximo = cicloGlobal + 1;
  await (supabase.from("controle_ciclo" as any) as any).upsert(
    { id: 1, ciclo_global: proximo },
    { onConflict: "id" }
  );
  aquecedorRuntime.lastResult =
    ok > 0
      ? `Ciclo teste concluído com sucesso: ${origem.instancia} enviou para ${destinos.length} destino(s). ${ok} ok, ${fail} falha(s).`
      : `Ciclo teste falhou: ${origem.instancia} → ${destinos.length} destino(s). ${fail} falha(s). Motivo: ${String(aquecedorRuntime.lastEvoError?.body || "sem detalhe").slice(0, 120)}`;
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

    const config = await loadAquecedorConfigFromDb();
    const nowSp = nowInSaoPaulo();
    if (!forceTest && !isAquecedorWindowOpen(config, nowSp)) {
      const nextOpen = nextAquecedorWindowOpenAt(config, nowSp);
      aquecedorRuntime.nextAllowedAt = nextOpen ? nextOpen.toISOString() : null;
      aquecedorRuntime.lastResult = nextOpen
        ? `Fora da janela humanizada. Próximo retorno previsto: ${formatDateBr(nextOpen.toISOString())}.`
        : "Fora da janela humanizada.";
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      aquecedorRuntime.lastResult = "Falha ao buscar instâncias da EVO.";
      return;
    }
    const rawInstances = await response.json();
    const instances = Array.isArray(rawInstances)
      ? rawInstances
      : Array.isArray(rawInstances?.response)
        ? rawInstances.response
        : Array.isArray(rawInstances?.data)
          ? rawInstances.data
          : rawInstances ? [rawInstances] : [];
    const connectedAll = buildConnectedFromEvoResponse(instances);
    const usageMap = await loadInstanceUsageMap();
    const connected = connectedAll.filter((item) => {
      const usage = usageMap.get(item.instancia);
      // padrão: ativo para não quebrar comportamento legado
      return usage ? usage.useAquecedor !== false : true;
    });

    if (connected.length < 2) {
      aquecedorRuntime.lastResult =
        "Menos de 2 instâncias conectadas e habilitadas para Aquecedor.";
      return;
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

    for (const item of connected) {
      await (supabase.from("controle_instancia" as any) as any).upsert(
        {
          instancia: item.instancia,
          numero_whatsapp: item.numero,
        },
        { onConflict: "instancia" }
      );
    }

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

    const chosen = combinations[cicloGlobal % combinations.length];
    const proximo = cicloGlobal + 1;

    const { data: pendingData } = await (supabase
      .from("aquecedor" as any)
      .select("id, mensagem, status, scheduled_at")
      .eq("status", "PENDENTE")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle()) as any;

    if (!pendingData?.id) {
      aquecedorRuntime.lastResult = "Sem mensagem pendente para envio.";
      return;
    }

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "PROCESSANDO",
        processing_at: new Date().toISOString(),
        instancia: chosen.instancia_origem,
        numero_destino: chosen.numero_whatsapp,
      })
      .eq("id", pendingData.id);

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
    const texto = String(pendingData.mensagem || "").trim() || " ";
    const numero = normalizeWhatsAppNumber(chosen.numero_whatsapp);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: numero, textMessage: { text: texto } }
      : { number: numero, text: texto, textMessage: { text: texto } };
    const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);

    if (!sendResult.ok) {
      await (supabase.from("aquecedor" as any) as any)
        .update({ status: "PENDENTE" })
        .eq("id", pendingData.id);
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

    await (supabase.from("controle_ciclo" as any) as any).upsert(
      { id: 1, ciclo_global: proximo },
      { onConflict: "id" }
    );

    const waitMin = config.waitMinSeconds;
    const waitMax = config.waitMaxSeconds;
    const waitSeconds =
      Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
    aquecedorRuntime.nextAllowedAt = new Date(Date.now() + waitSeconds * 1000).toISOString();
    aquecedorRuntime.lastResult = `Envio realizado com sucesso. Próxima janela em ~${waitSeconds}s.`;
  } catch (error) {
    console.error("Erro no ciclo do aquecedor:", error);
    aquecedorRuntime.lastResult = "Erro inesperado no ciclo do aquecedor.";
  } finally {
    aquecedorRuntime.isProcessing = false;
  }
}

function startAquecedorRuntime() {
  if (!ENABLE_BACKGROUND_PROCESSING) {
    aquecedorRuntime.running = false;
    aquecedorRuntime.lastResult =
      "Aquecedor desativado neste processo (ENABLE_BACKGROUND_PROCESSING=false).";
    return;
  }
  if (aquecedorInterval) return;
  aquecedorRuntime.running = true;
  aquecedorInterval = setInterval(() => {
    if (!aquecedorRuntime.running) return;
    runAquecedorCycle();
  }, 60000);
  runAquecedorCycle();
}

function stopAquecedorRuntime() {
  aquecedorRuntime.running = false;
  if (aquecedorInterval) {
    clearInterval(aquecedorInterval);
    aquecedorInterval = null;
  }
}

app.use(express.static(distPath));

app.get("/", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

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
app.get("/instancias", async (req, res) => {
  try {
    const aliasesMap = await loadInstanceAliasesMap();
    const whatsappNamesMap = await loadWhatsappProfileNamesMap();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("Erro Evolution API:", response.status, bodyText);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados na Evolution API" });
    }

    const instances: any[] = await response.json();

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

    return res.json({ total, ativas, desconectadas, items });
  } catch (error) {
    console.error("Erro ao consultar Evolution API:", error);
    return res
      .status(500)
      .json({ error: "Erro ao consultar Evolution API" });
  }
});

app.get("/instancias/avatar", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      return res.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: "URL de avatar inválida." });
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return res.status(400).json({ error: "Protocolo de URL não suportado." });
    }
    const host = String(parsed.hostname || "").toLowerCase();
    const allowedHosts = ["whatsapp.net", "fbcdn.net"];
    const isAllowed = allowedHosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    if (!isAllowed) {
      return res.status(400).json({ error: "Host de avatar não permitido." });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(parsed.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return res.status(502).json({ error: "Falha ao buscar avatar remoto." });
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.send(buffer);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erro ao buscar avatar proxy:", error);
    return res.status(500).json({ error: "Erro ao carregar avatar." });
  }
});

app.post("/instancias/:name/alias", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    const alias = String(req.body?.alias || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
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

app.get("/instancias/uso-config", async (_req, res) => {
  try {
    const usageMap = await loadInstanceUsageMap();
    const items = Array.from(usageMap.entries()).map(([instanceName, cfg]) => ({
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
      }))
      .filter((row: any) => row.instanceName);
    if (!items.length) {
      return res.status(400).json({ error: "Nenhuma instância válida foi informada." });
    }
    await persistInstanceUsage(items);
    return res.json({ ok: true, message: "Configuração de uso das instâncias salva.", items });
  } catch {
    return res.status(500).json({ error: "Erro ao salvar configuração de uso das instâncias." });
  }
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
      const instancia = String(inst?.name ?? inst?.instanceName ?? inst?.instance ?? "").trim();
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
    selectedCount > 0 && disconnectedCount / selectedCount > 0.5;
  return {
    selectedCount,
    connectedCount,
    disconnectedCount,
    disconnectedPercent,
    shouldPauseByDisconnectedRatio,
  };
}

async function callEvoAction(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, any>
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        apikey: EVO_API_KEY,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body: text,
      json,
    };
  } finally {
    clearTimeout(timeoutId);
  }
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
    if (result.ok) return result;
    const bodyLc = String(result.body || "").toLowerCase();
    const isTransient =
      result.status === 429 ||
      result.status === 500 ||
      result.status === 502 ||
      result.status === 503 ||
      result.status === 504 ||
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

  throw new Error("Provedor de encurtador não suportado. Use apenas EncurtadorPro.");
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

app.post("/instancias/:name/atualizar", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }

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

    const url = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação QRCode não configurada. Defina EVO_QRCODE_URL_TEMPLATE no backend.",
      });
    }

    const number = typeof req.query.number === "string" ? req.query.number.trim() : "";
    const urlWithQuery = number
      ? `${url}${url.includes("?") ? "&" : "?"}number=${encodeURIComponent(number)}`
      : url;

    const result = await callEvoAction(urlWithQuery, "GET");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao solicitar QRCode na EVO.",
        status: result.status,
      });
    }
    const qrCode = tryExtractQrCode(result.json) || tryExtractQrCode(result.body);
    return res.json({
      ok: true,
      message: "QRCode solicitado com sucesso.",
      qrCode,
      providerResponse: result.json ?? null,
    });
  } catch (error) {
    console.error("Erro ao solicitar QRCode:", error);
    return res.status(500).json({ error: "Erro ao solicitar QRCode." });
  }
});

app.post("/instancias/registrar-qrcode", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const channel = String(req.body?.channel || "baileys").trim();
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

    // Regra de segurança operacional:
    // não permitir criar instância com nome já usado por outra instância ativa/conectada.
    // Instâncias desconectadas são desconsideradas nesse comparativo.
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

    // token é gerado pelo backend quando não informado.
    const createPayload = {
      name,
      instanceName: name,
      channel,
      token,
      number,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };

    // Fallbacks para versões diferentes da Evolution API
    const createUrls = [
      EVO_CREATE_INSTANCE_URL,
      `${EVO_API_BASE}/instance/create`,
      `${EVO_API_BASE}/instance/create/${encodeURIComponent(name)}`,
    ].filter(Boolean);

    let createOk = false;
    let lastCreateStatus = 0;
    for (const createUrl of createUrls) {
      const createResult = await callEvoAction(createUrl, "POST", createPayload);
      lastCreateStatus = createResult.status;
      if (createResult.ok || createResult.status === 409) {
        // 409 pode ocorrer quando instância já existe; seguimos para QRCode
        createOk = true;
        break;
      }
    }

    let createWarning: string | null = null;
    if (!createOk) {
      createWarning = `Não foi possível salvar/atualizar a instância (status ${lastCreateStatus}). Tentando gerar QRCode da instância existente.`;
    }

    const connectCandidates = [
      buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, name),
      `${EVO_API_BASE}/instance/connect/${encodeURIComponent(name)}`,
      `${EVO_API_BASE}/instance/qrcode/${encodeURIComponent(name)}`,
      `${EVO_API_BASE}/instance/qr/${encodeURIComponent(name)}`,
    ].filter(Boolean) as string[];

    const qrcodeUrls = connectCandidates.map((candidate) =>
      number
        ? `${candidate}${candidate.includes("?") ? "&" : "?"}number=${encodeURIComponent(
            number
          )}`
        : candidate
    );

    let qrResult: Awaited<ReturnType<typeof callEvoAction>> | null = null;
    for (const qrcodeUrl of qrcodeUrls) {
      const result = await callEvoAction(qrcodeUrl, "GET");
      if (result.ok) {
        qrResult = result;
        break;
      }
    }

    if (!qrResult || !qrResult.ok) {
      return res.status(502).json({
        error: "Dados salvos, mas falha ao gerar QRCode na EVO.",
      });
    }

    const qrCode = tryExtractQrCode(qrResult.json);
    return res.json({
      ok: true,
      message: createWarning
        ? "QRCode gerado com sucesso para a instância existente."
        : "Dados salvos e QRCode gerado com sucesso.",
      warning: createWarning,
      qrCode,
      providerResponse: qrResult.json ?? null,
    });
  } catch (error) {
    console.error("Erro ao registrar instância e gerar QRCode:", error);
    return res.status(500).json({ error: "Erro ao gerar QRCode da instância." });
  }
});

app.delete("/instancias/:name", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }

    const url = buildTemplateUrl(EVO_DELETE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação deletar não configurada. Defina EVO_DELETE_URL_TEMPLATE no backend.",
      });
    }

    const result = await callEvoAction(url, "DELETE");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao deletar instância na EVO.",
        status: result.status,
      });
    }
    return res.json({ ok: true, message: "Instância deletada com sucesso." });
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const { data, error } = await (supabase
      .from("aquecedor_config" as any)
      .select("use_recommended, custom_config, updated_at")
      .eq("id", 1)
      .maybeSingle()) as any;

    if (error) {
      console.error("Erro ao buscar configuração do aquecedor:", error);
      return res.status(500).json({ error: "Erro ao buscar configuração do aquecedor." });
    }

    const useRecommended = data?.use_recommended !== false;
    const customConfigRaw =
      data?.custom_config && typeof data.custom_config === "object"
        ? data.custom_config
        : AQUECEDOR_DEFAULTS;

    let customConfig: AquecedorConfig;
    try {
      customConfig = parseAquecedorConfig(customConfigRaw);
    } catch {
      customConfig = AQUECEDOR_DEFAULTS;
    }

    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Erro inesperado ao buscar configuração do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao buscar configuração do aquecedor." });
  }
});

app.post("/aquecedor/config", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const useRecommended = req.body?.useRecommended !== false;
    const customConfig = parseAquecedorConfig(req.body?.customConfig || AQUECEDOR_DEFAULTS);

    const payload = {
      id: 1,
      use_recommended: useRecommended,
      custom_config: customConfig,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from("aquecedor_config" as any) as any).upsert(
      payload as any,
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error("Erro ao salvar configuração do aquecedor:", error);
      return res.status(500).json({ error: "Erro ao salvar configuração do aquecedor." });
    }

    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      ok: true,
      message: "Configuração do aquecedor salva com sucesso.",
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
    });
  } catch (error: any) {
    const message = error?.message || "Erro ao validar configuração do aquecedor.";
    return res.status(400).json({ error: message });
  }
});

app.get("/aquecedor/status", (_req, res) => {
  return res.json({
    ...aquecedorRuntime,
  });
});

app.get("/aquecedor/envios", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const cutoffStuck = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await ((supabase.from("aquecedor" as any) as any)
      .update({ status: "PENDENTE" })
      .eq("status", "PROCESSANDO")
      .lt("processing_at", cutoffStuck));

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

    const { data: processandoData } = await (supabase
      .from("aquecedor" as any)
      .select("instancia, numero_destino, scheduled_at, processing_at")
      .eq("status", "PROCESSANDO")
      .order("processing_at", { ascending: false })
      .limit(5)) as any;

    if (Array.isArray(processandoData) && processandoData.length > 0) {
      const { data: instanciasData } = await (supabase
        .from("controle_instancia" as any)
        .select("instancia, numero_whatsapp")) as any;
      const numToInst = new Map<string, string>();
      for (const r of instanciasData || []) {
        const num = String(r?.numero_whatsapp || "").trim();
        if (num) numToInst.set(num, String(r?.instancia || "").trim());
      }
      for (const row of processandoData) {
        const origem = String(row?.instancia || "").trim() || "—";
        const numDest = String(row?.numero_destino || "").trim();
        const destino = numToInst.get(numDest) || numDest || "—";
        const dataEnvio = String(row?.scheduled_at || row?.processing_at || "").trim() || null;
        items.push({
          instanciaOrigem: withAlias(origem),
          instanciaDestino: withAlias(destino),
          dataEnvio,
          dataEnvioBr: formatDateBr(dataEnvio),
          status: "Em Fila",
        });
      }
    }

    const { data: pendingData, error: pendingErr } = await (supabase
      .from("aquecedor" as any)
      .select("scheduled_at")
      .eq("status", "PENDENTE")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()) as any;

    if (pendingData) {
      let origem = "—";
      let destino = "—";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(EVO_INSTANCES_URL, {
          headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const instances: any[] = (await response.json().catch(() => [])) || [];
          const connectedAll = buildConnectedFromEvoResponse(instances);
          const usageMap = await loadInstanceUsageMap();
          const connected = connectedAll.filter((item) => {
            const usage = usageMap.get(item.instancia);
            return usage ? usage.useAquecedor !== false : true;
          });
          if (connected.length >= 2) {
            const combinations: Array<{ origem: string; destino: string }> = [];
            for (const o of connected) {
              for (const d of connected) {
                if (o.instancia === d.instancia) continue;
                combinations.push({ origem: o.instancia, destino: d.instancia });
              }
            }
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
            const chosen = combinations[cicloGlobal % combinations.length];
            if (chosen) {
              origem = chosen.origem;
              destino = chosen.destino;
            }
          }
        }
      } catch (_) {
        // usar — quando não for possível obter origem/destino
      }
      const dataEnvio = String(pendingData?.scheduled_at || "").trim() || null;
      items.unshift({
        instanciaOrigem: withAlias(origem),
        instanciaDestino: withAlias(destino),
        dataEnvio,
        dataEnvioBr: formatDateBr(dataEnvio),
        status: "Em Fila",
      });
    }

    const { data: logsData, error } = await (supabase
      .from("logs_envios" as any)
      .select("instancia_origem, instancia_destino, data_envio")
      .order("data_envio", { ascending: false })
      .limit(limit)) as any;

    if (!error && Array.isArray(logsData)) {
      for (const row of logsData) {
        const dataEnvio = String(row?.data_envio || "").trim() || null;
        items.push({
          instanciaOrigem: withAlias(String(row?.instancia_origem || "").trim() || "—"),
          instanciaDestino: withAlias(String(row?.instancia_destino || "").trim() || "—"),
          dataEnvio,
          dataEnvioBr: formatDateBr(dataEnvio),
          status: "Envio com Sucesso",
        });
      }
    }

    items.sort((a, b) => {
      const tsA = a.dataEnvio ? new Date(a.dataEnvio).getTime() : 0;
      const tsB = b.dataEnvio ? new Date(b.dataEnvio).getTime() : 0;
      return tsB - tsA;
    });

    return res.json({ items });
  } catch (error) {
    console.error("Erro inesperado ao listar envios do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao listar envios do aquecedor." });
  }
});

app.post("/aquecedor/start", (_req, res) => {
  if (!ENABLE_BACKGROUND_PROCESSING) {
    return res.status(409).json({
      ok: false,
      message:
        "Aquecedor desativado neste processo. Use o runtime de produção para processar envios.",
      status: aquecedorRuntime,
      runtime: { mode: RUNTIME_MODE, backgroundProcessing: ENABLE_BACKGROUND_PROCESSING },
    });
  }
  startAquecedorRuntime();
  void persistAquecedorRuntimeDesired(true);
  return res.json({ ok: true, message: "Aquecedor iniciado.", status: aquecedorRuntime });
});

app.post("/aquecedor/stop", (_req, res) => {
  stopAquecedorRuntime();
  void persistAquecedorRuntimeDesired(false);
  return res.json({ ok: true, message: "Aquecedor parado.", status: aquecedorRuntime });
});

app.post("/aquecedor/run-once", async (_req, res) => {
  await runAquecedorCycle(true); // bypass janela e cooldown para teste
  stopAquecedorRuntime(); // execução única: para o motor ao finalizar
  return res.json({ ok: true, message: "Ciclo executado.", status: aquecedorRuntime });
});

app.post("/aquecedor/criar-mensagem-teste", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor.",
      });
    }
    const mensagem = String(_req.body?.mensagem ?? "").trim() || "Mensagem de teste do aquecedor.";
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

app.get("/aquecedor/diagnostico", async (_req, res) => {
  const diag: Record<string, any> = {
    runtime: { ...aquecedorRuntime },
    evo: { ok: false, connectedCount: 0, instances: [] as string[] },
    supabase: { ok: false, pendingCount: 0 },
    janela: { aberta: false, motivo: "" },
    proximaCombinacao: null as { origem: string; destino: string } | null,
    cicloGlobal: null as number | null,
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
      const instances: any[] = (await response.json().catch(() => [])) || [];
      const connectedAll = buildConnectedFromEvoResponse(instances);
      const usageMap = await loadInstanceUsageMap();
      const connected = connectedAll.filter((item) => {
        const usage = usageMap.get(item.instancia);
        return usage ? usage.useAquecedor !== false : true;
      });
      diag.evo.ok = true;
      diag.evo.connectedCount = connected.length;
      diag.evo.instances = connected.map((c) => c.instancia);
      if (connected.length >= 2) {
        const combinations: Array<{ origem: string; destino: string }> = [];
        for (const origem of connected) {
          for (const destino of connected) {
            if (origem.instancia === destino.instancia) continue;
            combinations.push({
              origem: origem.instancia,
              destino: destino.instancia,
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
              const chosen = combinations[cicloGlobal % combinations.length];
              diag.proximaCombinacao = chosen;
            }
          } catch (supErr) {
            diag.supabase.mensagem = (supErr as Error)?.message || "Erro ao consultar Supabase.";
          }
        } else {
          diag.supabase.mensagem = "Supabase não configurado.";
        }
      }
      try {
        const config = await loadAquecedorConfigFromDb();
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
  const appId = String(process.env.META_APP_ID || "").trim();
  const configId = String(process.env.META_ES_CONFIG_ID || "").trim();
  res.json({
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    graphVersion: META_GRAPH_VERSION,
  });
});

/**
 * Troca o código do Embedded Signup por business token (Tech Provider / doc Meta nov/2025).
 * Usa META_APP_ID e META_APP_SECRET do ambiente — não envie app secret do cliente.
 */
app.post("/meta-oficial/embedded-signup/exchange-code", parseJsonDefault, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    const appId = String(process.env.META_APP_ID || "").trim();
    const appSecret = String(process.env.META_APP_SECRET || "").trim();
    if (!code) {
      return res.status(400).json({ error: "Campo 'code' é obrigatório (código de ~30s do Embedded Signup)." });
    }
    if (!appId || !appSecret) {
      return res.status(503).json({
        error: "Servidor sem META_APP_ID / META_APP_SECRET configurados para Embedded Signup.",
      });
    }
    const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("code", code);

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
        error: "Falha ao trocar código por token na Meta.",
        status: response.status,
        detail: detail || undefined,
      });
    }
    const accessToken = String(json?.access_token || text || "").trim();
    if (!accessToken) {
      return res.status(502).json({ error: "Resposta da Meta sem access_token." });
    }
    return res.json({ ok: true, accessToken });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao trocar código Embedded Signup." });
  }
});

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

app.get("/disparos/config", async (_req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const autoProviders = getAutoShortenerProviderOrder();
    const currentShortenerProvider = autoProviders[0];
    return res.json({
      config,
      shortenerAuto: true,
      currentShortenerProvider,
      shortenerProviders: [
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
    const config = parseDisparosConfig(mergedConfig);
    await saveDisparosConfigToDb(config);
    return res.json({ ok: true, message: "Configuração do Disparador salva.", config });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Configuração inválida." });
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

app.get("/disparos/diagnostico", async (_req, res) => {
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
        const connected = buildConnectedFromEvoResponse(list);
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
        error: "Não foi possível gerar link curto no EncurtadorPro.",
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
    const connected = buildConnectedFromEvoResponse(list);
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
    const key = "__global_rr__";
    const cur = campaignDisparadorRoundRobin.get(key) ?? disparosRoundRobinCounter;
    const idx = cur % eligible.length;
    campaignDisparadorRoundRobin.set(key, cur + 1);
    disparosRoundRobinCounter = cur + 1;
    return eligible[idx];
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
  void persistAquecedorRuntimeDesired(false);
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
    return res.json({
      ok: true,
      message:
        "Campanha criada com sucesso. Ative-a à direita para iniciar os disparos." + msgExtra,
      duplicatesRemoved,
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

app.get("/disparos/campanhas", async (_req, res) => {
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

    const evoRows = await fetchEvoInstanceTagRows();
    const globalDisparos = await loadDisparosConfigFromDb();
    const globalSelected = Array.isArray(globalDisparos.selectedDisparadorInstances)
      ? globalDisparos.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
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
          selectedCount > 0 && disconnectedCount / selectedCount > 0.5;
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
      const clicks = await fetchClicksForShortUrlFromEncurtadorPro(String(shortUrl));
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
            "Campanha bloqueada para ativação: mais de 50% das instâncias selecionadas estão desconectadas. Use o botão '+ Instâncias' para ampliar a base conectada.",
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
    const incoming = raw
      .map((n: any) => String(n || "").trim())
      .filter(Boolean);
    if (!incoming.length) {
      return res.status(400).json({ error: "Informe ao menos uma instância para adicionar." });
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
      evoRows = await fetchEvoInstanceTagRows();
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

app.listen(PORT, () => {
  console.log(`Disparador N8 - servidor rodando em http://localhost:${PORT}`);
  console.log(
    `[runtime] mode=${RUNTIME_MODE} backgroundProcessing=${ENABLE_BACKGROUND_PROCESSING}`
  );
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

    const desiredHeater = await loadAquecedorRuntimeDesired();
    if (
      desiredHeater === true &&
      ENABLE_BACKGROUND_PROCESSING &&
      !MAINTENANCE_MODE
    ) {
      startAquecedorRuntime();
      console.log(
        "[Aquecedor] retomado após restart (data/runtime-intent.json — último «Iniciar» explícito)."
      );
    }

    if (ENABLE_BACKGROUND_PROCESSING && !MAINTENANCE_MODE) {
      setInterval(() => {
        runCampaignDispatchTick().catch((err) => console.error("[Campanhas] tick:", err));
      }, 7000);
    } else if (!ENABLE_BACKGROUND_PROCESSING) {
      console.log(
        "[campanhas] processamento automático desativado neste processo (dev isolado)."
      );
    }
  })();
});

