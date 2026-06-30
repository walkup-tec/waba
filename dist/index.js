"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./load-env");
process.env.TZ = process.env.TZ || "America/Sao_Paulo";
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = require("fs");
const promises_1 = require("dns/promises");
const os_1 = require("os");
const supabase_js_1 = require("@supabase/supabase-js");
const generated_brand_logo_1 = require("./generated-brand-logo");
const load_env_1 = require("./load-env");
const data_path_1 = require("./data-path");
const base_path_1 = require("./base-path");
const waba_auth_routes_1 = require("./auth/waba-auth.routes");
const waba_request_auth_1 = require("./auth/waba-request-auth");
const waba_auth_service_1 = require("./auth/waba-auth.service");
const waba_system_user_repository_1 = require("./users/waba-system-user.repository");
const alternativa_number_activation_repository_1 = require("./billing/alternativa-number-activation.repository");
const waba_alternativa_numbers_service_1 = require("./billing/waba-alternativa-numbers.service");
const alternativa_dispatch_rules_1 = require("./disparos/alternativa-dispatch-rules");
const waba_instance_ownership_service_1 = require("./instances/waba-instance-ownership.service");
const evo_instance_key_1 = require("./instances/evo-instance-key");
const evo_instance_phone_service_1 = require("./instances/evo-instance-phone.service");
const waba_billing_routes_1 = require("./billing/waba-billing.routes");
const waba_fazenda_pool_service_1 = require("./instances/waba-fazenda-pool.service");
const waba_admin_routes_1 = require("./admin/waba-admin.routes");
const waba_push_routes_1 = require("./push/waba-push.routes");
const waba_operacional_campanhas_routes_1 = require("./admin/waba-operacional-campanhas.routes");
const asaas_integration_monitor_service_1 = require("./monitoring/asaas-integration-monitor.service");
const evo_http_client_1 = require("./evo-http.client");
const waba_shortener_service_1 = require("./shortener/waba-shortener.service");
const waba_public_base_url_1 = require("./lib/waba-public-base-url");
const waba_system_user_service_1 = require("./users/waba-system-user.service");
const waba_campaign_intake_routes_1 = require("./disparos/waba-campaign-intake.routes");
const waba_dispatches_api_kind_1 = require("./disparos/waba-dispatches-api-kind");
const waba_campaign_spreadsheet_util_1 = require("./disparos/waba-campaign-spreadsheet.util");
const waba_disparos_credits_service_1 = require("./billing/waba-disparos-credits.service");
const waba_feature_flags_1 = require("./config/waba-feature-flags");
const waba_entitlement_routes_1 = require("./entitlements/waba-entitlement.routes");
const waba_entitlement_service_1 = require("./entitlements/waba-entitlement.service");
const waba_cors_1 = require("./lib/waba-cors");
const waba_subscriber_routes_1 = require("./subscribers/waba-subscriber.routes");
const waba_support_routes_1 = require("./support/waba-support.routes");
const instance_integration_probe_1 = require("./instance-integration-probe");
const instance_inbound_validation_service_1 = require("./instance-inbound-validation.service");
const aquecedor_instance_lifecycle_service_1 = require("./services/aquecedor-instance-lifecycle.service");
const aquecedor_instance_warmth_service_1 = require("./services/aquecedor-instance-warmth.service");
const aquecedor_instance_message_stats_service_1 = require("./services/aquecedor-instance-message-stats.service");
const production_data_persistence_service_1 = require("./services/production-data-persistence.service");
const deploy_marker_1 = require("./deploy-marker");
const waba_campaign_intake_constants_1 = require("./disparos/waba-campaign-intake.constants");
const waba_mail_service_1 = require("./mail/waba-mail.service");
const waba_graceful_shutdown_1 = require("./server/waba-graceful-shutdown");
/** Identificador único por processo — muda a cada redeploy/restart (overlay de deploy). */
const WABA_SERVER_BOOT_ID = `${Date.now().toString(36)}-${crypto_1.default.randomBytes(4).toString("hex")}`;
const app = (0, express_1.default)();
app.use(base_path_1.stripBasePathMiddleware);
/** UI estática: raiz do projeto e pasta dist (antes de middlewares que possam interferir). */
const rootPath = path_1.default.join(__dirname, "..");
const distPath = path_1.default.join(rootPath, "dist");
/**
 * Logo DRAX: primeiro middleware.
 * Prioridade: PNG embutido em base64 (gerado no build) → não depende de ficheiros no disco do container.
 * Fallback: ficheiros em dist/media ou media/ (dev).
 */
let draxLogoBytes;
function resolveDraxLogoPng() {
    if (draxLogoBytes !== undefined) {
        return draxLogoBytes;
    }
    const b64 = typeof generated_brand_logo_1.DRAX_LOGO_PNG_BASE64 === "string" ? generated_brand_logo_1.DRAX_LOGO_PNG_BASE64.trim() : "";
    if (b64.length > 500) {
        try {
            const fromEmbed = Buffer.from(b64, "base64");
            if (fromEmbed.length > 0) {
                draxLogoBytes = fromEmbed;
                return fromEmbed;
            }
        }
        catch (e) {
            console.warn("[brand] decode base64 da logo falhou:", e);
        }
    }
    const fileName = "Drax-logo-footer.png";
    const candidates = [
        path_1.default.join(distPath, "media", fileName),
        path_1.default.join(rootPath, "media", fileName),
        path_1.default.join(process.cwd(), "media", fileName),
        path_1.default.join(process.cwd(), "dist", "media", fileName),
    ];
    for (const filePath of candidates) {
        if (!(0, fs_1.existsSync)(filePath))
            continue;
        try {
            const buf = (0, fs_1.readFileSync)(filePath);
            if (buf.length > 0) {
                draxLogoBytes = buf;
                return buf;
            }
        }
        catch (e) {
            console.warn("[brand] erro ao ler logo:", filePath, e);
        }
    }
    draxLogoBytes = null;
    console.error("[brand] Drax-logo-footer.png não encontrado (embed vazio e disco). cwd=%s __dirname=%s tentou: %s", process.cwd(), __dirname, candidates.join(" | "));
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
    const raw = typeof req.path === "string" && req.path.length > 0
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
const sendBrandStaticFile = (res, candidates, contentType) => {
    for (const filePath of candidates) {
        if (!(0, fs_1.existsSync)(filePath))
            continue;
        try {
            const buf = (0, fs_1.readFileSync)(filePath);
            if (buf.length === 0)
                continue;
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.type(contentType);
            res.send(buf);
            return true;
        }
        catch {
            /* tenta próximo */
        }
    }
    return false;
};
app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD")
        return next();
    const p = String(req.path || "/").toLowerCase();
    if (p === "/favicon.ico") {
        if (sendBrandStaticFile(res, [
            path_1.default.join(distPath, "favicon.ico"),
            path_1.default.join(rootPath, "favicon.ico"),
            path_1.default.join(distPath, "media", "favicon.ico"),
            path_1.default.join(rootPath, "media", "favicon.ico"),
        ], "image/x-icon")) {
            return;
        }
    }
    if (p === "/media/favcon.png" || p === "/media/favicon.png") {
        const fileName = p === "/media/favcon.png" ? "favcon.png" : "favicon.png";
        if (sendBrandStaticFile(res, [
            path_1.default.join(distPath, "media", fileName),
            path_1.default.join(rootPath, "media", fileName),
        ], "image/png")) {
            return;
        }
    }
    return next();
});
/** Encurtador próprio — redirect público na raiz do host (/s/:slug). */
app.get("/s/:slug", async (req, res) => {
    try {
        const target = await (0, waba_shortener_service_1.resolveWabaShortRedirect)(String(req.params.slug || ""));
        if (!target)
            return res.status(404).type("text/plain").send("Not Found");
        return res.redirect(302, target);
    }
    catch (error) {
        console.error("[shortener] redirect error:", error);
        return res.status(500).type("text/plain").send("Erro ao redirecionar.");
    }
});
const PORT = process.env.PORT || 3000;
const RUNTIME_MODE = String(process.env.RUNTIME_MODE || "production").toLowerCase();
const parseEnvBoolean = (raw, defaultValue) => {
    const value = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (!value)
        return defaultValue;
    if (["1", "true", "yes", "on"].includes(value))
        return true;
    if (["0", "false", "no", "off"].includes(value))
        return false;
    return defaultValue;
};
/** Disparador EVO (API não oficial): V01/V02 usam WABA_EVO_DISPARADOR; demais ambientes seguem ENABLE_BACKGROUND_PROCESSING. */
const ENABLE_BACKGROUND_PROCESSING = load_env_1.WABA_ENV === "v01" || load_env_1.WABA_ENV === "v02"
    ? parseEnvBoolean(process.env.WABA_EVO_DISPARADOR ?? process.env.ENABLE_BACKGROUND_PROCESSING, load_env_1.WABA_ENV === "v01")
    : parseEnvBoolean(process.env.ENABLE_BACKGROUND_PROCESSING, true);
/** Aquecedor pode rodar em dev (v02) mesmo com campanhas desligadas. Se omitido, segue ENABLE_BACKGROUND_PROCESSING. */
const ENABLE_AQUECEDOR_PROCESSING = (() => {
    const raw = String(process.env.ENABLE_AQUECEDOR_PROCESSING ?? "").trim().toLowerCase();
    if (raw)
        return ["1", "true", "yes", "on"].includes(raw);
    return ENABLE_BACKGROUND_PROCESSING;
})();
/** Quando true, o processo responde só a probes e página de manutenção (útil no ambiente prod / porta 3000). */
const MAINTENANCE_MODE = ["1", "true", "yes", "on"].includes(String(process.env.MAINTENANCE_MODE || "").toLowerCase());
const MAINTENANCE_RETRY_AFTER_SEC = Math.max(30, Math.min(86400, Number(process.env.MAINTENANCE_RETRY_AFTER_SEC || 120) || 120));
const MAINTENANCE_MESSAGE = String(process.env.MAINTENANCE_MESSAGE ||
    "Serviço em manutenção. Tente novamente em alguns minutos.").trim() || "Serviço em manutenção. Tente novamente em alguns minutos.";
/** Demais rotas (padrão Express ~100kb). */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "10mb";
/**
 * Só o POST que envia o array `numbers` + `configSnapshot` pode passar de dezenas de MB.
 * Limite separado para não depender só do global (e para planilhas muito grandes).
 */
const CAMPAIGN_CREATE_JSON_LIMIT = process.env.CAMPAIGN_CREATE_JSON_LIMIT || "512mb";
const parseJsonDefault = express_1.default.json({ limit: JSON_BODY_LIMIT });
const parseJsonCampaignCreate = express_1.default.json({ limit: CAMPAIGN_CREATE_JSON_LIMIT });
const CAMPAIGN_UPLOAD_MAX_BYTES = Math.max(5, Number(process.env.CAMPAIGN_UPLOAD_MAX_MB || 100)) * 1024 * 1024;
/** Planilha enviada como arquivo — não carrega centenas de MB em JSON. */
const uploadCampaignSpreadsheet = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
function isDisparosCampaignCreatePost(req) {
    if (req.method !== "POST")
        return false;
    const p = String(req.path || "").replace(/\/+$/, "") || "/";
    return p === "/disparos/campanhas";
}
/** Multipart não pode passar pelo express.json/urlencoded — corrompe o stream antes do multer. */
function shouldSkipBodyParserForMultipart(req) {
    if (req.method !== "POST")
        return false;
    const p = String(req.path || "").replace(/\/+$/, "") || "/";
    // Intake do wizard é sempre multipart; não depender só do Content-Type (proxies podem alterá-lo).
    if (p === "/disparos/campanhas/intake")
        return true;
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("multipart/form-data"))
        return false;
    return p === "/disparos/campanhas";
}
app.use((req, res, next) => {
    if (shouldSkipBodyParserForMultipart(req)) {
        return next();
    }
    if (isDisparosCampaignCreatePost(req)) {
        return parseJsonCampaignCreate(req, res, next);
    }
    return parseJsonDefault(req, res, next);
});
/** Form POST (alguns proxies lidam melhor com urlencoded do que com JSON no mesmo host). */
app.use((req, res, next) => {
    if (shouldSkipBodyParserForMultipart(req)) {
        return next();
    }
    return express_1.default.urlencoded({ extended: true, limit: JSON_BODY_LIMIT })(req, res, next);
});
function isMaintenanceBypassPath(method, reqPath) {
    const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
    if (p === "/webhooks/asaas" || p.startsWith("/webhooks/asaas/") || p === "/webhooks/evolution") {
        return true;
    }
    if (method !== "GET" && method !== "HEAD")
        return false;
    return (p === "/health" ||
        p === "/ready" ||
        p === "/service/maintenance" ||
        p === "/maintenance");
}
function isDistStaticAssetPath(reqPath) {
    return /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(String(reqPath || ""));
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
    if ((req.method === "GET" || req.method === "HEAD") &&
        isDistStaticAssetPath(req.path)) {
        return next();
    }
    if ((req.method === "GET" || req.method === "HEAD") &&
        (norm === "/" || norm === "/index.html")) {
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
(0, waba_graceful_shutdown_1.registerWabaShutdownGate)(app);
app.get("/health", (_req, res) => {
    const shuttingDown = (0, waba_graceful_shutdown_1.isWabaServerShuttingDown)();
    res.status(shuttingDown ? 503 : 200).json({
        ok: !shuttingDown,
        shuttingDown,
        deployMarker: deploy_marker_1.WABA_DEPLOY_MARKER,
        serverBootId: WABA_SERVER_BOOT_ID,
        campaignIntakeApiVersion: waba_campaign_intake_constants_1.WABA_CAMPAIGN_INTAKE_API_VERSION,
        campaignIntakeSafeParser: waba_campaign_intake_constants_1.WABA_CAMPAIGN_INTAKE_SAFE_PARSER,
        mailConfigured: waba_mail_service_1.wabaMailService.isConfigured(),
        operacionalCampaignNotifyEnabled: true,
        wabaEnv: load_env_1.WABA_ENV,
        uiProfile: resolveUiProfile(),
        featureFlags: (0, waba_feature_flags_1.getWabaFeatureFlagsForClient)(),
        basePath: base_path_1.BASE_PATH || "/",
        port: PORT,
        maintenanceMode: MAINTENANCE_MODE,
        runtimeMode: RUNTIME_MODE,
        deployResilienceEnabled: (0, base_path_1.resolveDeployResilienceForClient)(),
        backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
        aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
        evoApiBase: (0, evo_http_client_1.describeEvoApiBaseForOps)(EVO_API_BASE),
        evoTlsInsecure: (0, evo_http_client_1.isEvoTlsInsecure)(),
        evoHttpTimeoutMs: (0, evo_http_client_1.defaultEvoHttpTimeoutMs)(),
        shortPublicBase: (0, waba_shortener_service_1.peekWabaShortPublicBaseUrl)(),
        dataPersistence: (0, production_data_persistence_service_1.getProductionDataPersistenceSnapshot)(),
    });
});
app.get("/ready", (_req, res) => {
    const shuttingDown = (0, waba_graceful_shutdown_1.isWabaServerShuttingDown)();
    if (shuttingDown) {
        return res.status(503).json({
            ok: false,
            ready: false,
            shuttingDown: true,
            message: "Servidor em atualização.",
            retryAfterSec: 15,
        });
    }
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
(0, waba_cors_1.registerWabaCors)(app);
(0, waba_auth_routes_1.registerWabaAuthRoutes)(app);
(0, waba_subscriber_routes_1.registerWabaSubscriberRoutes)(app);
(0, waba_entitlement_routes_1.registerWabaEntitlementRoutes)(app);
app.use(waba_auth_routes_1.wabaRequireAuthMiddleware);
const wabaEntitlementService = new waba_entitlement_service_1.WabaEntitlementService();
async function rejectForeignInstance(req, res, instanceName) {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    if (!(await waba_instance_ownership_service_1.wabaInstanceOwnershipService.canAccessInstance(auth, instanceName))) {
        res.status(403).json({
            error: "Esta instância pertence a outro usuário ou você não tem permissão para acessá-la.",
        });
        return true;
    }
    return false;
}
function rejectForeignInstanceNames(req, instanceNames) {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    return waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, instanceNames);
}
async function filterEvoTagRowsForRequest(req, rows) {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    const allowed = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, rows.map((r) => r.instanceKey));
    const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
    return rows.filter((r) => allowedLower.has(r.instanceKey.toLowerCase()));
}
async function fetchEvoInstanceTagRowsForRequest(req) {
    const rows = await fetchEvoInstanceTagRows();
    return filterEvoTagRowsForRequest(req, rows);
}
async function filterConnectedInstanciasForRequest(req, connected) {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    const allowed = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, connected.map((c) => c.instancia));
    const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
    return connected.filter((c) => allowedLower.has(c.instancia.toLowerCase()));
}
function rejectAquecedorWithoutEntitlement(req, res) {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    const entitlement = wabaEntitlementService.getAquecedorEntitlement(auth.email, auth.role);
    if (entitlement.active)
        return false;
    res.status(403).json({
        error: entitlement.message,
        code: entitlement.reason,
        entitlement,
    });
    return true;
}
// Supabase (criado sob demanda para evitar travamentos quando faltar config)
let supabaseClient = null;
function resetSupabaseClient() {
    supabaseClient = null;
}
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey)
        return null;
    if (!supabaseClient) {
        supabaseClient = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return supabaseClient;
}
function isSupabaseTransientError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return (msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("econnreset") ||
        msg.includes("socket hang up"));
}
function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getSupabaseUrlHost() {
    try {
        const raw = String(process.env.SUPABASE_URL || "").trim();
        if (!raw)
            return null;
        return new URL(raw).hostname;
    }
    catch {
        return null;
    }
}
async function describeSupabaseConnectivityFailure() {
    const host = getSupabaseUrlHost();
    if (!host) {
        return "SUPABASE_URL inválida ou ausente no servidor (Easypanel → Environment).";
    }
    if (!String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
        return "SUPABASE_SERVICE_ROLE_KEY ausente no servidor (Easypanel → Environment).";
    }
    try {
        await (0, promises_1.lookup)(host);
    }
    catch (err) {
        const code = String(err?.code || "");
        if (code === "ENOTFOUND" || code === "ESERVFAIL") {
            return `SUPABASE_URL incorreta: o host "${host}" não existe no DNS. Copie a Project URL no dashboard Supabase.`;
        }
        return `Supabase inacessível em "${host}" (${code || "erro de rede"}). Verifique SUPABASE_URL no Easypanel.`;
    }
    return `Conexão com Supabase em "${host}" falhou após 3 tentativas. Confira service_role key e se o projeto está ativo.`;
}
function normalizeInstanceUsageRow(row) {
    return {
        useAquecedor: row?.use_aquecedor !== false,
        useDisparador: row?.use_disparador !== false,
        useFazenda: row?.use_fazenda === true,
        updatedAt: String(row?.updated_at || new Date().toISOString()),
    };
}
function getInstanceUsageFromMap(map, instanceName) {
    const key = String(instanceName || "").trim();
    if (!key)
        return undefined;
    const direct = map.get(key);
    if (direct)
        return direct;
    const target = key.toLowerCase();
    for (const [mapKey, value] of map.entries()) {
        if (mapKey.toLowerCase() === target)
            return value;
    }
    return undefined;
}
async function loadInstanceUsageMap() {
    const result = new Map();
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const { data, error } = await (supabase
                .from("instancias_uso_config")
                .select("instance_name, use_aquecedor, use_disparador, use_fazenda, updated_at")
                .limit(2000));
            if (!error && Array.isArray(data)) {
                for (const row of data) {
                    const key = String(row?.instance_name || "").trim();
                    if (!key)
                        continue;
                    result.set(key, normalizeInstanceUsageRow(row));
                }
            }
        }
        catch {
            // fallback em memória
        }
    }
    for (const [k, v] of instanceUsageMemory.entries()) {
        if (!result.has(k))
            result.set(k, v);
    }
    return result;
}
async function persistInstanceUsage(items) {
    const now = new Date().toISOString();
    const usageMap = await loadInstanceUsageMap();
    for (const item of items) {
        const key = String(item.instanceName || "").trim();
        if (!key)
            continue;
        const previous = instanceUsageMemory.get(key) || getInstanceUsageFromMap(usageMap, key);
        const useFazenda = item.useFazenda !== undefined ? item.useFazenda === true : previous?.useFazenda === true;
        instanceUsageMemory.set(key, {
            useAquecedor: item.useAquecedor !== false,
            useDisparador: item.useDisparador !== false,
            useFazenda,
            updatedAt: now,
        });
    }
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
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
        if (!rows.length)
            return;
        await supabase.from("instancias_uso_config").upsert(rows, {
            onConflict: "instance_name",
        });
    }
    catch {
        // fallback em memória
    }
}
(0, instance_integration_probe_1.setIntegrationProbeFinishedHandler)((status) => {
    if (!status.restrictionSuspected)
        return;
    void (async () => {
        await (0, aquecedor_instance_lifecycle_service_1.markAquecedorInstanceRestricted)(status.sourceInstance, status.apiTest.detail || "Restrição detectada no teste de integração.");
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
(0, instance_inbound_validation_service_1.setInboundValidationFinishedHandler)((status) => {
    if (!status.restrictionSuspected)
        return;
    void (async () => {
        await (0, aquecedor_instance_lifecycle_service_1.markAquecedorInstanceRestricted)(status.instanceName, status.sendTest.detail || "Restrição detectada na validação inbound.");
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
function parseDisparosConfig(input) {
    const readInt = (value, min, max, fallback) => {
        const n = Number(value);
        if (!Number.isFinite(n))
            return fallback;
        const v = Math.floor(n);
        if (v < min || v > max)
            return fallback;
        return v;
    };
    const workingDays = Array.isArray(input?.workingDays)
        ? input.workingDays
            .map((d) => String(d || "").toLowerCase().trim())
            .filter((d) => DAY_CODES.includes(d))
        : DISPAROS_DEFAULTS.workingDays;
    const provider = String(input?.shortenerProvider || DISPAROS_DEFAULTS.shortenerProvider).toLowerCase();
    const safeProvider = provider === "encurtadorpro" ||
        provider === "isgd" ||
        provider === "tinyurl" ||
        provider === "waba"
        ? provider
        : "waba";
    const mode = String(input?.messageMode || DISPAROS_DEFAULTS.messageMode).toLowerCase();
    const safeMode = mode === "database" ? "database" : "ai";
    const selectedRaw = input?.selectedDisparadorInstances ?? input?.selected_disparador_instances;
    const selectedDisparadorInstances = Array.isArray(selectedRaw)
        ? Array.from(new Set(selectedRaw
            .map((n) => String(n || "").trim())
            .filter((n) => n.length > 0)))
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
        maxPerHourPerInstance: readInt(input?.maxPerHourPerInstance, 1, 10000, DISPAROS_DEFAULTS.maxPerHourPerInstance),
        maxPerDayPerInstance: readInt(input?.maxPerDayPerInstance, 1, 200000, DISPAROS_DEFAULTS.maxPerDayPerInstance),
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
        linkDestinationMode: String(input?.linkDestinationMode || "").toLowerCase().trim() === "url" ? "url" : "whatsapp",
        whatsappTargetNumber: normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || "")),
        responseUrl: normalizeDisparosResponseUrl(String(input?.responseUrl || "")),
        selectedDisparadorInstances,
    };
}
function normalizeDisparosResponseUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed)
        return "";
    if (/^https?:\/\//i.test(trimmed))
        return trimmed.slice(0, 2000);
    return `https://${trimmed.replace(/^\/+/, "")}`.slice(0, 2000);
}
function validateDisparosLinkDestination(input) {
    const mode = String(input?.linkDestinationMode || DISPAROS_DEFAULTS.linkDestinationMode).toLowerCase() ===
        "url"
        ? "url"
        : "whatsapp";
    if (mode === "whatsapp") {
        const num = normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || ""));
        if (!num)
            return "Campo obrigatório ausente no Disparador: whatsappTargetNumber.";
        return null;
    }
    const url = normalizeDisparosResponseUrl(String(input?.responseUrl || ""));
    if (!url || !/^https?:\/\//i.test(url)) {
        return "Campo obrigatório ausente no Disparador: responseUrl.";
    }
    return null;
}
function buildDisparosDestinationLongUrl(config, nonce) {
    const mode = config.linkDestinationMode === "url" ? "url" : "whatsapp";
    if (mode === "url") {
        const base = normalizeDisparosResponseUrl(String(config.responseUrl || ""));
        if (!base || !/^https?:\/\//i.test(base)) {
            throw new Error("Snapshot da campanha sem URL de resposta (Encurtador).");
        }
        try {
            const u = new URL(base);
            u.searchParams.set("_n8n_link_nonce", nonce);
            return u.toString();
        }
        catch {
            const sep = base.includes("?") ? "&" : "?";
            return `${base}${sep}_n8n_link_nonce=${encodeURIComponent(nonce)}`;
        }
    }
    const targetNumber = normalizeWhatsAppNumber(String(config.whatsappTargetNumber || ""));
    if (!targetNumber) {
        throw new Error("Snapshot da campanha sem número alvo (Encurtador).");
    }
    return `https://wa.me/${targetNumber}?text=Ol%C3%A1&_n8n_link_nonce=${nonce}`;
}
async function generateUniqueShortUrlForDisparosConfig(config, publicBaseHints) {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const longUrl = buildDisparosDestinationLongUrl(config, nonce);
    const shortened = await generateShortUrlForDisparos(longUrl, publicBaseHints);
    return { shortUrl: shortened.shortUrl, longUrl };
}
function validateRequiredDisparosConfigPayload(input) {
    if (!input || typeof input !== "object")
        return "Objeto 'config' é obrigatório.";
    const hasValue = (key) => {
        const raw = input?.[key];
        if (raw == null)
            return false;
        if (typeof raw === "string")
            return raw.trim().length > 0;
        if (Array.isArray(raw))
            return raw.length > 0;
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
        "messageMode",
    ];
    for (const key of requiredKeys) {
        if (!hasValue(key))
            return `Campo obrigatório ausente no Disparador: ${key}.`;
    }
    const linkDestinationError = validateDisparosLinkDestination(input);
    if (linkDestinationError)
        return linkDestinationError;
    const mode = String(input?.messageMode || "").toLowerCase();
    if (mode === "ai") {
        const aiRequired = ["aiTone", "aiCta", "aiAudience", "aiBriefing"];
        for (const key of aiRequired) {
            if (!hasValue(key))
                return `Campo obrigatório ausente no modo IA: ${key}.`;
        }
    }
    return null;
}
function isLegacyDisparosDefaultConfig(input) {
    if (!input || typeof input !== "object")
        return false;
    const toInt = (v) => Math.floor(Number(v));
    const delayMin = toInt(input.delayMinSeconds);
    const delayMax = toInt(input.delayMaxSeconds);
    const maxPerHour = toInt(input.maxPerHourPerInstance);
    const maxPerDay = toInt(input.maxPerDayPerInstance);
    return (delayMin === 90 &&
        delayMax === 240 &&
        maxPerHour === 60 &&
        maxPerDay === 130);
}
async function loadDisparosConfigFromDb() {
    const supabase = getSupabaseClient();
    if (!supabase)
        return { ...DISPAROS_DEFAULTS };
    try {
        const { data, error } = await (supabase
            .from("disparos_config")
            .select("custom_config")
            .eq("id", 1)
            .maybeSingle());
        if (error)
            return { ...DISPAROS_DEFAULTS };
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
    }
    catch {
        return { ...DISPAROS_DEFAULTS };
    }
}
async function saveDisparosConfigToDb(config) {
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
    try {
        await supabase.from("disparos_config").upsert({
            id: 1,
            custom_config: config,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
    }
    catch {
        // fallback silencioso
    }
}
const EVO_API_URL = process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080";
const EVO_API_BASE = EVO_API_URL.replace(/\/$/, "");
const EVO_INSTANCES_URL = process.env.EVO_INSTANCES_URL ||
    `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_API_KEY = process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";
const EVO_REFRESH_URL_TEMPLATE = process.env.EVO_REFRESH_URL_TEMPLATE || "";
const EVO_QRCODE_URL_TEMPLATE = process.env.EVO_QRCODE_URL_TEMPLATE ||
    `${EVO_API_BASE}/instance/connect/{instance}`;
const EVO_DELETE_URL_TEMPLATE = process.env.EVO_DELETE_URL_TEMPLATE ||
    `${EVO_API_BASE}/instance/delete/{instance}`;
const EVO_RENAME_URL_TEMPLATE = process.env.EVO_RENAME_URL_TEMPLATE || `${EVO_API_BASE}/instance/rename/{instance}`;
const EVO_CREATE_INSTANCE_URL = process.env.EVO_CREATE_INSTANCE_URL || `${EVO_API_BASE}/instance/create`;
const EVO_SEND_TEXT_URL_TEMPLATE = process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EVO_LIVE_PROFILE_SYNC = process.env.EVO_LIVE_PROFILE_SYNC === "0" || process.env.EVO_LIVE_PROFILE_SYNC === "false"
    ? false
    : true;
const INSTANCE_ALIASES_FILE = (0, data_path_1.resolveDataFile)("instance-aliases.json");
const WHATSAPP_PROFILE_NAMES_FILE = (0, data_path_1.resolveDataFile)("whatsapp-profile-names.json");
/** Backup local de campanhas + leads (sobrevive a restart; não substitui Supabase quando ambos existem). */
const DISPAROS_LOCAL_STATE_FILE = (0, data_path_1.resolveDataFile)("disparos-local-state.json");
/** Última intenção explícita: aquecedor ligado/desligado (retoma após restart do processo na porta 3000). */
const RUNTIME_INTENT_FILE = (0, data_path_1.resolveDataFile)("runtime-intent.json");
const AQUECEDOR_CONFIG_FILE = (0, data_path_1.resolveDataFile)("aquecedor-config.json");
const AQUECEDOR_ENVIOS_LOG_FILE = (0, data_path_1.resolveDataFile)("aquecedor-envios-log.json");
const AQUECEDOR_COMMAND_LOG_FILE = (0, data_path_1.resolveDataFile)("aquecedor-command-log.json");
const AQUECEDOR_COMMAND_LOG_MAX = 500;
async function readAquecedorCommandLog() {
    try {
        const raw = await fs_1.promises.readFile(AQUECEDOR_COMMAND_LOG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    }
    catch {
        return [];
    }
}
async function appendAquecedorCommandLog(message, ownerEmail) {
    const text = String(message ?? "").trim();
    if (!text)
        return;
    const email = String(ownerEmail ?? aquecedorRuntimeOwnerEmail ?? "")
        .trim()
        .toLowerCase();
    const items = await readAquecedorCommandLog();
    items.unshift({
        id: crypto_1.default.randomUUID(),
        ownerEmail: email,
        at: new Date().toISOString(),
        message: text,
    });
    await fs_1.promises.mkdir(path_1.default.dirname(AQUECEDOR_COMMAND_LOG_FILE), { recursive: true });
    const tmp = `${AQUECEDOR_COMMAND_LOG_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify({ items: items.slice(0, AQUECEDOR_COMMAND_LOG_MAX) }, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, AQUECEDOR_COMMAND_LOG_FILE);
}
async function readAquecedorEnviosLog() {
    try {
        const raw = await fs_1.promises.readFile(AQUECEDOR_ENVIOS_LOG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    }
    catch {
        return [];
    }
}
async function appendAquecedorEnvioLog(row) {
    const items = await readAquecedorEnviosLog();
    items.unshift({ ...row, id: crypto_1.default.randomUUID() });
    await fs_1.promises.mkdir(path_1.default.dirname(AQUECEDOR_ENVIOS_LOG_FILE), { recursive: true });
    const tmp = `${AQUECEDOR_ENVIOS_LOG_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify({ items: items.slice(0, 500) }, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, AQUECEDOR_ENVIOS_LOG_FILE);
}
async function recordAquecedorEnvio(params) {
    const ownerEmail = String(params.ownerEmail ?? aquecedorRuntimeOwnerEmail ?? "")
        .trim()
        .toLowerCase();
    await appendAquecedorEnvioLog({
        ownerEmail,
        instanciaOrigem: params.instanciaOrigem,
        instanciaDestino: params.instanciaDestino,
        dataEnvio: params.dataEnvio || new Date().toISOString(),
        status: params.status,
    });
    if (params.status === "Envio com Sucesso") {
        void appendAquecedorCommandLog(`Envio realizado: ${params.instanciaOrigem} → ${params.instanciaDestino}`, ownerEmail);
    }
}
function aquecedorEnvioMatchesOwner(instanciaOrigem, instanciaDestino, allowed) {
    if (!allowed)
        return true;
    const origin = String(instanciaOrigem || "").trim().toLowerCase();
    const dest = String(instanciaDestino || "").trim().toLowerCase();
    if (!origin || origin === "—")
        return false;
    if (!allowed.has(origin))
        return false;
    if (dest && dest !== "—" && !/^\d{10,15}$/.test(dest) && !allowed.has(dest))
        return false;
    return true;
}
async function resolveAquecedorEnviosAllowedInstances(ownerEmail) {
    if (!(0, waba_auth_service_1.isWabaAuthConfigured)())
        return null;
    if (isAquecedorGlobalScopeOwner(ownerEmail))
        return null;
    const names = await listAquecedorScopedInstanceNames(ownerEmail);
    const aliasesMap = await loadInstanceAliasesMap();
    const allowed = new Set();
    for (const name of names) {
        const normalized = String(name || "").trim().toLowerCase();
        if (!normalized)
            continue;
        allowed.add(normalized);
        const alias = mapGetInsensitive(aliasesMap, name);
        if (alias)
            allowed.add(alias.toLowerCase());
    }
    return allowed;
}
const AQUECEDOR_FALLBACK_MESSAGE = "Olá! Tudo bem? Mensagem automática do aquecedor.";
const AQUECEDOR_RECENT_SENT_LIMIT = 50;
const AQUECEDOR_MESSAGE_BANK_LIMIT = 5000;
const AQUECEDOR_PAIR_SENT_LIMIT = 500;
function buildAquecedorPairContext(chosen, connected) {
    const origem = connected.find((item) => item.instancia === chosen.instancia_origem);
    return {
        instanciaOrigem: chosen.instancia_origem,
        instanciaDestino: chosen.instancia_destino,
        numeroOrigem: String(origem?.numero || "").trim(),
        numeroDestino: String(chosen.numero_whatsapp || "").trim(),
    };
}
const AQUECEDOR_PAIR_SENDER_LOOKBACK = 500;
function buildAquecedorInstanceCanonicalMap(connected, aliasesMap) {
    const primaryByLower = new Map();
    for (const item of connected) {
        const name = String(item.instancia || "").trim();
        if (name)
            primaryByLower.set(name.toLowerCase(), name);
    }
    const canonical = new Map();
    const bind = (raw, primary) => {
        const key = String(raw || "").trim().toLowerCase();
        const value = String(primary || "").trim();
        if (key && value)
            canonical.set(key, value);
    };
    for (const item of connected) {
        bind(item.instancia, item.instancia);
    }
    for (const [technical, alias] of aliasesMap) {
        const primary = primaryByLower.get(String(technical || "").trim().toLowerCase()) || String(technical || "").trim();
        if (!primary)
            continue;
        bind(technical, primary);
        bind(alias, primary);
    }
    return canonical;
}
function resolveAquecedorCanonicalInstance(name, canonicalMap) {
    const key = String(name || "").trim().toLowerCase();
    if (!key)
        return "";
    return canonicalMap.get(key) || String(name || "").trim();
}
function buildAquecedorPairKey(instanciaA, instanciaB) {
    const a = String(instanciaA || "").trim();
    const b = String(instanciaB || "").trim();
    return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}
function buildAquecedorDirectedKey(instanciaOrigem, instanciaDestino) {
    const origem = String(instanciaOrigem || "").trim().toLowerCase();
    const destino = String(instanciaDestino || "").trim().toLowerCase();
    return `${origem}→${destino}`;
}
function buildAquecedorNumberToInstanceMap(connected, canonicalMap) {
    const map = new Map();
    for (const item of connected) {
        const num = normalizeWhatsAppNumber(String(item.numero || "").trim());
        const inst = resolveAquecedorCanonicalInstance(item.instancia, canonicalMap);
        if (num && inst)
            map.set(num, inst);
    }
    return map;
}
function resolveAquecedorInstanceByNumber(rawNumber, numberToInstance) {
    const normalized = normalizeWhatsAppNumber(String(rawNumber || "").trim());
    if (!normalized)
        return "";
    const direct = numberToInstance.get(normalized);
    if (direct)
        return direct;
    const suffix = normalized.replace(/\D/g, "").slice(-10);
    if (suffix.length < 10)
        return "";
    for (const [stored, inst] of numberToInstance.entries()) {
        if (stored.replace(/\D/g, "").slice(-10) === suffix)
            return inst;
    }
    return "";
}
function resolveAquecedorConnectedByName(connected, canonicalMap, name) {
    const target = resolveAquecedorCanonicalInstance(name, canonicalMap).toLowerCase();
    return (connected.find((item) => resolveAquecedorCanonicalInstance(item.instancia, canonicalMap).toLowerCase() === target) || null);
}
async function loadAquecedorExchangeEvents(supabase, connected, canonicalMap, numberToInstance) {
    const events = [];
    const instanceNames = connected.map((item) => item.instancia);
    const connectedCanonical = new Set(instanceNames.map((name) => resolveAquecedorCanonicalInstance(name, canonicalMap).toLowerCase()));
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("instancia, numero_destino, sent_at")
            .eq("status", "ENVIADO")
            .order("sent_at", { ascending: false })
            .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK));
        if (!error && Array.isArray(data)) {
            for (const row of data) {
                const fromInst = resolveAquecedorCanonicalInstance(String(row?.instancia || ""), canonicalMap);
                const toInst = resolveAquecedorInstanceByNumber(String(row?.numero_destino || ""), numberToInstance);
                const at = String(row?.sent_at || "").trim();
                if (fromInst &&
                    toInst &&
                    at &&
                    connectedCanonical.has(fromInst.toLowerCase()) &&
                    connectedCanonical.has(toInst.toLowerCase())) {
                    events.push({ at, fromInst, toInst });
                }
            }
        }
    }
    catch {
        /* */
    }
    try {
        const { data, error } = await (supabase
            .from("logs_envios")
            .select("instancia_origem, instancia_destino, data_envio")
            .order("data_envio", { ascending: false })
            .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK));
        if (!error && Array.isArray(data)) {
            for (const row of data) {
                const fromInst = resolveAquecedorCanonicalInstance(String(row?.instancia_origem || ""), canonicalMap);
                const toInst = resolveAquecedorCanonicalInstance(String(row?.instancia_destino || ""), canonicalMap);
                const at = String(row?.data_envio || "").trim();
                if (fromInst &&
                    toInst &&
                    at &&
                    connectedCanonical.has(fromInst.toLowerCase()) &&
                    connectedCanonical.has(toInst.toLowerCase())) {
                    events.push({ at, fromInst, toInst });
                }
            }
        }
    }
    catch {
        /* */
    }
    const dedup = new Map();
    for (const ev of events) {
        const atMs = new Date(ev.at).getTime();
        const bucket = Number.isFinite(atMs) ? Math.floor(atMs / 1000) : ev.at;
        const key = `${ev.fromInst.toLowerCase()}|${ev.toInst.toLowerCase()}|${bucket}`;
        if (!dedup.has(key))
            dedup.set(key, ev);
    }
    return Array.from(dedup.values()).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
async function loadAquecedorTurnManager(supabase, connected) {
    const aliasesMap = await loadInstanceAliasesMap();
    const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
    const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
    const events = await loadAquecedorExchangeEvents(supabase, connected, canonicalMap, numberToInstance);
    const instanceStats = new Map();
    const pairLastSender = new Map();
    const pairStates = new Map();
    const directedSendCounts = new Map();
    const ensureStats = (canonical) => {
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
    const ensurePairState = (pairKey) => {
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
        const directedKey = buildAquecedorDirectedKey(ev.fromInst, ev.toInst);
        directedSendCounts.set(directedKey, (directedSendCounts.get(directedKey) || 0) + 1);
        const pairKey = buildAquecedorPairKey(ev.fromInst, ev.toInst);
        const pairState = ensurePairState(pairKey);
        pairState.exchangeCount += 1;
        if (pairState.pendingReplyFrom?.toLowerCase() === ev.fromInst.toLowerCase()) {
            pairState.pendingReplyFrom = null;
        }
        else {
            pairState.pendingReplyFrom = ev.toInst;
        }
    }
    const recentDirectedEdges = [];
    for (let i = events.length - 1; i >= 0 && recentDirectedEdges.length < 32; i -= 1) {
        const ev = events[i];
        recentDirectedEdges.push(buildAquecedorDirectedKey(ev.fromInst, ev.toInst));
    }
    const owesPairReply = (origemRaw, destinoRaw) => {
        const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
        const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
        if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase())
            return false;
        const pairKey = buildAquecedorPairKey(origem, destino);
        const pairState = pairStates.get(pairKey);
        return pairState?.pendingReplyFrom?.toLowerCase() === origem.toLowerCase();
    };
    const canSendDirected = (origemRaw, destinoRaw) => {
        const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
        const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
        if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase())
            return false;
        const pairKey = buildAquecedorPairKey(origem, destino);
        const lastSender = pairLastSender.get(pairKey);
        if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) {
            return false;
        }
        if (owesPairReply(origemRaw, destinoRaw)) {
            return true;
        }
        const stats = instanceStats.get(origem.toLowerCase());
        if (!stats?.lastSentAt || stats.outboundSinceInbound === 0)
            return true;
        return false;
    };
    const describeBlockReason = (origemRaw, destinoRaw) => {
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
    const scoreEquityCombination = (origemRaw, destinoRaw, comboIndex, startIndex, equityBaseline) => {
        const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
        const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
        const directedKey = buildAquecedorDirectedKey(origem, destino);
        const directed = directedSendCounts.get(directedKey) ?? 0;
        const oSend = instanceStats.get(origem.toLowerCase())?.sendCount ?? 0;
        const dRecv = instanceStats.get(destino.toLowerCase())?.receiveCount ?? 0;
        let score = (directed - equityBaseline.minDirected) * 1000000000000;
        score += (oSend - equityBaseline.minOriginSend) * 1000000000;
        score += (dRecv - equityBaseline.minDestReceive) * 1000000;
        const recentIdx = recentDirectedEdges.indexOf(directedKey);
        if (recentIdx >= 0) {
            score += (recentIdx + 1) * 10000;
        }
        // Resposta pendente só desempata — não monopoliza o ciclo (equidade primeiro).
        if (owesPairReply(origemRaw, destinoRaw)) {
            score -= 500;
        }
        const rotation = ((comboIndex - startIndex) % 1000 + 1000) % 1000;
        score += rotation * 0.001;
        return score;
    };
    const getDirectedSendCount = (origemRaw, destinoRaw) => {
        const origem = resolveAquecedorCanonicalInstance(origemRaw, canonicalMap);
        const destino = resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap);
        if (!origem || !destino)
            return 0;
        return directedSendCounts.get(buildAquecedorDirectedKey(origem, destino)) ?? 0;
    };
    const getOriginSendCount = (origemRaw) => instanceStats.get(resolveAquecedorCanonicalInstance(origemRaw, canonicalMap).toLowerCase())?.sendCount ?? 0;
    const getDestReceiveCount = (destinoRaw) => instanceStats.get(resolveAquecedorCanonicalInstance(destinoRaw, canonicalMap).toLowerCase())?.receiveCount ?? 0;
    const getUndirectedPairSendTotal = (instA, instB) => getDirectedSendCount(instA, instB) + getDirectedSendCount(instB, instA);
    const getTotalDirectedSendCount = () => {
        let total = 0;
        for (const count of directedSendCounts.values())
            total += count;
        return total;
    };
    return {
        canonicalMap,
        totalEvents: events.length,
        recentDirectedEdges,
        canSendDirected,
        owesPairReply,
        describeBlockReason,
        getDirectedSendCount,
        getOriginSendCount,
        getDestReceiveCount,
        getUndirectedPairSendTotal,
        getTotalDirectedSendCount,
        scoreEquityCombination,
    };
}
async function canAquecedorOrigemSendDirected(supabase, connected, instanciaOrigem, instanciaDestino, manager) {
    const turn = manager || (await loadAquecedorTurnManager(supabase, connected));
    return turn.canSendDirected(instanciaOrigem, instanciaDestino);
}
async function pickAquecedorCombinationAsync(supabase, connected, combinations, startIndex) {
    if (!combinations.length)
        return null;
    const manager = await loadAquecedorTurnManager(supabase, connected);
    let eligible = [];
    for (let index = 0; index < combinations.length; index += 1) {
        const combo = combinations[index];
        if (!manager.canSendDirected(combo.instancia_origem, combo.instancia_destino))
            continue;
        eligible.push({ combo, index });
    }
    if (!eligible.length)
        return null;
    const instanceCount = Math.max(2, connected.length);
    const maxUndirectedPairShare = Math.max(0.5, 2 / instanceCount);
    const totalDirectedSends = manager.getTotalDirectedSendCount();
    if (totalDirectedSends >= instanceCount) {
        const nonSaturated = eligible.filter(({ combo }) => {
            const pairTotal = manager.getUndirectedPairSendTotal(combo.instancia_origem, combo.instancia_destino);
            return pairTotal / totalDirectedSends <= maxUndirectedPairShare;
        });
        if (nonSaturated.length) {
            eligible = nonSaturated;
        }
    }
    let minDirected = Number.POSITIVE_INFINITY;
    let minOriginSend = Number.POSITIVE_INFINITY;
    let minDestReceive = Number.POSITIVE_INFINITY;
    for (const { combo } of eligible) {
        minDirected = Math.min(minDirected, manager.getDirectedSendCount(combo.instancia_origem, combo.instancia_destino));
        minOriginSend = Math.min(minOriginSend, manager.getOriginSendCount(combo.instancia_origem));
        minDestReceive = Math.min(minDestReceive, manager.getDestReceiveCount(combo.instancia_destino));
    }
    if (!Number.isFinite(minDirected))
        minDirected = 0;
    if (!Number.isFinite(minOriginSend))
        minOriginSend = 0;
    if (!Number.isFinite(minDestReceive))
        minDestReceive = 0;
    const equityBaseline = { minDirected, minOriginSend, minDestReceive };
    const scored = eligible.map(({ combo, index }) => ({
        combo,
        index,
        score: manager.scoreEquityCombination(combo.instancia_origem, combo.instancia_destino, index, startIndex, equityBaseline),
    }));
    scored.sort((a, b) => a.score - b.score);
    const bestScore = scored[0].score;
    const ties = scored.filter((item) => item.score === bestScore);
    const base = ((startIndex % ties.length) + ties.length) % ties.length;
    const picked = ties[base];
    return { chosen: picked.combo, index: picked.index };
}
async function loadRecentAquecedorPairLastSenders(supabase, connected) {
    const aliasesMap = await loadInstanceAliasesMap();
    const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
    const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
    const lastSenders = new Map();
    const instanceNames = connected.map((item) => item.instancia);
    if (instanceNames.length < 2)
        return lastSenders;
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("instancia, numero_destino, sent_at")
            .eq("status", "ENVIADO")
            .in("instancia", instanceNames)
            .order("sent_at", { ascending: false })
            .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK));
        if (error || !Array.isArray(data))
            return lastSenders;
        for (const row of data) {
            const fromInst = resolveAquecedorCanonicalInstance(String(row?.instancia || ""), canonicalMap);
            const toInst = resolveAquecedorInstanceByNumber(String(row?.numero_destino || ""), numberToInstance);
            if (!fromInst || !toInst || fromInst.toLowerCase() === toInst.toLowerCase())
                continue;
            const key = buildAquecedorPairKey(fromInst, toInst);
            if (lastSenders.has(key))
                continue;
            lastSenders.set(key, fromInst);
        }
    }
    catch {
        /* */
    }
    return lastSenders;
}
async function verifyAquecedorConversationTurn(supabase, connected, instanciaOrigem, instanciaDestino) {
    const manager = await loadAquecedorTurnManager(supabase, connected);
    const origem = resolveAquecedorCanonicalInstance(instanciaOrigem, manager.canonicalMap);
    const destino = resolveAquecedorCanonicalInstance(instanciaDestino, manager.canonicalMap);
    if (!manager.canSendDirected(instanciaOrigem, instanciaDestino)) {
        return {
            ok: false,
            reason: manager.describeBlockReason(instanciaOrigem, instanciaDestino),
        };
    }
    return { ok: true, reason: "" };
}
function buildAquecedorEnvioDedupKey(item) {
    if (item.status === "Envio com Sucesso") {
        return `${item.instanciaOrigem}|${item.instanciaDestino}|${item.dataEnvioBr}|${item.status}`;
    }
    const ts = item.dataEnvio ? String(item.dataEnvio) : "";
    return `${item.instanciaOrigem}|${item.instanciaDestino}|${ts}|${item.status}`;
}
async function hasRecentAquecedorSendBetween(supabase, connected, instanciaOrigem, instanciaDestino, withinSeconds) {
    const aliasesMap = await loadInstanceAliasesMap();
    const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
    const origem = resolveAquecedorConnectedByName(connected, canonicalMap, instanciaOrigem);
    const destino = resolveAquecedorConnectedByName(connected, canonicalMap, instanciaDestino);
    if (!origem || !destino)
        return false;
    const numDestino = resolveAquecedorInstanceDigits(destino.numero);
    if (!numDestino)
        return false;
    const since = new Date(Date.now() - Math.max(30, withinSeconds) * 1000).toISOString();
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("id")
            .eq("status", "ENVIADO")
            .eq("instancia", origem.instancia)
            .eq("numero_destino", numDestino)
            .gte("sent_at", since)
            .limit(1));
        if (!error && Array.isArray(data) && data.length > 0)
            return true;
    }
    catch {
        /* */
    }
    try {
        const { data, error } = await (supabase
            .from("logs_envios")
            .select("id")
            .eq("instancia_origem", origem.instancia)
            .eq("instancia_destino", destino.instancia)
            .gte("data_envio", since)
            .limit(1));
        if (error)
            return false;
        return Array.isArray(data) && data.length > 0;
    }
    catch {
        return false;
    }
}
const isAquecedorSystemMessage = (text) => {
    const value = String(text || "").trim().toLowerCase();
    if (!value)
        return true;
    return (value === AQUECEDOR_FALLBACK_MESSAGE.toLowerCase() ||
        value.includes("mensagem de teste do aquecedor") ||
        value.includes("teste de integração waba"));
};
const collectAquecedorMessageTexts = (rows, fields) => {
    const texts = [];
    if (!Array.isArray(rows))
        return texts;
    for (const row of rows) {
        if (!row || typeof row !== "object")
            continue;
        for (const field of fields) {
            const text = String(row[field] || "").trim();
            if (text && !isAquecedorSystemMessage(text)) {
                texts.push(text);
                break;
            }
        }
    }
    return texts;
};
async function loadAquecedorMessageBank(supabase) {
    const unique = new Set();
    const bankQueries = [
        { table: "aquecedor_message_templates", fields: ["message_text"], activeOnly: true },
        { table: "mensagens", fields: ["mensagem", "texto", "message_text", "conteudo"] },
        { table: "disparos_message_templates", fields: ["message_text"], activeOnly: true },
    ];
    for (const query of bankQueries) {
        try {
            let request = supabase
                .from(query.table)
                .select(query.fields.join(", "))
                .limit(AQUECEDOR_MESSAGE_BANK_LIMIT);
            if (query.activeOnly) {
                request = request.eq("active", true);
            }
            const { data, error } = (await request);
            if (error)
                continue;
            for (const text of collectAquecedorMessageTexts(data, query.fields)) {
                unique.add(text);
            }
        }
        catch {
            /* tabela pode não existir neste ambiente */
        }
        if (unique.size > 0)
            break;
    }
    if (!unique.size) {
        try {
            const { data, error } = await (supabase
                .from("aquecedor")
                .select("mensagem")
                .eq("status", "ENVIADO")
                .order("sent_at", { ascending: false })
                .limit(AQUECEDOR_MESSAGE_BANK_LIMIT));
            if (!error) {
                for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
                    unique.add(text);
                }
            }
        }
        catch {
            /* */
        }
    }
    return Array.from(unique);
}
async function loadRecentlySentAquecedorMessages(supabase) {
    const recent = new Set();
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("mensagem")
            .eq("status", "ENVIADO")
            .order("sent_at", { ascending: false })
            .limit(AQUECEDOR_RECENT_SENT_LIMIT));
        if (error)
            return recent;
        for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
            recent.add(text);
        }
    }
    catch {
        /* */
    }
    return recent;
}
async function loadQueuedAquecedorMessages(supabase) {
    const queued = new Set();
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("mensagem")
            .in("status", ["PENDENTE", "PROCESSANDO"])
            .limit(200));
        if (error)
            return queued;
        for (const text of collectAquecedorMessageTexts(data, ["mensagem"])) {
            queued.add(text);
        }
    }
    catch {
        /* */
    }
    return queued;
}
async function loadPairUsedAquecedorMessages(supabase, pair) {
    const used = new Set();
    const instanciaA = String(pair.instanciaOrigem || "").trim();
    const instanciaB = String(pair.instanciaDestino || "").trim();
    const numA = resolveAquecedorInstanceDigits(String(pair.numeroOrigem || "").trim());
    const numB = resolveAquecedorInstanceDigits(String(pair.numeroDestino || "").trim());
    if (!instanciaA || !instanciaB || !numA || !numB)
        return used;
    try {
        const { data, error } = await (supabase
            .from("aquecedor")
            .select("mensagem, instancia, numero_destino")
            .eq("status", "ENVIADO")
            .in("instancia", [instanciaA, instanciaB])
            .order("sent_at", { ascending: false })
            .limit(AQUECEDOR_PAIR_SENT_LIMIT));
        if (error)
            return used;
        if (!Array.isArray(data))
            return used;
        for (const row of data) {
            const inst = String(row?.instancia || "").trim();
            const numDest = resolveAquecedorInstanceDigits(String(row?.numero_destino || "").trim());
            const isAB = inst === instanciaA && numDest === numB;
            const isBA = inst === instanciaB && numDest === numA;
            if (!isAB && !isBA)
                continue;
            const text = String(row?.mensagem || "").trim();
            if (text && !isAquecedorSystemMessage(text))
                used.add(text);
        }
    }
    catch {
        /* */
    }
    return used;
}
async function buildAquecedorExcludeSet(supabase, pair) {
    const exclude = await loadRecentlySentAquecedorMessages(supabase);
    const queued = await loadQueuedAquecedorMessages(supabase);
    for (const text of queued)
        exclude.add(text);
    if (pair) {
        const pairUsed = await loadPairUsedAquecedorMessages(supabase, pair);
        for (const text of pairUsed)
            exclude.add(text);
    }
    return exclude;
}
async function pickAquecedorMessageText(supabase, extraExclude) {
    const bank = await loadAquecedorMessageBank(supabase);
    if (!bank.length)
        return AQUECEDOR_FALLBACK_MESSAGE;
    const exclude = extraExclude ? new Set(extraExclude) : await buildAquecedorExcludeSet(supabase);
    let candidates = bank.filter((text) => !exclude.has(text));
    if (!candidates.length)
        candidates = bank;
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index] || AQUECEDOR_FALLBACK_MESSAGE;
}
async function resolveAquecedorMessageForSend(supabase, pendingId, pendingText, pair) {
    const exclude = await buildAquecedorExcludeSet(supabase, pair);
    const current = String(pendingText || "").trim();
    if (current && !isAquecedorSystemMessage(current) && !exclude.has(current))
        return current;
    const mensagem = await pickAquecedorMessageText(supabase, exclude);
    await supabase.from("aquecedor")
        .update({ mensagem })
        .eq("id", pendingId);
    return mensagem;
}
async function releaseStuckAquecedorQueueRows(supabase) {
    const cutoff = new Date(Date.now() - AQUECEDOR_QUEUE_STUCK_MS).toISOString();
    const resetPayload = {
        status: "PENDENTE",
        instancia: null,
        numero_destino: null,
        processing_at: null,
        sent_at: null,
    };
    await supabase.from("aquecedor")
        .update(resetPayload)
        .eq("status", "PROCESSANDO")
        .lt("processing_at", cutoff);
    await supabase.from("aquecedor")
        .update(resetPayload)
        .eq("status", "PROCESSANDO")
        .is("processing_at", null)
        .lt("scheduled_at", cutoff);
}
async function fetchProcessableAquecedorPending(supabase) {
    const now = new Date().toISOString();
    const { data } = (await (supabase
        .from("aquecedor")
        .select("id, mensagem, status, scheduled_at")
        .eq("status", "PENDENTE")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle()));
    return data ?? null;
}
async function ensureAquecedorPendingMessageOnce(pair) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { ok: false, reason: "Supabase não configurado ao preparar fila do aquecedor." };
    }
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const { count: processableCount, error: processableError } = (await (supabase
        .from("aquecedor")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDENTE")
        .lte("scheduled_at", now)));
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
        .from("aquecedor")
        .select("id, mensagem, scheduled_at")
        .eq("status", "PENDENTE")
        .order("scheduled_at", { ascending: true, nullsFirst: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle()));
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
        let mensagem;
        if (pair) {
            const exclude = await buildAquecedorExcludeSet(supabase, pair);
            const current = String(oldestPending.mensagem || "").trim();
            if (!current || isAquecedorSystemMessage(current) || exclude.has(current)) {
                mensagem = await pickAquecedorMessageText(supabase, exclude);
            }
        }
        if (!processableNow || mensagem) {
            const payload = { scheduled_at: now };
            if (mensagem)
                payload.mensagem = mensagem;
            const { error: promoteError } = await supabase.from("aquecedor")
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
    const { data: inserted, error: insertError } = await supabase.from("aquecedor")
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
async function ensureAquecedorPendingMessage(pair) {
    let lastResult = {
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
        console.warn(`[Aquecedor] ensure fila tentativa ${attempt + 1}/3 falhou:`, lastResult.reason);
    }
    return {
        ok: false,
        reason: await describeSupabaseConnectivityFailure(),
    };
}
/** Checkpoint em disco das campanhas mesmo sem evento (ms). Env: DISPAROS_CHECKPOINT_MS */
const DISPAROS_CHECKPOINT_MS = Math.max(30000, Number.isFinite(Number(process.env.DISPAROS_CHECKPOINT_MS))
    ? Number(process.env.DISPAROS_CHECKPOINT_MS)
    : 120000);
const MESSENGER_PRODUCTS_FILE = path_1.default.join(process.cwd(), "data", "disparos-messenger-products.json");
let messengerProductsWriteChain = Promise.resolve();
function runMessengerProductsLocked(fn) {
    const next = messengerProductsWriteChain.then(fn, fn);
    messengerProductsWriteChain = next.then(() => undefined, () => undefined);
    return next;
}
function buildMessengerAiBriefingFromFields(row) {
    const read = (v, fallback) => String(v || "").trim() || fallback;
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
function parseMessengerProductFromBody(body) {
    const displayName = String(body?.displayName || "").trim();
    if (!displayName || displayName.length > 200)
        return null;
    const slice = (v, max) => String(v ?? "").slice(0, max);
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
        id: crypto_1.default.randomUUID(),
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
async function loadMessengerProductsFromFile() {
    try {
        const raw = await fs_1.promises.readFile(MESSENGER_PRODUCTS_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const items = parsed?.items;
        if (!Array.isArray(items))
            return [];
        return items
            .filter((row) => row &&
            typeof row.id === "string" &&
            typeof row.displayName === "string" &&
            row.displayName.trim().length > 0)
            .map((row) => ({
            id: String(row.id),
            displayName: String(row.displayName).trim(),
            aiTone: String(row.aiTone || DISPAROS_DEFAULTS.aiTone).slice(0, 120),
            aiCta: String(row.aiCta || DISPAROS_DEFAULTS.aiCta).slice(0, 240),
            aiAudience: String(row.aiAudience || DISPAROS_DEFAULTS.aiAudience).slice(0, 240),
            aiProduct: String(row.aiProduct || "").slice(0, 500),
            aiObjective: String(row.aiObjective || "").slice(0, 500),
            aiPains: String(row.aiPains || "").slice(0, 4000),
            aiDifferentials: String(row.aiDifferentials || "").slice(0, 4000),
            aiProhibitions: String(row.aiProhibitions || "").slice(0, 4000),
            aiNotes: String(row.aiNotes || "").slice(0, 4000),
            aiBriefing: String(row.aiBriefing || "").slice(0, 8000),
            updatedAt: String(row.updatedAt || new Date().toISOString()),
        }));
    }
    catch {
        return [];
    }
}
async function saveMessengerProductsToFile(items) {
    await fs_1.promises.mkdir(path_1.default.dirname(MESSENGER_PRODUCTS_FILE), { recursive: true });
    await fs_1.promises.writeFile(MESSENGER_PRODUCTS_FILE, JSON.stringify({ items }, null, 2), "utf-8");
}
let instanceAliasesCache = null;
let whatsappProfileNamesCache = null;
async function loadInstanceAliasesMap() {
    if (instanceAliasesCache)
        return new Map(instanceAliasesCache);
    try {
        const raw = await fs_1.promises.readFile(INSTANCE_ALIASES_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const map = new Map();
        if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([k, v]) => {
                const key = String(k || "").trim();
                const val = String(v || "").trim();
                if (key && val)
                    map.set(key, val);
            });
        }
        instanceAliasesCache = map;
        return new Map(map);
    }
    catch {
        instanceAliasesCache = new Map();
        return new Map(instanceAliasesCache);
    }
}
async function persistInstanceAliasesMap(nextMap) {
    instanceAliasesCache = new Map(nextMap);
    const obj = {};
    nextMap.forEach((v, k) => {
        if (k && v)
            obj[k] = v;
    });
    await fs_1.promises.mkdir(path_1.default.dirname(INSTANCE_ALIASES_FILE), { recursive: true });
    await fs_1.promises.writeFile(INSTANCE_ALIASES_FILE, JSON.stringify(obj, null, 2), "utf-8");
}
async function loadWhatsappProfileNamesMap() {
    if (whatsappProfileNamesCache)
        return new Map(whatsappProfileNamesCache);
    try {
        const raw = await fs_1.promises.readFile(WHATSAPP_PROFILE_NAMES_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const map = new Map();
        if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([k, v]) => {
                const key = String(k || "").trim();
                const val = String(v || "").trim();
                if (key && val)
                    map.set(key, val);
            });
        }
        whatsappProfileNamesCache = map;
        return new Map(map);
    }
    catch {
        whatsappProfileNamesCache = new Map();
        return new Map(whatsappProfileNamesCache);
    }
}
async function persistWhatsappProfileNamesMap(nextMap) {
    whatsappProfileNamesCache = new Map(nextMap);
    const obj = {};
    nextMap.forEach((v, k) => {
        if (k && v)
            obj[k] = v;
    });
    await fs_1.promises.mkdir(path_1.default.dirname(WHATSAPP_PROFILE_NAMES_FILE), { recursive: true });
    await fs_1.promises.writeFile(WHATSAPP_PROFILE_NAMES_FILE, JSON.stringify(obj, null, 2), "utf-8");
}
const DAY_CODES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DAY_TO_NUM = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const AQUECEDOR_DEFAULTS = {
    expediente: [
        { days: ["seg", "ter", "qua"], startHour: 7, endHour: 22 },
        { days: ["qui", "sex", "sab", "dom"], startHour: 6, endHour: 20 },
    ],
    janelaAtivaMinutos: 60,
    pausaMinutos: 14,
    waitMinSeconds: 300,
    waitMaxSeconds: 900,
};
const DISPAROS_DEFAULTS = {
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
    linkDestinationMode: "whatsapp",
    whatsappTargetNumber: "",
    responseUrl: "",
    selectedDisparadorInstances: [],
};
function isDisparosWindowOpen(config, now) {
    const day = now.getDay();
    const dayCode = DAY_CODES[day];
    const days = Array.isArray(config.workingDays) && config.workingDays.length > 0
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
function startOfNextCalendarDayLocal(d) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + 1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function atStartHourOnSameLocalDay(dayRef, startHour) {
    const x = new Date(dayRef.getTime());
    x.setHours(startHour, 0, 0, 0);
    return x;
}
/**
 * Próximo instante em que o expediente do Disparador **abre** (mesmo relógio local que `fromSp`).
 * Retorna `null` se já estiver dentro da janela ou após esgotar o limite de busca.
 */
function findNextDisparosWindowStart(config, fromSp) {
    const dayCodes = Array.isArray(config.workingDays) && config.workingDays.length > 0
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
const instanceUsageMemory = new Map();
const disparosTemplatesMemory = [];
const disparosCampaignsMemory = [];
const disparosCampaignLeadsMemory = [];
const disparosCreditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService();
let disparosLocalPersistChain = Promise.resolve();
function removeLeadsForCampaignFromMemory(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id)
        return;
    for (let k = disparosCampaignLeadsMemory.length - 1; k >= 0; k--) {
        if (disparosCampaignLeadsMemory[k].campaignId === id)
            disparosCampaignLeadsMemory.splice(k, 1);
    }
}
function queuePersistDisparosLocalState() {
    disparosLocalPersistChain = disparosLocalPersistChain.then(async () => {
        try {
            await fs_1.promises.mkdir(path_1.default.dirname(DISPAROS_LOCAL_STATE_FILE), { recursive: true });
            const payload = {
                version: 1,
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
            await fs_1.promises.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
            await fs_1.promises.rename(tmp, DISPAROS_LOCAL_STATE_FILE);
        }
        catch (e) {
            console.error("[Campanhas] falha ao gravar estado local:", e);
        }
    });
}
async function loadDisparosLocalState() {
    try {
        const raw = await fs_1.promises.readFile(DISPAROS_LOCAL_STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.leads)) {
            return;
        }
        const seenC = new Set(disparosCampaignsMemory.map((c) => c.id));
        for (const c of parsed.campaigns) {
            const id = String(c?.id || "").trim();
            if (!id || seenC.has(id))
                continue;
            seenC.add(id);
            const st = String(c?.status || "paused").toLowerCase();
            const status = st === "running" || st === "paused" || st === "finished" || st === "draft" ? st : "paused";
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
            if (!id || seenL.has(id))
                continue;
            seenL.add(id);
            const st = String(l?.status || "pending").toLowerCase();
            const status = st === "sent" ? "sent" : st === "failed" ? "failed" : "pending";
            const fk = l?.failureKind;
            const failureKind = fk === "invalid_phone" || fk === "destination_error" || fk === "send_error" ? fk : undefined;
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
        console.log(`[Campanhas] estado local carregado de ${DISPAROS_LOCAL_STATE_FILE} (${parsed.campaigns.length} campanha(s) no arquivo).`);
    }
    catch (e) {
        if (e?.code !== "ENOENT") {
            console.error("[Campanhas] falha ao ler estado local:", e);
        }
    }
}
const campaignNextAllowedSendAt = new Map();
const campaignDisparadorRoundRobin = new Map();
let disparosRoundRobinCounter = 0;
const alternativaNumbersService = new waba_alternativa_numbers_service_1.WabaAlternativaNumbersService();
const alternativaActivationRepository = new alternativa_number_activation_repository_1.AlternativaNumberActivationRepository();
const instanceDailySendCounts = new Map();
let lastShortUrlIssued = "";
const shortUrlClicksCache = new Map();
function normalizeShortenerProvider(value) {
    const raw = String(value || process.env.SHORTENER_PROVIDER || "waba")
        .trim()
        .toLowerCase();
    if (raw === "encurtadorpro")
        return "encurtadorpro";
    if (raw === "isgd")
        return "isgd";
    if (raw === "tinyurl")
        return "tinyurl";
    return "waba";
}
function getAutoShortenerProviderOrder() {
    const primary = normalizeShortenerProvider(process.env.SHORTENER_PROVIDER);
    const order = [primary];
    if (primary === "waba" && String(process.env.ENCURTADORPRO_API_KEY || "").trim()) {
        order.push("encurtadorpro");
    }
    else if (primary === "encurtadorpro") {
        order.push("waba");
    }
    return Array.from(new Set(order));
}
const aquecedorRuntime = {
    running: false,
    isProcessing: false,
    nextAllowedAt: null,
    lastRunAt: null,
    lastResult: null,
    lastEvoError: null,
};
let aquecedorScheduleTimer = null;
let aquecedorRuntimeOwnerEmail = null;
const AQUECEDOR_CYCLE_TICK_MIN_MS = 5000;
const AQUECEDOR_CYCLE_TICK_MAX_MS = 30000;
const AQUECEDOR_PROCESSING_STALE_MS = 8 * 60 * 1000;
const AQUECEDOR_QUEUE_STUCK_MS = 3 * 60 * 1000;
const AQUECEDOR_WORKER_LEASE_MS = 90000;
const AQUECEDOR_WORKER_SYNC_MS = 12000;
const AQUECEDOR_PERSISTED_RELOAD_MS = 2000;
const AQUECEDOR_WORKER_ID = `${(0, os_1.hostname)()}:${process.pid}`;
function createDefaultAquecedorRuntimeSnapshot() {
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
let aquecedorPersistedBundle = {
    desired: null,
    ownerEmail: null,
    snapshot: createDefaultAquecedorRuntimeSnapshot(),
};
let aquecedorPersistedBundleReloadedAt = 0;
let aquecedorPersistedBundleSavedAtMs = 0;
let aquecedorConnectedSummaryCache = { count: 0, names: [], preparingCount: 0, preparingNames: [], totalEnabled: 0, at: 0 };
function updateAquecedorConnectedSummary(connected, connectedAll = connected) {
    const activeKeys = new Set(connected.map((item) => item.instancia.toLowerCase()));
    const preparingNames = connectedAll
        .filter((item) => !activeKeys.has(item.instancia.toLowerCase()))
        .map((item) => item.instancia);
    aquecedorConnectedSummaryCache = {
        count: connected.length,
        names: connected.map((item) => item.instancia),
        preparingCount: preparingNames.length,
        preparingNames,
        totalEnabled: connectedAll.length,
        at: Date.now(),
    };
}
function getAquecedorWorkerId() {
    return AQUECEDOR_WORKER_ID;
}
function isAquecedorWorkerLeaseValid(snapshot) {
    if (!snapshot.workerHeartbeatAt)
        return false;
    const heartbeatMs = new Date(snapshot.workerHeartbeatAt).getTime();
    if (!Number.isFinite(heartbeatMs))
        return false;
    return Date.now() - heartbeatMs <= AQUECEDOR_WORKER_LEASE_MS;
}
function shouldThisProcessLeadAquecedor(bundle) {
    if (bundle.desired !== true || !bundle.snapshot.running)
        return false;
    const snapshot = bundle.snapshot;
    if (snapshot.workerId === getAquecedorWorkerId())
        return true;
    if (!snapshot.workerId || !isAquecedorWorkerLeaseValid(snapshot))
        return true;
    return false;
}
function isAquecedorProcessingSnapshotStale(snapshot) {
    if (!snapshot.isProcessing)
        return false;
    const lastRunMs = snapshot.lastRunAt ? new Date(snapshot.lastRunAt).getTime() : Number.NaN;
    if (!Number.isFinite(lastRunMs))
        return true;
    return Date.now() - lastRunMs > AQUECEDOR_PROCESSING_STALE_MS;
}
function applyPersistedSnapshotToLocal(snapshot) {
    aquecedorRuntime.running = snapshot.running === true;
    aquecedorRuntime.isProcessing =
        snapshot.isProcessing === true && !isAquecedorProcessingSnapshotStale(snapshot);
    aquecedorRuntime.nextAllowedAt = snapshot.nextAllowedAt;
    aquecedorRuntime.lastRunAt = snapshot.lastRunAt;
    aquecedorRuntime.lastResult = snapshot.lastResult;
    aquecedorRuntime.lastEvoError = snapshot.lastEvoError;
}
function buildPersistedSnapshotFromLocal(overrides = {}) {
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
function parseAquecedorRuntimePersistedBundle(raw) {
    const p = raw;
    const version = Number(p?.version);
    if (version !== 1 && version !== 2) {
        return {
            desired: null,
            ownerEmail: null,
            snapshot: createDefaultAquecedorRuntimeSnapshot(),
        };
    }
    const desired = typeof p.aquecedorRuntimeDesired === "boolean" ? p.aquecedorRuntimeDesired : null;
    const ownerEmail = typeof p.aquecedorOwnerEmail === "string" && p.aquecedorOwnerEmail.trim()
        ? p.aquecedorOwnerEmail.trim().toLowerCase()
        : null;
    const snapRaw = (p.aquecedorRuntimeSnapshot || {});
    const snapshot = {
        running: snapRaw.running === true,
        isProcessing: snapRaw.isProcessing === true,
        nextAllowedAt: typeof snapRaw.nextAllowedAt === "string" ? snapRaw.nextAllowedAt : null,
        lastRunAt: typeof snapRaw.lastRunAt === "string" ? snapRaw.lastRunAt : null,
        lastResult: typeof snapRaw.lastResult === "string" ? snapRaw.lastResult : null,
        lastEvoError: snapRaw.lastEvoError && typeof snapRaw.lastEvoError === "object"
            ? snapRaw.lastEvoError
            : null,
        workerId: typeof snapRaw.workerId === "string" ? snapRaw.workerId : null,
        workerHeartbeatAt: typeof snapRaw.workerHeartbeatAt === "string" ? snapRaw.workerHeartbeatAt : null,
    };
    if (version === 1) {
        snapshot.running = desired === true;
    }
    return { desired, ownerEmail, snapshot };
}
async function reloadAquecedorPersistedBundleFromDisk(force = false) {
    const now = Date.now();
    if (!force && now - aquecedorPersistedBundleReloadedAt < AQUECEDOR_PERSISTED_RELOAD_MS) {
        return aquecedorPersistedBundle;
    }
    aquecedorPersistedBundleReloadedAt = now;
    try {
        const raw = await fs_1.promises.readFile(RUNTIME_INTENT_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const fileSavedAtMs = new Date(String(parsed.savedAt || "")).getTime();
        if (Number.isFinite(fileSavedAtMs) &&
            aquecedorPersistedBundleSavedAtMs > 0 &&
            fileSavedAtMs < aquecedorPersistedBundleSavedAtMs) {
            return aquecedorPersistedBundle;
        }
        aquecedorPersistedBundle = parseAquecedorRuntimePersistedBundle(parsed);
        if (Number.isFinite(fileSavedAtMs)) {
            aquecedorPersistedBundleSavedAtMs = fileSavedAtMs;
        }
    }
    catch {
        /* mantém cache em memória */
    }
    return aquecedorPersistedBundle;
}
function buildAquecedorStatusPayload(bundle = aquecedorPersistedBundle) {
    const desiredRunning = bundle.desired === true;
    const workerActive = isAquecedorWorkerLeaseValid(bundle.snapshot);
    const running = desiredRunning && (bundle.snapshot.running === true || workerActive);
    return {
        ...bundle.snapshot,
        running,
        desiredRunning,
        persistedOwnerEmail: bundle.ownerEmail,
        ownerEmailBound: Boolean(aquecedorRuntimeOwnerEmail || bundle.ownerEmail),
        workerId: bundle.snapshot.workerId,
        workerHeartbeatAt: bundle.snapshot.workerHeartbeatAt,
        workerLeaseValid: isAquecedorWorkerLeaseValid(bundle.snapshot),
        connectedInstanceCount: aquecedorConnectedSummaryCache.count,
        connectedInstances: aquecedorConnectedSummaryCache.names,
        preparingInstanceCount: aquecedorConnectedSummaryCache.preparingCount,
        preparingInstances: aquecedorConnectedSummaryCache.preparingNames,
        totalAquecedorEnabledCount: aquecedorConnectedSummaryCache.totalEnabled,
        connectedSummaryAt: aquecedorConnectedSummaryCache.at
            ? new Date(aquecedorConnectedSummaryCache.at).toISOString()
            : null,
    };
}
/** Status para API: worker líder expõe estado em memória (evita corrida com poll a cada 3s). */
function buildLiveAquecedorStatusPayload(bundle = aquecedorPersistedBundle) {
    const base = buildAquecedorStatusPayload(bundle);
    if (!shouldThisProcessLeadAquecedor(bundle))
        return base;
    return {
        ...base,
        running: aquecedorRuntime.running,
        isProcessing: aquecedorRuntime.isProcessing,
        nextAllowedAt: aquecedorRuntime.nextAllowedAt,
        lastRunAt: aquecedorRuntime.lastRunAt,
        lastResult: aquecedorRuntime.lastResult,
        lastEvoError: aquecedorRuntime.lastEvoError,
    };
}
async function withAquecedorTimeout(promise, ms, fallback) {
    let timer = null;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function writeAquecedorPersistedBundleToDisk() {
    try {
        await fs_1.promises.mkdir(path_1.default.dirname(RUNTIME_INTENT_FILE), { recursive: true });
        const savedAtMs = Date.now();
        const payload = {
            version: 2,
            savedAt: new Date(savedAtMs).toISOString(),
            aquecedorRuntimeDesired: aquecedorPersistedBundle.desired === true,
            aquecedorOwnerEmail: aquecedorPersistedBundle.ownerEmail,
            aquecedorRuntimeSnapshot: aquecedorPersistedBundle.snapshot,
        };
        const tmp = `${RUNTIME_INTENT_FILE}.tmp`;
        await fs_1.promises.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
        await fs_1.promises.rename(tmp, RUNTIME_INTENT_FILE);
        aquecedorPersistedBundleSavedAtMs = savedAtMs;
    }
    catch (e) {
        console.error("[Runtime] falha ao gravar runtime-intent.json:", e);
    }
}
async function persistAquecedorRuntimeSnapshot(overrides = {}) {
    aquecedorPersistedBundle.snapshot = buildPersistedSnapshotFromLocal(overrides);
    await writeAquecedorPersistedBundleToDisk();
}
async function persistAquecedorRuntimeIntent(desired, ownerEmail) {
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
    console.log(`[Runtime] runtime-intent: aquecedor desejado = ${desired ? "ligado" : "desligado"}${normalizedOwner ? ` (${normalizedOwner})` : ""}.`);
}
async function loadAquecedorRuntimeIntent() {
    await reloadAquecedorPersistedBundleFromDisk(true);
    return {
        desired: aquecedorPersistedBundle.desired,
        ownerEmail: aquecedorPersistedBundle.ownerEmail,
    };
}
function stopAquecedorRuntimeLocal() {
    aquecedorRuntime.running = false;
    if (aquecedorScheduleTimer) {
        clearTimeout(aquecedorScheduleTimer);
        aquecedorScheduleTimer = null;
    }
}
function computeAquecedorNextCycleDelayMs() {
    if (aquecedorRuntime.nextAllowedAt) {
        const nextMs = new Date(aquecedorRuntime.nextAllowedAt).getTime();
        if (Number.isFinite(nextMs)) {
            const delta = nextMs - Date.now();
            if (delta > 0) {
                return Math.min(AQUECEDOR_CYCLE_TICK_MAX_MS, Math.max(AQUECEDOR_CYCLE_TICK_MIN_MS, delta));
            }
            return AQUECEDOR_CYCLE_TICK_MIN_MS;
        }
    }
    return 15000;
}
function scheduleAquecedorCycleTick() {
    if (!aquecedorRuntime.running || !ENABLE_AQUECEDOR_PROCESSING)
        return;
    if (aquecedorScheduleTimer)
        clearTimeout(aquecedorScheduleTimer);
    const delay = computeAquecedorNextCycleDelayMs();
    aquecedorScheduleTimer = setTimeout(() => {
        aquecedorScheduleTimer = null;
        if (!aquecedorRuntime.running)
            return;
        void runAquecedorCycle().finally(() => scheduleAquecedorCycleTick());
    }, delay);
}
async function syncAquecedorWorkerLeadership() {
    if (!ENABLE_AQUECEDOR_PROCESSING || MAINTENANCE_MODE)
        return;
    await reloadAquecedorPersistedBundleFromDisk(true);
    const bundle = aquecedorPersistedBundle;
    aquecedorRuntimeOwnerEmail = bundle.ownerEmail;
    if (bundle.desired !== true) {
        stopAquecedorRuntimeLocal();
        applyPersistedSnapshotToLocal(bundle.snapshot);
        return;
    }
    if (shouldThisProcessLeadAquecedor(bundle)) {
        if (!aquecedorRuntime.running) {
            applyPersistedSnapshotToLocal(bundle.snapshot);
        }
        startAquecedorRuntimeLocal();
        bundle.snapshot.workerId = getAquecedorWorkerId();
        bundle.snapshot.workerHeartbeatAt = new Date().toISOString();
        aquecedorPersistedBundle.snapshot = bundle.snapshot;
        await writeAquecedorPersistedBundleToDisk();
        return;
    }
    applyPersistedSnapshotToLocal(bundle.snapshot);
    stopAquecedorRuntimeLocal();
}
async function readAquecedorConfigFromFile() {
    try {
        const raw = await fs_1.promises.readFile(AQUECEDOR_CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const useRecommended = parsed?.useRecommended !== false;
        let customConfig = AQUECEDOR_DEFAULTS;
        try {
            customConfig = parseAquecedorConfig(parsed?.customConfig || AQUECEDOR_DEFAULTS);
        }
        catch {
            customConfig = AQUECEDOR_DEFAULTS;
        }
        return {
            useRecommended,
            customConfig,
            updatedAt: typeof parsed?.updatedAt === "string" && parsed.updatedAt.trim()
                ? parsed.updatedAt
                : new Date().toISOString(),
        };
    }
    catch {
        return null;
    }
}
async function writeAquecedorConfigToFile(record) {
    await fs_1.promises.mkdir(path_1.default.dirname(AQUECEDOR_CONFIG_FILE), { recursive: true });
    const tmp = `${AQUECEDOR_CONFIG_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(record, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, AQUECEDOR_CONFIG_FILE);
}
function parseStoredAquecedorCustomConfig(raw) {
    try {
        return parseAquecedorConfig(raw || AQUECEDOR_DEFAULTS);
    }
    catch {
        return AQUECEDOR_DEFAULTS;
    }
}
async function loadAquecedorConfigRecord() {
    const supabase = getSupabaseClient();
    if (supabase) {
        const { data, error } = await (supabase
            .from("aquecedor_config")
            .select("use_recommended, custom_config, updated_at")
            .eq("id", 1)
            .maybeSingle());
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
async function saveAquecedorConfigRecord(useRecommended, customConfig) {
    const record = {
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
        const { error } = await supabase.from("aquecedor_config").upsert(payload, {
            onConflict: "id",
        });
        if (!error)
            return "supabase";
        console.error("[Aquecedor] falha ao salvar no Supabase; gravando arquivo local:", error);
    }
    await writeAquecedorConfigToFile(record);
    return "local";
}
async function ensureAquecedorInstanceRegistered(instanceName) {
    try {
        const name = String(instanceName || "").trim();
        if (!name)
            return;
        const usageMap = await loadInstanceUsageMap();
        if (!getInstanceUsageFromMap(usageMap, name)) {
            await persistInstanceUsage([
                {
                    instanceName: name,
                    useAquecedor: true,
                    useDisparador: true,
                },
            ]);
        }
        const cache = await loadEvoInstancesCache();
        const cacheRow = (cache?.items || []).find((row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase());
        const preparingSince = cacheRow?.createdAt ? String(cacheRow.createdAt) : null;
        await (0, aquecedor_instance_lifecycle_service_1.registerAquecedorInstancePreparing)(name, preparingSince);
    }
    catch (error) {
        console.warn("[Aquecedor] ensureAquecedorInstanceRegistered:", error);
    }
}
async function syncAquecedorConnectedInstances(supabase, connected) {
    const usageMap = await loadInstanceUsageMap();
    const toRegister = [];
    for (const item of connected) {
        await supabase.from("controle_instancia").upsert({
            instancia: item.instancia,
            numero_whatsapp: item.numero,
        }, { onConflict: "instancia" });
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
        for (const row of toRegister) {
            if (row.useAquecedor) {
                await (0, aquecedor_instance_lifecycle_service_1.registerAquecedorInstancePreparing)(row.instanceName);
            }
        }
    }
}
const wabaSystemUserRepository = new waba_system_user_repository_1.WabaSystemUserRepository();
function isAquecedorGlobalScopeOwner(ownerEmail) {
    const email = String(ownerEmail || "")
        .trim()
        .toLowerCase();
    if (!email.includes("@"))
        return false;
    if ((0, waba_auth_service_1.isWabaMasterEmail)(email))
        return true;
    return wabaSystemUserRepository.getRoleByEmail(email) === "master";
}
async function listEvoInstanceNamesForScopeReconcile() {
    const names = new Set();
    const evoList = await fetchEvoInstancesList();
    if (evoList.ok) {
        for (const inst of evoList.instances) {
            const key = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
            if (key)
                names.add(key);
        }
    }
    const cache = await loadEvoInstancesCache();
    for (const item of cache?.items || []) {
        const name = String(item?.name || "").trim();
        if (name)
            names.add(name);
    }
    return Array.from(names);
}
/** Live EVO é fonte de verdade; cache só preenche número quando a instância está conectada agora. */
function mergeAquecedorConnectedRows(live, cache) {
    const cacheByKey = new Map();
    for (const row of cache) {
        cacheByKey.set(row.instancia.toLowerCase(), row);
    }
    if (live.length > 0) {
        const rows = live
            .map((row) => {
            const cached = cacheByKey.get(row.instancia.toLowerCase());
            const numero = String(row.numero || cached?.numero || "").trim();
            return numero ? { instancia: row.instancia, numero } : null;
        })
            .filter((row) => row != null)
            .sort((a, b) => a.instancia.localeCompare(b.instancia, "pt-BR"));
        return { rows, usedCacheOnlyForNumbers: cache.length > 0 };
    }
    return {
        rows: cache
            .slice()
            .sort((a, b) => a.instancia.localeCompare(b.instancia, "pt-BR")),
        usedCacheOnlyForNumbers: false,
    };
}
async function listMergedConnectedEvoInstancesUnscoped() {
    const evoList = await fetchEvoInstancesList();
    const cache = await loadEvoInstancesCache();
    const fromLive = evoList.ok ? buildConnectedFromEvoResponse(evoList.instances) : [];
    const fromCache = cache?.items?.length ? buildConnectedFromEvoCacheItems(cache.items) : [];
    const merged = mergeAquecedorConnectedRows(fromLive, fromCache);
    return {
        rows: merged.rows,
        liveCount: fromLive.length,
        cacheCount: fromCache.length,
        evoOk: evoList.ok,
        evoError: evoList.ok ? undefined : evoList.detail,
        usedCacheOnlyForNumbers: merged.usedCacheOnlyForNumbers,
    };
}
async function listConnectedEvoInstancesUnscoped() {
    const merged = await listMergedConnectedEvoInstancesUnscoped();
    return merged.rows;
}
async function listAquecedorScopedInstanceNames(ownerEmail) {
    const email = String(ownerEmail || "")
        .trim()
        .toLowerCase();
    if (!email.includes("@"))
        return [];
    if (isAquecedorGlobalScopeOwner(email)) {
        const reconcileNames = await listEvoInstanceNamesForScopeReconcile();
        if (reconcileNames.length) {
            const reconciled = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.reconcileOrphanInstancesForMaster({ email, role: "master" }, reconcileNames);
            if (reconciled > 0) {
                console.info(`[Aquecedor] ${reconciled} instância(s) órfã(s) vinculada(s) ao master ${email}.`);
            }
        }
        const usageMap = await loadInstanceUsageMap();
        const connected = await listConnectedEvoInstancesUnscoped();
        const scoped = new Set();
        for (const item of connected) {
            const usage = getInstanceUsageFromMap(usageMap, item.instancia);
            if (usage ? usage.useAquecedor !== false : true) {
                scoped.add(item.instancia);
            }
        }
        return Array.from(scoped).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    const owned = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.listOwnedInstanceNames(email);
    const activations = new alternativa_number_activation_repository_1.AlternativaNumberActivationRepository()
        .listForEmail(email)
        .map((row) => String(row.instanceName || "").trim())
        .filter(Boolean);
    const usageMap = await loadInstanceUsageMap();
    const merged = new Set();
    for (const name of [...owned, ...activations]) {
        const normalized = String(name || "").trim();
        if (!normalized)
            continue;
        const usage = getInstanceUsageFromMap(usageMap, normalized);
        if (usage?.useAquecedor === false)
            continue;
        merged.add(normalized);
    }
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
async function filterConnectedForAquecedorOwner(connected, ownerEmail) {
    const allowed = await listAquecedorScopedInstanceNames(String(ownerEmail || ""));
    if (!allowed.length)
        return [];
    const aliasesMap = await loadInstanceAliasesMap();
    const allowedLower = new Set();
    for (const name of allowed) {
        allowedLower.add(name.toLowerCase());
        const alias = mapGetInsensitive(aliasesMap, name);
        if (alias)
            allowedLower.add(alias.toLowerCase());
    }
    return connected.filter((c) => {
        const keys = [c.instancia.toLowerCase()];
        const alias = mapGetInsensitive(aliasesMap, c.instancia);
        if (alias)
            keys.push(alias.toLowerCase());
        return keys.some((key) => allowedLower.has(key));
    });
}
function buildConnectedFromEvoCacheItems(items) {
    return items
        .map((item) => {
        const status = String(item?.connectionStatus ?? "").toLowerCase();
        if (!status.includes("open"))
            return null;
        const instancia = String(item?.name || "").trim();
        const numero = resolveAquecedorInstanceDigits(String(item?.number || "").trim());
        if (!instancia || !numero)
            return null;
        return { instancia, numero };
    })
        .filter((row) => row != null);
}
async function enrichAquecedorConnectedNumbersFromControleInstancia(supabase, connected, allowedNames) {
    const byKey = new Map();
    for (const row of connected) {
        byKey.set(row.instancia.toLowerCase(), row);
    }
    const needsNumber = allowedNames.filter((name) => {
        const row = byKey.get(String(name || "").trim().toLowerCase());
        return row && !String(row.numero || "").trim();
    });
    if (!needsNumber.length)
        return connected;
    try {
        const { data } = await (supabase
            .from("controle_instancia")
            .select("instancia, numero_whatsapp")
            .in("instancia", needsNumber)
            .limit(500));
        for (const row of Array.isArray(data) ? data : []) {
            const instancia = String(row?.instancia || "").trim();
            const numero = normalizeWhatsAppNumber(String(row?.numero_whatsapp || "").trim());
            if (!instancia || !numero)
                continue;
            const existing = byKey.get(instancia.toLowerCase());
            if (existing && !String(existing.numero || "").trim()) {
                existing.numero = numero;
            }
        }
    }
    catch {
        /* opcional */
    }
    return Array.from(byKey.values()).sort((a, b) => a.instancia.localeCompare(b.instancia, "pt-BR"));
}
function buildEvoInstanceLookupMap(liveInstances, cacheItems, aliasesMap) {
    const map = new Map();
    const bind = (key, inst) => {
        const normalized = String(key || "").trim().toLowerCase();
        if (normalized && !map.has(normalized))
            map.set(normalized, inst);
    };
    for (const item of cacheItems) {
        const name = String(item?.name || "").trim();
        if (!name)
            continue;
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
        bind((0, evo_instance_key_1.resolveEvoInstanceKey)(inst), inst);
        bind(String(inst?.instanceName || ""), inst);
        bind(String(inst?.name || ""), inst);
    }
    for (const [technical, alias] of aliasesMap) {
        const inst = map.get(String(technical || "").trim().toLowerCase());
        if (inst && alias)
            bind(alias, inst);
    }
    return map;
}
async function resolveAquecedorConnectedForOwner(ownerEmail) {
    const usageMap = await loadInstanceUsageMap();
    const filterScoped = async (connectedAll) => {
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
        connected = await enrichAquecedorConnectedNumbersFromControleInstancia(supabase, connected, allowed);
        connected = connected.filter((item) => String(item.numero || "").trim());
    }
    const usedCacheSupplement = mergedEvo.evoOk &&
        mergedEvo.usedCacheOnlyForNumbers &&
        connected.length > mergedEvo.liveCount &&
        mergedEvo.liveCount > 0;
    return {
        connected,
        source: mergedEvo.evoOk ? "evo-live" : "evo-cache",
        evoDegraded: !mergedEvo.evoOk || usedCacheSupplement,
        evoError: mergedEvo.evoError,
    };
}
async function buildAquecedorConnectedFromControleInstancia(supabase, ownerEmail) {
    const { data: instanciasData } = await (supabase
        .from("controle_instancia")
        .select("instancia, numero_whatsapp")
        .limit(500));
    const connectedAll = (Array.isArray(instanciasData) ? instanciasData : [])
        .map((row) => ({
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
async function buildControleInstanciaNumToNameMap(supabase) {
    const map = new Map();
    const { data: instanciasData } = await (supabase
        .from("controle_instancia")
        .select("instancia, numero_whatsapp")
        .limit(500));
    for (const row of Array.isArray(instanciasData) ? instanciasData : []) {
        const num = normalizeWhatsAppNumber(String(row?.numero_whatsapp || "").trim());
        const inst = String(row?.instancia || "").trim();
        if (num && inst)
            map.set(num, inst);
    }
    return map;
}
async function analyzeAquecedorInstances(ownerEmail) {
    const email = String(ownerEmail || "")
        .trim()
        .toLowerCase();
    const ownedInstances = email ? await listAquecedorScopedInstanceNames(email) : [];
    const usageMap = await loadInstanceUsageMap();
    const aliasesMap = await loadInstanceAliasesMap();
    const mergedEvo = await listMergedConnectedEvoInstancesUnscoped();
    const evoList = await fetchEvoInstancesList();
    const cache = await loadEvoInstancesCache();
    const evoSource = mergedEvo.evoOk && mergedEvo.cacheCount === 0
        ? "live"
        : mergedEvo.evoOk && mergedEvo.liveCount > 0
            ? "merged"
            : "cache";
    const evoByKey = buildEvoInstanceLookupMap(evoList.ok ? evoList.instances : [], cache?.items || [], aliasesMap);
    const eligible = [];
    const excluded = [];
    for (const ownedName of ownedInstances) {
        const inst = evoByKey.get(ownedName.toLowerCase());
        const motivos = [];
        let connected = false;
        let hasNumber = false;
        let evoKey;
        if (!inst) {
            motivos.push("nao_encontrada_na_evolution");
        }
        else {
            evoKey = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
            const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
            connected = status.includes("open");
            if (!connected)
                motivos.push("desconectada");
            const numero = extractInstanceNumber(inst);
            hasNumber = Boolean(String(numero || "").trim());
            if (!hasNumber)
                motivos.push("sem_numero_whatsapp");
        }
        const usage = getInstanceUsageFromMap(usageMap, ownedName);
        const aquecedorEnabled = usage ? usage.useAquecedor !== false : true;
        if (!aquecedorEnabled)
            motivos.push("aquecedor_desabilitado_no_painel");
        const row = {
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
            const numero = extractInstanceNumber(inst) ||
                mergedEvo.rows.find((item) => item.instancia.toLowerCase() === ownedName.toLowerCase())
                    ?.numero ||
                "";
            if (numero) {
                eligible.push({
                    instancia: ownedName,
                    numero,
                });
            }
            else {
                excluded.push({
                    ...row,
                    eligible: false,
                    motivos: [...row.motivos, "sem_numero_whatsapp"],
                });
            }
        }
        else {
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
function parseAquecedorConfig(input) {
    const readInt = (key, min, max, fallback) => {
        const raw = Number(input?.[key]);
        if (!Number.isFinite(raw))
            return fallback;
        const value = Math.floor(raw);
        if (value < min || value > max) {
            throw new Error(`Campo '${key}' fora do intervalo permitido (${min}-${max}).`);
        }
        return value;
    };
    let expediente = AQUECEDOR_DEFAULTS.expediente;
    if (input?.expediente && Array.isArray(input.expediente) && input.expediente.length > 0) {
        expediente = input.expediente.map((batch) => {
            const days = Array.isArray(batch?.days) ? batch.days.filter((d) => DAY_CODES.includes(d)) : [];
            const startHour = Math.max(0, Math.min(23, Math.floor(Number(batch?.startHour ?? 7))));
            const endHour = Math.max(1, Math.min(24, Math.floor(Number(batch?.endHour ?? 22))));
            if (days.length === 0)
                throw new Error("Cada lote deve ter pelo menos um dia.");
            if (endHour <= startHour)
                throw new Error("Hora final deve ser maior que a inicial.");
            return { days, startHour, endHour };
        });
    }
    else if (input?.windowMonWedStartHour != null) {
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
function saoPauloDateKey(now = nowInSaoPaulo()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function getInstanceDailySendCount(instanceName, dateKey = saoPauloDateKey()) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return 0;
    const bucket = instanceDailySendCounts.get(key);
    if (!bucket || bucket.dateKey !== dateKey)
        return 0;
    return bucket.count;
}
function recordInstanceDailySend(instanceName) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return;
    const dateKey = saoPauloDateKey();
    const bucket = instanceDailySendCounts.get(key);
    if (!bucket || bucket.dateKey !== dateKey) {
        instanceDailySendCounts.set(key, { dateKey, count: 1 });
        return;
    }
    bucket.count += 1;
}
function applyAlternativaDispatchProfile(config) {
    const throttle = (0, alternativa_dispatch_rules_1.computeAlternativaThrottle)({
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
async function resolveDispatchCreditsApiKindForOwner(ownerEmail) {
    const normalized = String(ownerEmail || "").trim().toLowerCase();
    if (!normalized.includes("@"))
        return "oficial";
    const summary = disparosCreditsService.getCreditsSummary(normalized);
    if (summary.activeApiKind === "alternativa")
        return "alternativa";
    if (summary.byApi.alternativa.remainingShipments > 0)
        return "alternativa";
    if ((0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)()) {
        const purchased = alternativaNumbersService.getPurchasedSlots(normalized);
        const activated = alternativaActivationRepository.listForEmail(normalized).length;
        if (purchased > 0 || activated > 0)
            return "alternativa";
    }
    return (0, waba_dispatches_api_kind_1.resolveSubscriberDispatchesApiKindFromOrders)(normalized);
}
function debitsDisparosCreditsOnCampaignCreate(apiKind) {
    return apiKind === "oficial";
}
function debitsDisparosCreditsPerSuccessfulSend(apiKind) {
    return apiKind === "alternativa";
}
async function shouldApplyAlternativaDispatchProfile(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized.includes("@"))
        return false;
    if ((0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)()) {
        const purchased = alternativaNumbersService.getPurchasedSlots(normalized);
        const activated = alternativaActivationRepository.listForEmail(normalized).length;
        if (purchased > 0 || activated > 0)
            return true;
    }
    const creditsApiKind = await resolveDispatchCreditsApiKindForOwner(normalized);
    return creditsApiKind === "alternativa";
}
async function assertAlternativaDispatchReady(email) {
    if (!(0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)())
        return;
    const normalized = String(email || "").trim().toLowerCase();
    if (!(await shouldApplyAlternativaDispatchProfile(normalized)))
        return;
    const activated = alternativaActivationRepository.listForEmail(normalized).length;
    (0, alternativa_dispatch_rules_1.assertAlternativaMinActivated)(activated);
}
function hasExplicitTimezone(value) {
    return /Z$/i.test(value) || /[+-]\d{2}:\d{2}$/.test(value) || /[+-]\d{4}$/.test(value);
}
/** Converte ISO/timestamp do Postgres/Supabase em instante absoluto (fuso SP para valores "naive"). */
function parseWabaInstant(isoOrNull) {
    if (!isoOrNull || typeof isoOrNull !== "string")
        return null;
    let s = isoOrNull.trim();
    if (!s)
        return null;
    if (!hasExplicitTimezone(s)) {
        // Postgres/Supabase às vezes devolve timestamptz sem offset; no WABA isso é horário de São Paulo.
        s = s.replace(" ", "T") + "-03:00";
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
function formatDateBr(isoOrNull) {
    const d = parseWabaInstant(isoOrNull);
    if (!d)
        return "sem data";
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
    }
    catch {
        return "sem data";
    }
}
function isAquecedorWindowOpen(config, now) {
    const day = now.getDay();
    const dayCode = DAY_CODES[day];
    const hour = now.getHours();
    const minute = now.getMinutes();
    const minutesOfDay = hour * 60 + minute;
    for (const batch of config.expediente || []) {
        if (!batch.days.includes(dayCode))
            continue;
        if (hour < batch.startHour || hour >= batch.endHour)
            return false;
        const cycle = config.janelaAtivaMinutos + config.pausaMinutos;
        if (cycle <= 0)
            return false;
        return minutesOfDay % cycle < config.janelaAtivaMinutos;
    }
    return false;
}
function nextAquecedorWindowOpenAt(config, fromSp) {
    const batches = Array.isArray(config.expediente) ? config.expediente : [];
    if (!batches.length)
        return null;
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
async function loadAquecedorEffectiveConfig() {
    const { record } = await loadAquecedorConfigRecord();
    return record.useRecommended !== false ? AQUECEDOR_DEFAULTS : record.customConfig;
}
async function runAquecedorCycleTestBatch(connected, cicloGlobal, supabase, _config) {
    const combinations = [];
    for (const origem of connected) {
        for (const destino of connected) {
            if (origem.instancia === destino.instancia)
                continue;
            combinations.push({
                instancia_origem: origem.instancia,
                instancia_destino: destino.instancia,
                numero_whatsapp: destino.numero,
            });
        }
    }
    const picked = await pickAquecedorCombinationAsync(supabase, connected, combinations, cicloGlobal);
    const chosen = picked?.chosen ?? combinations[0] ?? null;
    const proximo = picked ? picked.index + 1 : 1;
    if (!chosen) {
        aquecedorRuntime.lastResult =
            "Teste: nenhum par disponível (é necessário ao menos 2 instâncias ativas no Aquecedor).";
        return;
    }
    const deliveryTag = buildAquecedorDeliveryTag();
    const texto = appendAquecedorDeliveryTag("Mensagem de teste do aquecedor.", deliveryTag);
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
    const numero = resolveAquecedorInstanceDigits(chosen.numero_whatsapp);
    const sendBody = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text: texto } }
        : { number: numero, text: texto, textMessage: { text: texto } };
    const sendStartedAtMs = Date.now();
    const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);
    const origemConnected = connected.find((item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase());
    if (sendResult.ok) {
        const deliveryCheck = await verifyAquecedorMessageDelivered(chosen.instancia_destino, resolveAquecedorInstanceDigits(String(origemConnected?.numero || "")), texto, {
            instanciaOrigem: chosen.instancia_origem,
            numeroDestino: numero,
            sendStartedAtMs,
        });
        if (!deliveryCheck.ok) {
            aquecedorRuntime.lastEvoError = {
                status: sendResult.status,
                body: deliveryCheck.detail.slice(0, 500),
                instance: chosen.instancia_destino,
                numeroLen: numero.length,
            };
            aquecedorRuntime.lastResult = `Ciclo teste: ${chosen.instancia_origem} → ${chosen.instancia_destino} não confirmado no destinatário.`;
        }
        else {
            await supabase.from("logs_envios").insert({
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
    }
    else {
        aquecedorRuntime.lastEvoError = {
            status: sendResult.status,
            body: String(sendResult.body || "").slice(0, 500),
            instance: chosen.instancia_origem,
            numeroLen: numero.length,
        };
        aquecedorRuntime.lastResult = `Ciclo teste falhou: ${chosen.instancia_origem} → ${chosen.instancia_destino}.`;
    }
    await supabase.from("controle_ciclo").upsert({ id: 1, ciclo_global: proximo }, { onConflict: "id" });
}
function deferAquecedorOutsideWindow(config, fromSp) {
    const nextOpen = nextAquecedorWindowOpenAt(config, fromSp);
    aquecedorRuntime.nextAllowedAt = nextOpen ? nextOpen.toISOString() : null;
    aquecedorRuntime.lastResult = nextOpen
        ? `Fora da janela humanizada. Próximo retorno previsto: ${formatDateBr(nextOpen.toISOString())}.`
        : "Fora da janela humanizada.";
}
function deferAquecedorRetryOrWindow(config, nowSp, retrySeconds, retryReason) {
    if (!isAquecedorWindowOpen(config, nowSp)) {
        deferAquecedorOutsideWindow(config, nowSp);
        return;
    }
    const boundedRetry = Math.max(15, Math.min(300, Math.floor(retrySeconds)));
    aquecedorRuntime.nextAllowedAt = new Date(Date.now() + boundedRetry * 1000).toISOString();
    aquecedorRuntime.lastResult = retryReason;
}
async function runAquecedorCycle(forceTest = false) {
    if (aquecedorRuntime.isProcessing)
        return;
    aquecedorRuntime.isProcessing = true;
    aquecedorRuntime.lastRunAt = new Date().toISOString();
    try {
        const now = new Date();
        if (!forceTest && aquecedorRuntime.nextAllowedAt) {
            const nextAllowed = new Date(aquecedorRuntime.nextAllowedAt);
            if (nextAllowed.getTime() > now.getTime()) {
                return;
            }
        }
        const config = await loadAquecedorEffectiveConfig();
        const nowSp = nowInSaoPaulo();
        if (!forceTest && !isAquecedorWindowOpen(config, nowSp)) {
            deferAquecedorOutsideWindow(config, nowSp);
            return;
        }
        if (!aquecedorRuntimeOwnerEmail) {
            aquecedorRuntime.lastResult =
                "Aquecedor sem usuário vinculado. Pare e inicie novamente pela conta correta.";
            return;
        }
        const resolved = await resolveAquecedorConnectedForOwner(aquecedorRuntimeOwnerEmail);
        const connectedAll = resolved.connected;
        for (const item of connectedAll) {
            await (0, aquecedor_instance_lifecycle_service_1.registerAquecedorInstancePreparing)(item.instancia);
        }
        const connected = await (0, aquecedor_instance_lifecycle_service_1.filterAquecedorCycleConnected)(connectedAll);
        updateAquecedorConnectedSummary(connected, connectedAll);
        const preparingCount = aquecedorConnectedSummaryCache.preparingCount;
        if (preparingCount > 0 && connected.length < 2 && connectedAll.length >= 2) {
            aquecedorRuntime.lastResult = `${preparingCount} instância(s) em preparação (6h desde a integração). Aquecedor ativo em ${connected.length}.`;
            return;
        }
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
            console.warn(`[Aquecedor] Evolution degradada — ${connected.length} instância(s) via cache (${resolved.evoError || "sem detalhe"}).`);
        }
        const supabase = getSupabaseClient();
        if (!supabase) {
            aquecedorRuntime.lastResult = "Supabase não configurado.";
            return;
        }
        await releaseStuckAquecedorQueueRows(supabase);
        await syncAquecedorConnectedInstances(supabase, connectedAll);
        const combinations = [];
        for (const origem of connected) {
            for (const destino of connected) {
                if (origem.instancia === destino.instancia)
                    continue;
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
            .from("controle_ciclo")
            .select("id, ciclo_global")
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle());
        const cicloGlobal = typeof cicloData?.ciclo_global === "number" ? Math.floor(cicloData.ciclo_global) : 0;
        if (forceTest) {
            await runAquecedorCycleTestBatch(connected, cicloGlobal, supabase, config);
            return;
        }
        const picked = await pickAquecedorCombinationAsync(supabase, connected, combinations, cicloGlobal);
        if (!picked) {
            deferAquecedorRetryOrWindow(config, nowSp, 30, "Aguardando turno: cada instância só envia após receber (A→B, depois B→A). Nenhum par elegível agora.");
            return;
        }
        const chosen = picked.chosen;
        const dailyQuota = await (0, aquecedor_instance_lifecycle_service_1.canAquecedorInstanceSendToday)(chosen.instancia_origem);
        if (!dailyQuota.ok) {
            deferAquecedorRetryOrWindow(config, nowSp, 300, `${chosen.instancia_origem}: ${dailyQuota.reason}`);
            return;
        }
        const proximo = picked.index + 1;
        const pairContext = buildAquecedorPairContext(chosen, connected);
        const ensured = await ensureAquecedorPendingMessage(pairContext);
        const pendingData = await fetchProcessableAquecedorPending(supabase);
        if (!pendingData?.id) {
            const reason = ensured.reason || "Falha ao preparar mensagem pendente na fila do aquecedor.";
            if (!ensured.ok && isSupabaseTransientError({ message: reason })) {
                aquecedorRuntime.nextAllowedAt = new Date(Date.now() + 60000).toISOString();
                aquecedorRuntime.lastResult = await describeSupabaseConnectivityFailure();
            }
            else {
                aquecedorRuntime.lastResult = ensured.ok
                    ? "Sem mensagem pendente para envio (fila vazia após preparação)."
                    : reason;
            }
            return;
        }
        const texto = await resolveAquecedorMessageForSend(supabase, pendingData.id, String(pendingData.mensagem || ""), pairContext);
        const turnCheck = await verifyAquecedorConversationTurn(supabase, connected, chosen.instancia_origem, chosen.instancia_destino);
        if (!turnCheck.ok) {
            deferAquecedorRetryOrWindow(config, nowSp, 90, turnCheck.reason);
            return;
        }
        if (await hasRecentAquecedorSendBetween(supabase, connected, chosen.instancia_origem, chosen.instancia_destino, 90)) {
            deferAquecedorRetryOrWindow(config, nowSp, 90, `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} ignorado: envio duplicado detectado no mesmo par.`);
            return;
        }
        const turnRecheck = await verifyAquecedorConversationTurn(supabase, connected, chosen.instancia_origem, chosen.instancia_destino);
        if (!turnRecheck.ok) {
            deferAquecedorRetryOrWindow(config, nowSp, 90, turnRecheck.reason);
            return;
        }
        const deliveryTag = buildAquecedorDeliveryTag();
        const textoEnvio = appendAquecedorDeliveryTag(texto, deliveryTag);
        await supabase.from("aquecedor")
            .update({
            status: "PROCESSANDO",
            processing_at: new Date().toISOString(),
            instancia: chosen.instancia_origem,
            numero_destino: resolveAquecedorInstanceDigits(chosen.numero_whatsapp) || chosen.numero_whatsapp,
            mensagem: textoEnvio,
        })
            .eq("id", pendingData.id);
        const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
        const numero = resolveAquecedorInstanceDigits(chosen.numero_whatsapp);
        const sendBody = EVO_SEND_TEXT_V1
            ? { number: numero, textMessage: { text: textoEnvio } }
            : { number: numero, text: textoEnvio, textMessage: { text: textoEnvio } };
        const sendStartedAtMs = Date.now();
        const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 3);
        if (!sendResult.ok) {
            await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id);
            const evoDetail = sendResult.json?.message ||
                (Array.isArray(sendResult.json?.message) ? sendResult.json.message[0] : null) ||
                sendResult.json?.error ||
                (typeof sendResult.json?.detail === "string" ? sendResult.json.detail : null) ||
                (sendResult.body && sendResult.body.length < 200 ? sendResult.body : null);
            const detailStr = evoDetail ? String(evoDetail) : String(sendResult.body || "");
            await (0, aquecedor_instance_lifecycle_service_1.detectAndMarkRestrictionFromSend)(chosen.instancia_origem, sendResult.status, detailStr);
            const detail = evoDetail ? ` (${String(evoDetail).slice(0, 120)})` : "";
            deferAquecedorRetryOrWindow(config, nowSp, 120, `Falha no envio via EVO (HTTP ${sendResult.status})${detail}. Mensagem voltou para pendente.`);
            aquecedorRuntime.lastEvoError = {
                status: sendResult.status,
                body: String(sendResult.body || "").slice(0, 500),
                instance: chosen.instancia_origem,
                numeroLen: numero.length,
            };
            console.error("[Aquecedor] sendText falhou:", aquecedorRuntime.lastEvoError);
            return;
        }
        const origemConnected = connected.find((item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase());
        const deliveryCheck = await verifyAquecedorMessageDelivered(chosen.instancia_destino, resolveAquecedorInstanceDigits(String(origemConnected?.numero || "")), textoEnvio, {
            instanciaOrigem: chosen.instancia_origem,
            numeroDestino: numero,
            sendStartedAtMs,
        });
        if (!deliveryCheck.ok) {
            await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id);
            deferAquecedorRetryOrWindow(config, nowSp, 120, `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} não confirmado no destinatário. ${deliveryCheck.detail}`);
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
        await supabase.from("aquecedor")
            .update({
            status: "ENVIADO",
            sent_at: new Date().toISOString(),
        })
            .eq("id", pendingData.id);
        await supabase.from("logs_envios").insert({
            instancia_origem: chosen.instancia_origem,
            instancia_destino: chosen.instancia_destino,
            data_envio: new Date().toISOString(),
        });
        await recordAquecedorEnvio({
            instanciaOrigem: chosen.instancia_origem,
            instanciaDestino: chosen.instancia_destino,
            status: "Envio com Sucesso",
        });
        await (0, aquecedor_instance_lifecycle_service_1.recordAquecedorInstanceDailySend)(chosen.instancia_origem);
        const nextPick = await pickAquecedorCombinationAsync(supabase, connected, combinations, proximo);
        await ensureAquecedorPendingMessage(nextPick ? buildAquecedorPairContext(nextPick.chosen, connected) : null);
        await supabase.from("controle_ciclo").upsert({ id: 1, ciclo_global: proximo }, { onConflict: "id" });
        const waitMin = config.waitMinSeconds;
        const waitMax = config.waitMaxSeconds;
        const waitSeconds = Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
        aquecedorRuntime.nextAllowedAt = new Date(Date.now() + waitSeconds * 1000).toISOString();
        aquecedorRuntime.lastResult = `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} realizado. Próximo ciclo em ~${waitSeconds}s.${preparingCount > 0
            ? ` ${preparingCount} instância(s) em preparação (6h): ${aquecedorConnectedSummaryCache.preparingNames.join(", ")}.`
            : ""}`;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Erro no ciclo do aquecedor:", error);
        aquecedorRuntime.lastResult = `Erro no ciclo do aquecedor: ${msg.slice(0, 200)}`;
    }
    finally {
        aquecedorRuntime.isProcessing = false;
        if (shouldThisProcessLeadAquecedor(aquecedorPersistedBundle)) {
            void persistAquecedorRuntimeSnapshot({
                workerId: getAquecedorWorkerId(),
                workerHeartbeatAt: new Date().toISOString(),
            });
        }
    }
}
function startAquecedorRuntimeLocal() {
    if (!ENABLE_AQUECEDOR_PROCESSING) {
        aquecedorRuntime.running = false;
        aquecedorRuntime.lastResult =
            "Aquecedor desativado neste processo (ENABLE_AQUECEDOR_PROCESSING=false).";
        return;
    }
    if (aquecedorRuntime.running && aquecedorScheduleTimer)
        return;
    aquecedorRuntime.running = true;
    void ensureAquecedorPendingMessage();
    void runAquecedorCycle().finally(() => scheduleAquecedorCycleTick());
}
function startAquecedorRuntime() {
    startAquecedorRuntimeLocal();
}
function stopAquecedorRuntime() {
    stopAquecedorRuntimeLocal();
    aquecedorRuntimeOwnerEmail = null;
}
let indexHtmlTemplate = null;
let indexHtmlTemplateMtimeMs = 0;
function isTsNodeDevServer() {
    return /\.ts$/i.test(String(process.argv[1] || ""));
}
function resolveIndexHtmlPath() {
    const rootHtml = path_1.default.join(rootPath, "index.html");
    const distHtml = path_1.default.join(distPath, "index.html");
    if ((RUNTIME_MODE === "development" || isTsNodeDevServer()) && (0, fs_1.existsSync)(rootHtml)) {
        return rootHtml;
    }
    return distHtml;
}
function loadIndexHtmlTemplate() {
    const htmlPath = resolveIndexHtmlPath();
    if (RUNTIME_MODE === "development" || isTsNodeDevServer()) {
        return (0, fs_1.readFileSync)(htmlPath, "utf8");
    }
    const mtimeMs = (0, fs_1.statSync)(htmlPath).mtimeMs;
    if (!indexHtmlTemplate || mtimeMs !== indexHtmlTemplateMtimeMs) {
        indexHtmlTemplate = (0, fs_1.readFileSync)(htmlPath, "utf8");
        indexHtmlTemplateMtimeMs = mtimeMs;
    }
    return indexHtmlTemplate;
}
function resolveUiProfile() {
    const explicit = String(process.env.WABA_UI_PROFILE || "")
        .trim()
        .toLowerCase();
    if (explicit === "production" || explicit === "full") {
        return explicit;
    }
    // V01 = UI pré-disparador comercial (08/06/2026): API não oficial + API Meta.
    if (load_env_1.WABA_ENV === "v01")
        return "baseline";
    return "production";
}
function sendIndexHtml(res) {
    const uiProfile = resolveUiProfile();
    const html = (0, base_path_1.injectRuntimeIntoIndexHtml)(loadIndexHtmlTemplate(), {
        basePath: base_path_1.BASE_PATH,
        uiProfile,
        featureFlags: (0, waba_feature_flags_1.getWabaFeatureFlagsForClient)(),
        deployResilienceEnabled: (0, base_path_1.resolveDeployResilienceForClient)(),
    });
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Waba-Shell-Cache-Key", (0, base_path_1.resolveShellCacheKey)(uiProfile, base_path_1.BASE_PATH));
    res.type("html").send(html);
}
const staticNoIndex = { index: false };
app.get("/sw-deploy-resilience.js", (_req, res) => {
    const swPath = path_1.default.join(distPath, "sw-deploy-resilience.js");
    if (!(0, fs_1.existsSync)(swPath)) {
        return res.status(404).type("text/plain").send("Service worker não encontrado.");
    }
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache");
    return res.type("application/javascript").sendFile(swPath);
});
app.get("/", (req, res) => {
    if (base_path_1.BASE_PATH && !(0, base_path_1.requestUnderBasePath)(req)) {
        return res.redirect(301, `${base_path_1.BASE_PATH}/`);
    }
    sendIndexHtml(res);
});
app.get("/index.html", (_req, res) => {
    sendIndexHtml(res);
});
const sendVendasPage = (res) => {
    const vendasPath = path_1.default.join(rootPath, "public-pages", "vendas.html");
    const cadastroPath = path_1.default.join(rootPath, "public-pages", "cadastro.html");
    const sourcePath = (0, fs_1.existsSync)(vendasPath)
        ? vendasPath
        : (0, fs_1.existsSync)(cadastroPath)
            ? cadastroPath
            : null;
    if (!sourcePath) {
        return res.status(404).type("html").send("<p>Página de vendas indisponível.</p>");
    }
    const html = (0, base_path_1.injectRuntimeIntoIndexHtml)((0, fs_1.readFileSync)(sourcePath, "utf8"), {
        basePath: base_path_1.BASE_PATH,
        uiProfile: "full",
    });
    return res.type("html").send(html);
};
app.get("/cadastro", (_req, res) => sendVendasPage(res));
app.get("/vendas", (_req, res) => sendVendasPage(res));
if (base_path_1.BASE_PATH) {
    // Após stripBasePathMiddleware, assets ficam em req.url relativo à raiz.
    app.use((req, res, next) => {
        if (!(0, base_path_1.requestUnderBasePath)(req))
            return next();
        return express_1.default.static(distPath, staticNoIndex)(req, res, next);
    });
}
else {
    app.use(express_1.default.static(distPath, staticNoIndex));
}
// Cache curto em memória para GET /dados (reduz hits repetidos ao Supabase).
const DADOS_RESPONSE_CACHE_TTL_MS = 45000;
const dadosResponseCache = new Map();
function buildDadosResponseCacheKey(rangeStart, rangeEnd) {
    if (rangeStart && rangeEnd)
        return `range:${rangeStart}:${rangeEnd}`;
    return "default";
}
function readDadosResponseCache(key) {
    const entry = dadosResponseCache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        dadosResponseCache.delete(key);
        return null;
    }
    return entry.payload;
}
function writeDadosResponseCache(key, payload) {
    dadosResponseCache.set(key, {
        expiresAt: Date.now() + DADOS_RESPONSE_CACHE_TTL_MS,
        payload,
    });
}
// Dados direto do banco (view logs_envios_br já com fuso tratado)
app.get("/dados", async (req, res) => {
    try {
        const rangeStart = typeof req.query.rangeStart === "string" ? req.query.rangeStart : null;
        const rangeEnd = typeof req.query.rangeEnd === "string" ? req.query.rangeEnd : null;
        const cacheKey = buildDadosResponseCacheKey(rangeStart, rangeEnd);
        const cachedPayload = readDadosResponseCache(cacheKey);
        if (cachedPayload) {
            res.setHeader("Cache-Control", "private, max-age=30");
            res.setHeader("X-Waba-Dados-Cache", "hit");
            return res.json(cachedPayload);
        }
        const supabase = getSupabaseClient();
        if (!supabase) {
            return res.status(503).json({
                error: "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
            });
        }
        const isValidYMD = (ymd) => /^\d{4}-\d{2}-\d{2}$/.test(ymd);
        const dateToNextDayYMD = (ymd) => {
            // ymd: YYYY-MM-DD
            if (!isValidYMD(ymd)) {
                throw new Error("Formato de data inválido");
            }
            const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
            const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
            dt.setUTCDate(dt.getUTCDate() + 1);
            const pad = (n) => String(n).padStart(2, "0");
            return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
        };
        let query = supabase
            .from("logs_envios_br")
            .select("id, ciclo_global, instancia_origem, instancia_destino, created_at, data_envio_br")
            .order("data_envio_br", { ascending: false });
        let totalCount = null;
        let countsBySender = null;
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
            }
            else {
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
                    if (!senderRows || senderRows.length === 0)
                        break;
                    senderRows.forEach((r) => {
                        const key = r?.instancia_origem || "—";
                        countsBySender[key] = (countsBySender[key] || 0) + 1;
                    });
                    offset += senderRows.length;
                    if (senderRows.length < pageSize)
                        break;
                }
            }
            // Linhas limitadas para montar lista/gráficos (o PostgREST pode limitar ~1000)
            query = query.gte("data_envio_br", startTs).lt("data_envio_br", endTs).limit(5000);
        }
        else {
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
            .map((row) => {
            const dataHora = row.data_envio_br || row.created_at || "";
            const quemEnviou = row.instancia_origem || "";
            const quemRecebeu = row.instancia_destino || "";
            return `Data/Hora: ${dataHora}\nQuem enviou: ${quemEnviou}\nQuem recebeu: ${quemRecebeu}`;
        })
            .join("\n-----------------------------\n");
        const payload = {
            log: texto,
            count: rows.length,
            totalCount,
            countsBySender,
        };
        writeDadosResponseCache(cacheKey, payload);
        res.setHeader("Cache-Control", "private, max-age=30");
        res.setHeader("X-Waba-Dados-Cache", "miss");
        return res.json(payload);
    }
    catch (error) {
        console.error("Erro ao buscar dados no Supabase:", error);
        return res.status(500).json({ error: "Erro ao buscar dados no Supabase" });
    }
});
// Status das instancias (Evolution API)
app.get("/instancias/snapshot", async (req, res) => {
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar instâncias." });
        }
        const snapshot = await buildInstancesSnapshotForAuth(auth);
        return res.status(200).json(snapshot);
    }
    catch (error) {
        console.error("Erro ao carregar snapshot de instâncias:", error);
        return res.status(500).json({ error: "Erro ao carregar instâncias do cache." });
    }
});
// Status das instancias (Evolution API)
app.get("/instancias", async (req, res) => {
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
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
                console.warn(`[instancias] Evolution indisponível — retornando ${fallback.items.length} instância(s) do cache/dono (${auth.email || "guest"}).`);
                return res.status(200).json(fallback);
            }
            return res.status(500).json({
                error: evolutionError,
                evolutionStatus: evoList.status,
                evolutionDetail: evoList.detail,
            });
        }
        const instances = evoList.instances;
        let ativas = 0;
        let desconectadas = 0;
        for (const inst of instances) {
            if (inst.connectionStatus === "open") {
                ativas += 1;
            }
            else {
                desconectadas += 1;
            }
        }
        const total = instances.length;
        const pickNumeric = (...values) => {
            for (const value of values) {
                if (typeof value === "number" && Number.isFinite(value))
                    return value;
                if (typeof value === "string" && value.trim() !== "") {
                    const parsed = Number(value);
                    if (Number.isFinite(parsed))
                        return parsed;
                }
            }
            return 0;
        };
        // Retorna apenas campos úteis para a UI (evita expor payload sensível)
        const baseItems = instances.slice(0, 100).map((inst, idx) => {
            const candidateName = inst.instanceName ??
                inst.name ??
                inst.id ??
                inst.instanceId ??
                inst.instance ??
                null;
            const instanceKey = candidateName == null || candidateName === ""
                ? `Instância ${idx + 1}`
                : String(candidateName);
            const displayName = instanceKey;
            const connectionStatus = typeof inst.connectionStatus === "string"
                ? inst.connectionStatus
                : "unknown";
            const contacts = pickNumeric(inst.contacts, inst.contactsCount, inst.totalContacts, inst._count?.Contact, inst._count?.contacts, inst.profile?.contacts, inst.stats?.contacts);
            const messages = pickNumeric(inst.messages, inst.messagesCount, inst.totalMessages, inst.chatsCount, inst._count?.Message, inst._count?.messages, inst.profile?.messages, inst.stats?.messages);
            const number = (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(inst)?.phone || extractInstanceNumber(inst);
            const profilePicUrl = typeof inst.profilePicUrl === "string" ? inst.profilePicUrl : "";
            const avatarVersion = typeof inst.updatedAt === "string" ? inst.updatedAt : "";
            const createdAt = typeof inst.createdAt === "string"
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
        const visibleBaseItems = await filterDeletedInstancesFromItems(baseItems, (row) => String(row?.name || ""));
        let items = visibleBaseItems;
        if (EVO_LIVE_PROFILE_SYNC) {
            items = await Promise.all(visibleBaseItems.map(async (row) => {
                const status = String(row?.connectionStatus || "").toLowerCase();
                if (!status.includes("open"))
                    return row;
                const live = await fetchLiveWhatsappProfile(String(row?.name || row?.displayName || ""), String(row?.number || ""));
                return {
                    ...row,
                    // Prioriza nome vindo da sessão WhatsApp em tempo real.
                    displayName: row.whatsappNameOverride || live.profileName || row.displayName,
                    profilePicUrl: live.profilePicUrl || row.profilePicUrl,
                    avatarVersion: new Date().toISOString(),
                };
            }));
        }
        const allNames = visibleBaseItems.map((row) => String(row?.name || "").trim()).filter(Boolean);
        const reconciled = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.reconcileOrphanInstancesForMaster(auth, allNames);
        if (reconciled > 0) {
            console.info(`[instancias] ${reconciled} instância(s) órfã(s) vinculada(s) ao master ${auth.email}.`);
        }
        items = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterItemsForAuth(auth, items, (row) => String(row?.name || ""));
        ativas = items.filter((row) => String(row?.connectionStatus || "").toLowerCase().includes("open"))
            .length;
        desconectadas = items.length - ativas;
        void saveEvoInstancesCache(visibleBaseItems.map((row) => ({ ...row })));
        const enrichedItems = await attachAquecedorMessageStatsToInstanceItems(items, auth.email || "");
        ativas = enrichedItems.filter((row) => String(row?.connectionStatus || "").toLowerCase().includes("open")).length;
        desconectadas = enrichedItems.length - ativas;
        return res.json({
            total: enrichedItems.length,
            ativas,
            desconectadas,
            items: enrichedItems,
        });
    }
    catch (error) {
        console.error("Erro ao consultar Evolution API:", error);
        return res
            .status(500)
            .json({ error: "Erro ao consultar Evolution API" });
    }
});
function isAllowedAvatarHost(hostname) {
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
const INSTANCE_AVATAR_PLACEHOLDER_SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Sem foto">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  <text x="32" y="39" text-anchor="middle" fill="#ffffff" font-size="22" font-family="Segoe UI, sans-serif">◎</text>
</svg>`, "utf-8");
function sendInstanceAvatarPlaceholder(res) {
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
        let parsed;
        try {
            parsed = new URL(rawUrl);
        }
        catch {
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
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    catch (error) {
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
        if (await rejectForeignInstance(req, res, instanceName))
            return;
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
    }
    catch (error) {
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
        if (await rejectForeignInstance(req, res, instanceName))
            return;
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
    }
    catch (error) {
        console.error("Erro ao salvar nome WhatsApp da instância:", error);
        return res.status(500).json({ error: "Erro ao salvar nome (WhatsApp)." });
    }
});
app.get("/instancias/uso-config", async (req, res) => {
    try {
        const usageMap = await loadInstanceUsageMap();
        for (const [instanceName, cfg] of usageMap.entries()) {
            if (cfg.useAquecedor !== false) {
                await (0, aquecedor_instance_lifecycle_service_1.registerAquecedorInstancePreparing)(instanceName);
            }
        }
        const lifecycleMap = await (0, aquecedor_instance_lifecycle_service_1.getAquecedorLifecycleStatusMap)();
        const warmthMap = await (0, aquecedor_instance_warmth_service_1.getAquecedorWarmthMapForInstances)(Array.from(usageMap.keys()), getSupabaseClient());
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const allowed = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, Array.from(usageMap.keys()));
        const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
        const filteredEntries = Array.from(usageMap.entries()).filter(([instanceName]) => allowedLower.has(String(instanceName).toLowerCase()));
        const items = await Promise.all(filteredEntries.map(async ([instanceName, cfg]) => {
            const lifecycle = lifecycleMap[instanceName.toLowerCase()] ??
                (await (0, aquecedor_instance_lifecycle_service_1.getAquecedorLifecycleStatusForInstance)(instanceName));
            const warmth = warmthMap[instanceName.toLowerCase()];
            return {
                instanceName,
                ...cfg,
                aquecedorPhase: lifecycle?.phase ?? null,
                aquecedorStatusLabel: lifecycle?.statusLabel ?? null,
                aquecedorRestrictedUntil: lifecycle?.restrictedUntil ?? null,
                aquecedorPromoteAt: lifecycle?.promoteAt ?? null,
                warmthLevel: warmth?.level ?? 0,
                warmthLabel: warmth?.label ?? "Não aquecido",
            };
        }));
        return res.json({ items });
    }
    catch (error) {
        return res.status(500).json({ error: "Erro ao buscar configuração de uso das instâncias." });
    }
});
app.post("/instancias/uso-config", async (req, res) => {
    try {
        const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
        const items = rawItems
            .map((row) => ({
            instanceName: String(row?.instanceName || "").trim(),
            useAquecedor: row?.useAquecedor !== false,
            useDisparador: row?.useDisparador !== false,
            useFazenda: row?.useFazenda === true,
        }))
            .filter((row) => row.instanceName);
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const isMaster = auth.role === "master" || (0, waba_auth_service_1.isWabaMasterEmail)(auth.email);
        const allowed = await rejectForeignInstanceNames(req, items.map((row) => row.instanceName));
        const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
        const filtered = items.filter((row) => allowedLower.has(row.instanceName.toLowerCase()));
        const sanitized = filtered.map((row) => {
            if (isMaster)
                return row;
            const { useFazenda: _ignored, ...rest } = row;
            return rest;
        });
        if (!sanitized.length) {
            return res.status(400).json({ error: "Nenhuma instância válida foi informada." });
        }
        const usageMapBefore = await loadInstanceUsageMap();
        await persistInstanceUsage(sanitized);
        for (const row of sanitized) {
            if (row.useAquecedor !== false) {
                const prev = getInstanceUsageFromMap(usageMapBefore, row.instanceName);
                if (!prev || prev.useAquecedor === false) {
                    await (0, aquecedor_instance_lifecycle_service_1.registerAquecedorInstancePreparing)(row.instanceName);
                }
            }
        }
        return res.json({ ok: true, message: "Configuração de uso das instâncias salva.", items: sanitized });
    }
    catch {
        return res.status(500).json({ error: "Erro ao salvar configuração de uso das instâncias." });
    }
});
app.post("/webhooks/evolution", (req, res) => {
    try {
        (0, instance_integration_probe_1.handleEvolutionWebhookPayload)(req.body);
        (0, instance_inbound_validation_service_1.handleInboundValidationWebhook)(req.body);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("POST /webhooks/evolution", error);
        return res.status(500).json({ error: "Erro ao processar webhook Evolution." });
    }
});
app.post("/instancias/:name/probe-integracao", async (req, res) => {
    try {
        const name = String(req.params.name || "").trim();
        if (await rejectForeignInstance(req, res, name))
            return;
        const destinationInstanceName = String(req.body?.destinationInstanceName || "").trim() || undefined;
        if (destinationInstanceName &&
            (await rejectForeignInstance(req, res, destinationInstanceName))) {
            return;
        }
        const started = await (0, instance_integration_probe_1.startIntegrationProbe)({
            sourceInstanceName: name,
            destinationInstanceName,
            allowMessageSend: req.body?.allowMessageSend === true,
        });
        if (started.error) {
            return res.status(400).json({ ok: false, error: started.error });
        }
        const status = started.status || (0, instance_integration_probe_1.getIntegrationProbeStatus)(String(started.probeId || ""));
        return res.json({ ok: true, probeId: started.probeId, ...status });
    }
    catch (error) {
        console.error("POST /instancias/:name/probe-integracao", error);
        return res.status(500).json({ error: error?.message || "Erro ao iniciar teste de integração." });
    }
});
app.get("/instancias/probe-integracao/:probeId", (req, res) => {
    const probeId = String(req.params.probeId || "").trim();
    if (!probeId) {
        return res.status(400).json({ error: "probeId é obrigatório." });
    }
    const status = (0, instance_integration_probe_1.getIntegrationProbeStatus)(probeId);
    if (!status) {
        return res.status(404).json({ error: "Teste de integração não encontrado ou expirado." });
    }
    return res.json({ ok: true, ...status });
});
app.get("/instancias/:name/status-conexao", async (req, res) => {
    try {
        const name = String(req.params.name || "").trim();
        if (!name) {
            return res.status(400).json({ error: "Nome da instância é obrigatório." });
        }
        if (await rejectForeignInstance(req, res, name))
            return;
        const live = await fetchEvoInstanceConnectionState(name);
        if (live.ok) {
            let instanceNumber = "";
            if (live.open) {
                instanceNumber = await (0, evo_instance_phone_service_1.resolveEvoInstancePhone)(name);
                if (!instanceNumber) {
                    const supabase = getSupabaseClient();
                    if (supabase) {
                        const { data } = await supabase
                            .from("controle_instancia")
                            .select("numero_whatsapp")
                            .eq("instancia", name)
                            .maybeSingle();
                        instanceNumber = (0, evo_instance_phone_service_1.normalizeEvoWhatsAppNumber)(String(data?.numero_whatsapp || "").trim());
                    }
                }
            }
            return res.json({
                ok: true,
                name,
                connectionStatus: live.state,
                open: live.open,
                instanceNumber: instanceNumber || null,
                source: "connectionState",
            });
        }
        const evoList = await fetchEvoInstancesList();
        if (evoList.ok) {
            const needle = name.toLowerCase();
            const match = evoList.instances.find((inst) => {
                const key = String(inst?.instanceName ?? inst?.name ?? inst?.instance ?? "")
                    .trim()
                    .toLowerCase();
                return key === needle;
            });
            if (match) {
                const state = String(match.connectionStatus ?? match.status ?? "unknown")
                    .trim()
                    .toLowerCase();
                const phoneRow = (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(match);
                let instanceNumber = phoneRow?.phone || "";
                if (!instanceNumber && state.includes("open")) {
                    instanceNumber = await (0, evo_instance_phone_service_1.resolveEvoInstancePhone)(name);
                }
                return res.json({
                    ok: true,
                    name,
                    connectionStatus: state || "unknown",
                    open: state.includes("open"),
                    instanceNumber: instanceNumber || null,
                    source: "fetchInstances",
                });
            }
        }
        return res.status(502).json({
            ok: false,
            error: "Não foi possível consultar o status da instância na Evolution.",
        });
    }
    catch (error) {
        console.error("GET /instancias/:name/status-conexao", error);
        return res.status(500).json({ error: "Erro ao consultar status da instância." });
    }
});
app.post("/instancias/:name/validacao-inbound", async (req, res) => {
    try {
        const name = String(req.params.name || "").trim();
        if (await rejectForeignInstance(req, res, name))
            return;
        const instanceNumberHint = String(req.body?.number || req.body?.instanceNumberHint || "").trim();
        const started = await (0, instance_inbound_validation_service_1.startInboundValidation)({
            instanceName: name,
            instanceNumberHint,
        });
        if (started.error) {
            return res.status(400).json({ ok: false, error: started.error });
        }
        const status = started.status || (0, instance_inbound_validation_service_1.getInboundValidationStatus)(String(started.validationId || ""));
        return res.json({ ok: true, validationId: started.validationId, ...status });
    }
    catch (error) {
        console.error("POST /instancias/:name/validacao-inbound", error);
        return res.status(500).json({ error: error?.message || "Erro ao iniciar validação inbound." });
    }
});
app.get("/instancias/validacao-inbound/:validationId", (req, res) => {
    const validationId = String(req.params.validationId || "").trim();
    if (!validationId) {
        return res.status(400).json({ error: "validationId é obrigatório." });
    }
    const status = (0, instance_inbound_validation_service_1.getInboundValidationStatus)(validationId);
    if (!status) {
        return res.status(404).json({ error: "Validação não encontrada ou expirada." });
    }
    return res.json({ ok: true, ...status });
});
function buildTemplateUrl(template, instanceName) {
    if (!template)
        return "";
    return template
        .replace("{instance}", encodeURIComponent(instanceName))
        .replace("{name}", encodeURIComponent(instanceName));
}
function normalizeWhatsAppNumber(num) {
    const raw = String(num || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits)
        return raw;
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
        return "55" + digits;
    }
    return digits;
}
function normalizeCampaignPhone(input) {
    const normalized = normalizeWhatsAppNumber(String(input || ""));
    return String(normalized || "").replace(/\D/g, "");
}
/** Uma linha de contato → um destino: remove duplicatas pelo telefone normalizado (55…). */
function deduplicateCampaignDestinationPhones(digitCandidates) {
    const seen = new Set();
    const phones = [];
    let removedDuplicates = 0;
    for (const cand of digitCandidates) {
        const digits = normalizeCampaignPhone(String(cand || ""));
        if (digits.length < 12)
            continue;
        if (seen.has(digits)) {
            removedDuplicates += 1;
            continue;
        }
        seen.add(digits);
        phones.push(digits);
    }
    return { phones, removedDuplicates };
}
function isPlausibleBrWhatsappDestinationDigits(digits) {
    const d = String(digits || "").replace(/\D/g, "");
    if (!d.startsWith("55"))
        return false;
    if (d.length < 12 || d.length > 13)
        return false;
    if (d.length === 13)
        return d[4] === "9";
    return true;
}
function classifyEvoSendFailure(status, body) {
    const b = String(body || "").toLowerCase();
    if (b.includes("not registered") ||
        b.includes("not exist") ||
        b.includes("not found") ||
        (b.includes("invalid") &&
            (b.includes("number") || b.includes("phone") || b.includes("jid") || b.includes("recipient"))) ||
        b.includes("is not on whatsapp") ||
        b.includes("no whatsapp") ||
        (status === 400 && (b.includes("number") || b.includes("jid")))) {
        return "destination_error";
    }
    return "send_error";
}
function extractNumbersFromXlsxBuffer(buffer, numberColumn) {
    const col = String(numberColumn || "").trim();
    if (!col)
        return { phones: [], removedDuplicates: 0 };
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        return { phones: [], removedDuplicates: 0 };
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const bucket = [];
    for (const row of rows) {
        const raw = row[col];
        const digits = normalizeCampaignPhone(String(raw ?? ""));
        if (digits.length >= 12)
            bucket.push(digits);
    }
    return deduplicateCampaignDestinationPhones(bucket);
}
function extractInstanceNumber(inst) {
    const row = (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(inst?.instance ? inst : { instance: inst });
    if (row?.phone)
        return row.phone;
    const raw = inst?.ownerJid ??
        inst?.owner ??
        inst?.number ??
        inst?.phone ??
        inst?.ownerNumber ??
        inst?.profile?.owner ??
        "";
    const s = String(raw).trim();
    if (!s)
        return "";
    if (s.includes("@"))
        return s.split("@")[0] || s;
    return s;
}
function normalizeOwnerNumberForWhatsapp(numberLike) {
    const raw = String(numberLike || "").trim().toLowerCase();
    if (raw.includes("@s.whatsapp.net"))
        return raw;
    const digits = raw.replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.length >= 12 && digits.startsWith("55"))
        return `${digits}@s.whatsapp.net`;
    if (digits.length >= 10)
        return `55${digits}@s.whatsapp.net`;
    return `${digits}@s.whatsapp.net`;
}
function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function buildComparableOwnerDigits(ownerDigitsRaw) {
    const digits = normalizeDigits(ownerDigitsRaw);
    const out = new Set();
    if (!digits)
        return out;
    out.add(digits);
    if (digits.startsWith("55") && digits.length > 11)
        out.add(digits.slice(2));
    if (digits.length > 11)
        out.add(digits.slice(-11));
    if (digits.length > 10)
        out.add(digits.slice(-10));
    return out;
}
function extractOwnerMatchedName(payload, ownerJid, ownerDigitsRaw) {
    const ownerDigitsSet = buildComparableOwnerDigits(ownerDigitsRaw);
    const ownerJidLc = String(ownerJid || "").toLowerCase().trim();
    const seen = new Set();
    const queue = [payload];
    while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object" || seen.has(node))
            continue;
        seen.add(node);
        const idCandidate = node?.id ??
            node?.jid ??
            node?.wuid ??
            node?.owner ??
            node?.number ??
            node?.phone ??
            node?.remoteJid ??
            "";
        const idText = String(idCandidate || "").toLowerCase().trim();
        const idDigits = normalizeDigits(idText.includes("@") ? idText.split("@")[0] : idText);
        const idMatchesOwner = (ownerJidLc && idText === ownerJidLc) ||
            (idDigits && ownerDigitsSet.has(idDigits));
        if (idMatchesOwner) {
            const maybeName = node?.profileName ??
                node?.pushName ??
                node?.pushname ??
                node?.name ??
                node?.notify ??
                node?.verifiedName ??
                node?.businessName ??
                "";
            if (typeof maybeName === "string" && maybeName.trim())
                return maybeName.trim();
        }
        Object.values(node).forEach((value) => {
            if (value && typeof value === "object")
                queue.push(value);
        });
    }
    return "";
}
function pickProfileNameFromPayload(payload) {
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
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    // Fallback flexível, sem usar caminhos de contatos para evitar nome de terceiros.
    const seen = new Set();
    const queue = [payload];
    while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object" || seen.has(node))
            continue;
        seen.add(node);
        for (const [key, value] of Object.entries(node)) {
            if (/contact|contacts/i.test(key))
                continue;
            if (typeof value === "string" &&
                value.trim() &&
                /(profile.?name|push.?name|business.?name|verified.?name)/i.test(key)) {
                return value.trim();
            }
            if (value && typeof value === "object")
                queue.push(value);
        }
    }
    return "";
}
function pickProfilePictureFromPayload(payload) {
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
        if (typeof value === "string" && /^https?:\/\//i.test(value.trim()))
            return value.trim();
    }
    // Fallback flexível para variações de schema entre versões da EVO
    const seen = new Set();
    const queue = [payload];
    while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object" || seen.has(node))
            continue;
        seen.add(node);
        for (const [key, value] of Object.entries(node)) {
            if (typeof value === "string" &&
                /^https?:\/\//i.test(value.trim()) &&
                /(profile.?picture|profile.?pic|picture.?url|image.?url|pic.?url|avatar)/i.test(key)) {
                return value.trim();
            }
            if (value && typeof value === "object")
                queue.push(value);
        }
    }
    return "";
}
async function fetchLiveWhatsappProfile(instanceName, numberLike) {
    const safeInstance = String(instanceName || "").trim();
    if (!safeInstance)
        return { profileName: "", profilePicUrl: "" };
    const digits = String(numberLike || "").replace(/\D/g, "");
    const jid = normalizeOwnerNumberForWhatsapp(numberLike);
    const profileCalls = [
        { url: `${EVO_API_BASE}/profile/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
        { url: `${EVO_API_BASE}/instance/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
        { url: `${EVO_API_BASE}/chat/fetchProfile/${encodeURIComponent(safeInstance)}`, method: "GET" },
    ];
    const pictureCalls = [
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
        if (call.method === "POST" && !call.body)
            continue;
        try {
            const result = await callEvoAction(call.url, call.method, call.body);
            if (!result.ok)
                continue;
            const payload = result.json ?? {};
            profileName =
                profileName ||
                    extractOwnerMatchedName(payload, jid, digits) ||
                    pickProfileNameFromPayload(payload);
            if (profileName)
                break;
        }
        catch {
            // fallback silencioso
        }
    }
    for (const call of pictureCalls) {
        if (call.method === "POST" && !call.body)
            continue;
        try {
            const result = await callEvoAction(call.url, call.method, call.body);
            if (!result.ok)
                continue;
            const payload = result.json ?? {};
            profilePicUrl = profilePicUrl || pickProfilePictureFromPayload(payload);
            if (profilePicUrl)
                break;
        }
        catch {
            // fallback silencioso
        }
    }
    return { profileName, profilePicUrl };
}
function buildConnectedFromEvoResponse(instances) {
    const list = Array.isArray(instances) ? instances : [instances];
    return list
        .map((item) => {
        const row = (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(item);
        if (!row || !row.open || !row.instanceName)
            return null;
        const numero = row.phone;
        if (!numero)
            return null;
        return { instancia: row.instanceName, numero };
    })
        .filter((x) => x != null);
}
function mapGetInsensitive(m, k) {
    const key = String(k || "").trim();
    if (!key)
        return "";
    return (m.get(key)?.trim() ||
        m.get(key.toLowerCase())?.trim() ||
        "");
}
function addComparableNameKey(set, value) {
    const s = String(value || "").trim().toLowerCase();
    if (s)
        set.add(s);
}
/** Coluna «Nome da Instância» na UI = `instanceAlias || instanceName` (ver index.html). */
function instanceNomeInstanciaForDisparadorTag(instanceKey, aliasesMap) {
    const key = String(instanceKey || "").trim();
    if (!key)
        return "";
    const alias = mapGetInsensitive(aliasesMap, key);
    return (alias || key).trim();
}
function buildEvoInstanceTagRowsFromList(instances, whatsappMap, aliasesMap) {
    const list = Array.isArray(instances) ? instances : [instances];
    const rows = [];
    for (const item of list) {
        const inst = item?.instance ?? item;
        const candidateName = inst?.instanceName ??
            inst?.name ??
            inst?.id ??
            inst?.instanceId ??
            inst?.instance ??
            null;
        const instanceKey = candidateName == null || candidateName === ""
            ? ""
            : String(candidateName).trim();
        if (!instanceKey)
            continue;
        const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
        const connected = status.includes("open");
        const numRaw = extractInstanceNumber(inst);
        const digitKeys = buildComparableOwnerDigits(normalizeDigits(numRaw));
        const nameKeys = new Set();
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
        if (whatsappOverride)
            addComparableNameKey(nameKeys, whatsappOverride);
        if (alias)
            addComparableNameKey(nameKeys, alias);
        const displayName = instanceNomeInstanciaForDisparadorTag(instanceKey, aliasesMap);
        rows.push({ instanceKey, displayName, connected, nameKeys, digitKeys });
    }
    return rows;
}
async function fetchEvoInstanceTagRows() {
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
        if (!response.ok)
            return [];
        const raw = await response.json();
        const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.response)
                ? raw.response
                : Array.isArray(raw?.data)
                    ? raw.data
                    : [];
        return buildEvoInstanceTagRowsFromList(list, whatsappMap, aliasesMap);
    }
    catch {
        return [];
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function digitKeysFromStoredLabel(storedName) {
    const out = new Set();
    const raw = String(storedName || "").trim();
    if (!raw)
        return out;
    for (const run of raw.match(/\d+/g) || []) {
        for (const d of buildComparableOwnerDigits(run))
            out.add(d);
    }
    for (const d of buildComparableOwnerDigits(normalizeDigits(raw)))
        out.add(d);
    return out;
}
function resolveStoredNameToEvoTag(storedName, rows) {
    const raw = String(storedName || "").trim();
    const rawLc = raw.toLowerCase();
    if (!raw)
        return { displayName: "", connected: false };
    if (!rows.length)
        return { displayName: raw, connected: false };
    for (const r of rows) {
        if (r.nameKeys.has(rawLc)) {
            return { displayName: r.displayName, connected: r.connected };
        }
    }
    const storedDigitKeys = digitKeysFromStoredLabel(raw);
    const digitHits = [];
    if (storedDigitKeys.size > 0) {
        for (const r of rows) {
            let hit = false;
            for (const d of storedDigitKeys) {
                if (r.digitKeys.has(d)) {
                    hit = true;
                    break;
                }
            }
            if (hit)
                digitHits.push(r);
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
function pickBestDigitHitRow(raw, rawLc, digitHits) {
    if (digitHits.length <= 1)
        return digitHits[0];
    const runs = (raw.match(/\d+/g) || []).slice().sort((a, b) => b.length - a.length);
    const longestDigits = runs[0] || "";
    const scored = digitHits.map((r) => {
        let score = 0;
        const disp = r.displayName.toLowerCase();
        const ik = r.instanceKey.toLowerCase();
        if (longestDigits.length >= 4) {
            if (disp.includes(longestDigits))
                score += 100;
            if (ik.includes(longestDigits))
                score += 70;
        }
        else if (longestDigits.length > 0) {
            if (disp === longestDigits || ik === longestDigits)
                score += 40;
        }
        if (rawLc.length >= 3) {
            if (disp.includes(rawLc))
                score += 90;
            if (ik.includes(rawLc))
                score += 50;
        }
        if (r.connected)
            score += 3;
        return { r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0]?.score ?? 0;
    const tier = scored.filter((x) => x.score === top);
    const open = tier.find((x) => x.r.connected);
    return (open ?? tier[0] ?? scored[0]).r;
}
function disparadorInstanceTagsForCampaign(config, evoRows) {
    const snap = config || DISPAROS_DEFAULTS;
    const raw = Array.isArray(snap.selectedDisparadorInstances)
        ? snap.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
        : [];
    if (!raw.length)
        return [];
    const accum = new Map();
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
        }
        else {
            accum.set(key, { displayName: display, connected: r.connected });
        }
    }
    return Array.from(accum.values())
        .map((v) => ({
        instanceName: v.displayName,
        connected: v.connected,
    }))
        .sort((a, b) => a.instanceName.localeCompare(b.instanceName, "pt-BR", { sensitivity: "base" }));
}
function getCampaignInstanceHealth(config, evoRows) {
    const tags = disparadorInstanceTagsForCampaign(config, evoRows);
    const selectedCount = tags.length;
    const connectedCount = tags.filter((t) => t.connected === true).length;
    const disconnectedCount = Math.max(0, selectedCount - connectedCount);
    const disconnectedPercent = selectedCount > 0 ? Math.round((disconnectedCount / selectedCount) * 100) : 0;
    const shouldPauseByDisconnectedRatio = selectedCount > 0 && disconnectedCount / selectedCount >= 0.5;
    const minConnectedRequired = alternativa_dispatch_rules_1.DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES;
    const needsMoreInstancesForMinimum = connectedCount < minConnectedRequired;
    const missingConnectedForMinimum = Math.max(0, minConnectedRequired - connectedCount);
    return {
        selectedCount,
        connectedCount,
        disconnectedCount,
        disconnectedPercent,
        shouldPauseByDisconnectedRatio,
        minConnectedRequired,
        needsMoreInstancesForMinimum,
        missingConnectedForMinimum,
    };
}
function resolveUsageFromMap(usageMap, instanceName) {
    const key = String(instanceName || "").trim();
    if (!key)
        return undefined;
    const direct = usageMap.get(key);
    if (direct)
        return direct;
    const target = key.toLowerCase();
    for (const [mapKey, value] of usageMap.entries()) {
        if (mapKey.toLowerCase() === target)
            return value;
    }
    return undefined;
}
async function filterDisparadorInstancesReadyForAuth(auth, names) {
    const allowed = await waba_fazenda_pool_service_1.wabaFazendaPoolService.filterDisparadorInstancesForAuth(auth, names);
    return (0, aquecedor_instance_lifecycle_service_1.filterInstancesLifecycleReady)(allowed);
}
async function resolveAutoInstancesForCampaign(auth, config, evoRows, maxToAdd) {
    if (maxToAdd <= 0)
        return [];
    const prevSelected = new Set((Array.isArray(config?.selectedDisparadorInstances) ? config.selectedDisparadorInstances : [])
        .map((n) => String(n || "").trim().toLowerCase())
        .filter(Boolean));
    const connectedByKey = new Map();
    for (const row of evoRows) {
        const key = String(row.instanceKey || "").trim().toLowerCase();
        if (key && row.connected === true) {
            connectedByKey.set(key, row);
        }
    }
    const usageMap = await loadInstanceUsageMap();
    const activationRepository = new alternativa_number_activation_repository_1.AlternativaNumberActivationRepository();
    const email = String(auth.email || "").trim().toLowerCase();
    const activations = email.includes("@") ? activationRepository.listForEmail(email) : [];
    const activationKeys = new Set(activations.map((row) => String(row.instanceName || "").trim().toLowerCase()).filter(Boolean));
    const purchasedConnected = [];
    const aquecedorConnected = [];
    for (const row of activations) {
        const name = String(row.instanceName || "").trim();
        const key = name.toLowerCase();
        if (!name || prevSelected.has(key) || !connectedByKey.has(key))
            continue;
        purchasedConnected.push(name);
    }
    const ownedCandidates = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.filterInstanceNamesForAuth(auth, Array.from(connectedByKey.values()).map((row) => row.instanceKey));
    for (const name of ownedCandidates) {
        const key = String(name || "").trim().toLowerCase();
        if (!key || prevSelected.has(key) || activationKeys.has(key))
            continue;
        const usage = resolveUsageFromMap(usageMap, name);
        if (usage?.useAquecedor === false)
            continue;
        aquecedorConnected.push(String(name).trim());
    }
    const ordered = Array.from(new Set([...purchasedConnected, ...aquecedorConnected]));
    const allowed = await filterDisparadorInstancesReadyForAuth(auth, ordered);
    return allowed.slice(0, maxToAdd);
}
function describeEvoQrFailure(createStatus, qrStatus, createDetail, qrDetail) {
    const detail = String(qrDetail || createDetail || "").trim();
    if (isIgnorableEvoQrFetchError(qrStatus, detail)) {
        return "Evolution: use GET /instance/connect para QR. Tente «Atualizar QR» novamente.";
    }
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
    if (isEvoConnectEmptyQrDetail(detail)) {
        return "Evolution não retornou QRCode (count:0). A sessão pode estar iniciando — aguarde e use «Atualizar QR». Se persistir, reinicie o container Evolution no Easypanel.";
    }
    const summarized = summarizeEvolutionErrorDetail(detail, qrStatus || createStatus);
    if (summarized && summarized !== detail)
        return summarized;
    if (detail)
        return `Evolution API: ${detail}`;
    return "Dados salvos, mas falha ao gerar QRCode na EVO. Tente «Atualizar QR».";
}
function summarizeEvolutionErrorDetail(detail, status = 0) {
    const raw = String(detail || "").trim();
    if (!raw)
        return "";
    let parsed = null;
    if (raw.startsWith("{")) {
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            /* mantém texto bruto */
        }
    }
    const response = parsed?.response;
    const nested = (response && typeof response === "object"
        ? response.message
        : null) ??
        parsed?.message ??
        parsed?.error ??
        raw;
    const text = String(nested).trim();
    if (/integrationSession|prismaRepository/i.test(text)) {
        return "Evolution API com erro interno no banco (Prisma/integrationSession). Reinicie o serviço Evolution no Easypanel e confira o PostgreSQL da EVO.";
    }
    if (status === 500 || /internal server error/i.test(text)) {
        const first = text
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.length > 0) || text;
        if (first.length > 220)
            return `Evolution API erro 500: ${first.slice(0, 200)}…`;
        return `Evolution API erro 500: ${first}`;
    }
    if (text.length > 400)
        return `${text.slice(0, 380)}…`;
    return text;
}
function describeEvoInstancesFetchError(status, detail) {
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
async function callEvoAction(url, method, body, options) {
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, method, {
        apiKey: EVO_API_KEY,
        body,
        timeoutMs: options?.timeoutMs ?? (0, evo_http_client_1.defaultEvoHttpTimeoutMs)(),
        retries: options?.retries ?? 1,
    });
    const mergedBody = result.error
        ? [result.error, result.body].filter(Boolean).join(" | ")
        : result.body;
    return {
        ok: result.ok,
        status: result.status,
        body: mergedBody,
        json: result.json,
        error: result.error,
    };
}
function parseEvoInstancesList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object") {
        const record = raw;
        if (Array.isArray(record.response))
            return record.response;
        if (Array.isArray(record.data))
            return record.data;
    }
    return raw ? [raw] : [];
}
async function fetchEvoInstancesList() {
    const result = await callEvoAction(EVO_INSTANCES_URL, "GET", undefined, {
        timeoutMs: 12000,
        retries: 1,
    });
    if (!result.ok) {
        const detail = summarizeEvolutionErrorDetail(String(result.body || result.error || "Erro ao buscar instâncias na Evolution API."), result.status);
        return { ok: false, status: result.status, detail };
    }
    return { ok: true, instances: parseEvoInstancesList(result.json) };
}
const EVO_INSTANCES_CACHE_FILE = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
async function loadEvoInstancesCache() {
    try {
        const raw = await fs_1.promises.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.items))
            return null;
        return {
            updatedAt: String(parsed.updatedAt || ""),
            items: parsed.items,
        };
    }
    catch {
        return null;
    }
}
async function saveEvoInstancesCache(items) {
    try {
        const payload = {
            updatedAt: new Date().toISOString(),
            items,
        };
        await fs_1.promises.mkdir(path_1.default.dirname(EVO_INSTANCES_CACHE_FILE), { recursive: true });
        await fs_1.promises.writeFile(EVO_INSTANCES_CACHE_FILE, JSON.stringify(payload, null, 2), "utf-8");
    }
    catch {
        /* cache opcional */
    }
}
async function removeInstanceFromEvoCache(instanceName) {
    const keys = await resolveInstanceDeletionKeys(instanceName);
    if (!keys.length)
        return;
    const cache = await loadEvoInstancesCache();
    if (!cache?.items?.length)
        return;
    const blocked = new Set(keys.map((k) => k.toLowerCase()));
    const nextItems = cache.items.filter((row) => !blocked.has(String(row?.name || "").trim().toLowerCase()));
    if (nextItems.length === cache.items.length)
        return;
    await saveEvoInstancesCache(nextItems);
}
async function resolveInstanceDeletionKeys(instanceName) {
    const name = String(instanceName || "").trim();
    if (!name)
        return [];
    const keys = new Set([name]);
    const aliasesMap = await loadInstanceAliasesMap();
    const alias = mapGetInsensitive(aliasesMap, name);
    if (alias)
        keys.add(alias);
    for (const [technical, technicalAlias] of aliasesMap.entries()) {
        const comparable = [technical, technicalAlias].map((v) => String(v || "").trim().toLowerCase());
        const nameLower = name.toLowerCase();
        if (comparable.includes(nameLower)) {
            keys.add(technical);
            if (technicalAlias)
                keys.add(technicalAlias);
        }
    }
    const candidates = await resolveEvoInstanceNameCandidates(name);
    for (const candidate of candidates)
        keys.add(candidate);
    try {
        const evoList = await fetchEvoInstancesList();
        if (evoList.ok) {
            for (const inst of evoList.instances) {
                const evoKey = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
                if (!evoKey)
                    continue;
                const evoLower = evoKey.toLowerCase();
                if ([...keys].some((k) => k.toLowerCase() === evoLower))
                    keys.add(evoKey);
            }
        }
    }
    catch {
        // lista EVO opcional
    }
    return Array.from(keys).filter(Boolean);
}
async function filterDeletedInstancesFromItems(items, readName) {
    const filtered = [];
    for (const item of items) {
        const name = String(readName(item) || "").trim();
        if (!name)
            continue;
        if (await waba_instance_ownership_service_1.wabaInstanceOwnershipService.isInstanceDeleted(name))
            continue;
        filtered.push(item);
    }
    return filtered;
}
function canDeleteInstanceLocallyAfterEvoFailure(status, body) {
    if (status === 0)
        return true;
    if (status === 404)
        return true;
    if (status >= 400 && status <= 599)
        return true;
    const normalized = String(body || "").toLowerCase();
    return (normalized.includes("not found") ||
        normalized.includes("não encontr") ||
        normalized.includes("nao encontr") ||
        normalized.includes("does not exist") ||
        normalized.includes("instance not"));
}
function mapDeleteInsensitive(map, rawKey) {
    const target = String(rawKey || "").trim().toLowerCase();
    if (!target)
        return false;
    let removed = false;
    for (const key of [...map.keys()]) {
        if (key.toLowerCase() === target) {
            map.delete(key);
            removed = true;
        }
    }
    return removed;
}
async function removeInstanceUsageConfig(instanceName) {
    const target = String(instanceName || "").trim().toLowerCase();
    if (!target)
        return;
    for (const key of [...instanceUsageMemory.keys()]) {
        if (key.toLowerCase() === target)
            instanceUsageMemory.delete(key);
    }
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
    try {
        const usageMap = await loadInstanceUsageMap();
        const keysToDelete = [...usageMap.keys()].filter((key) => key.toLowerCase() === target);
        for (const key of keysToDelete) {
            await supabase.from("instancias_uso_config")
                .delete()
                .eq("instance_name", key);
        }
    }
    catch {
        // fallback em memória
    }
}
async function purgeInstanceLocalState(instanceName) {
    const purgeKeys = await resolveInstanceDeletionKeys(instanceName);
    if (!purgeKeys.length)
        return;
    const aliasesMap = await loadInstanceAliasesMap();
    const purgeLower = new Set(purgeKeys.map((k) => k.toLowerCase()));
    let aliasesChanged = false;
    for (const [technical, technicalAlias] of [...aliasesMap.entries()]) {
        const comparable = [technical, technicalAlias].map((v) => String(v || "").trim().toLowerCase());
        const shouldRemove = comparable.some((key) => purgeLower.has(key));
        if (shouldRemove) {
            aliasesMap.delete(technical);
            aliasesChanged = true;
        }
    }
    if (aliasesChanged)
        await persistInstanceAliasesMap(aliasesMap);
    const whatsappMap = await loadWhatsappProfileNamesMap();
    let whatsappChanged = false;
    for (const key of purgeKeys) {
        if (mapDeleteInsensitive(whatsappMap, key))
            whatsappChanged = true;
    }
    if (whatsappChanged)
        await persistWhatsappProfileNamesMap(whatsappMap);
    for (const key of purgeKeys) {
        await removeInstanceUsageConfig(key);
        await (0, aquecedor_instance_lifecycle_service_1.removeAquecedorInstanceLifecycle)(key);
        await waba_instance_ownership_service_1.wabaInstanceOwnershipService.removeOwner(key);
    }
    await waba_instance_ownership_service_1.wabaInstanceOwnershipService.markInstancesDeleted(purgeKeys);
    await removeInstanceFromEvoCache(instanceName);
}
function buildEvoDeleteCandidateUrls(instanceName) {
    const enc = encodeURIComponent(String(instanceName || "").trim());
    const templateUrl = buildTemplateUrl(EVO_DELETE_URL_TEMPLATE, instanceName);
    return Array.from(new Set([
        templateUrl,
        `${EVO_API_BASE}/instance/delete/${enc}`,
        `${EVO_API_BASE}/instance/deleteInstance/${enc}`,
    ].filter(Boolean)));
}
async function tryDeleteEvoInstance(instanceName) {
    const candidates = await resolveInstanceDeletionKeys(instanceName);
    if (!candidates.length) {
        return { ok: false, status: 400, body: "Nome inválido.", evoDeleted: false };
    }
    let last = { ok: false, status: 0, body: "" };
    for (const candidate of candidates) {
        const enc = encodeURIComponent(candidate);
        await callEvoAction(`${EVO_API_BASE}/instance/logout/${enc}`, "DELETE", undefined, {
            timeoutMs: 8000,
            retries: 0,
        });
        const urls = buildEvoDeleteCandidateUrls(candidate);
        for (const url of urls) {
            const result = await callEvoAction(url, "DELETE", undefined, {
                timeoutMs: 12000,
                retries: 1,
            });
            const body = String(result.body || result.error || "");
            last = { ok: result.ok, status: result.status, body };
            if (result.ok) {
                return { ok: true, status: result.status, body, evoDeleted: true };
            }
        }
    }
    return { ...last, evoDeleted: false };
}
async function attachAquecedorMessageStatsToInstanceItems(items, ownerEmail) {
    const names = items.map((row) => String(row?.name || "").trim()).filter(Boolean);
    if (!names.length)
        return items;
    const stats = await (0, aquecedor_instance_message_stats_service_1.getAquecedorMessageStatsForInstances)(names, {
        ownerEmail,
        supabase: getSupabaseClient(),
    });
    return items.map((row) => {
        const name = String(row?.name || "").trim();
        const hit = stats.get(name) || stats.get(name.toLowerCase()) || {
            sent: 0,
            received: 0,
            total: 0,
        };
        return {
            ...row,
            aquecedorMessagesSent: hit.sent,
            aquecedorMessagesReceived: hit.received,
            messages: hit.total,
        };
    });
}
async function buildInstancesSnapshotForAuth(auth) {
    const ownedNames = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.listOwnedInstanceNames(auth.email);
    const cache = await loadEvoInstancesCache();
    const cacheByName = new Map();
    for (const row of cache?.items || []) {
        const name = String(row?.name || "").trim();
        if (name)
            cacheByName.set(name.toLowerCase(), row);
    }
    const aliasesMap = await loadInstanceAliasesMap();
    const whatsappNamesMap = await loadWhatsappProfileNamesMap();
    const items = ownedNames.map((instanceName) => {
        const cached = cacheByName.get(instanceName.toLowerCase());
        if (cached) {
            return {
                ...cached,
                name: instanceName,
                displayName: String(cached.displayName || cached.name || instanceName).trim() || instanceName,
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
    const ativas = items.filter((row) => String(row?.connectionStatus || "").toLowerCase().includes("open")).length;
    const enrichedItems = await attachAquecedorMessageStatsToInstanceItems(items, auth.email || "");
    return {
        total: enrichedItems.length,
        ativas,
        desconectadas: enrichedItems.length - ativas,
        items: enrichedItems,
        fromCache: true,
        cacheUpdatedAt: String(cache?.updatedAt || ""),
    };
}
async function buildFallbackInstancesForAuth(auth, evolutionError) {
    const snapshot = await buildInstancesSnapshotForAuth(auth);
    return {
        ...snapshot,
        degraded: true,
        evolutionError,
    };
}
async function callEvoSendTextWithRetry(url, body, maxAttempts = 3) {
    let last = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await callEvoAction(url, "POST", body);
        last = result;
        const accepted = result.ok && isEvoSendTextAccepted(result.json, result.body);
        if (accepted)
            return result;
        if (result.ok && !accepted) {
            last = {
                ...result,
                ok: false,
                body: `${result.body || ""} | EVO retornou HTTP OK, mas corpo indica falha no envio.`.slice(0, 500),
            };
        }
        const bodyLc = String(last.body || "").toLowerCase();
        const isTransient = last.status === 429 ||
            last.status === 500 ||
            last.status === 502 ||
            last.status === 503 ||
            last.status === 504 ||
            bodyLc.includes("connection closed") ||
            bodyLc.includes("timeout");
        if (!isTransient || attempt >= maxAttempts)
            break;
        const waitMs = Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180);
        await new Promise((r) => setTimeout(r, waitMs));
    }
    return (last || {
        ok: false,
        status: 0,
        body: "Falha sem retorno da EVO.",
        json: null,
    });
}
function isEvoSendTextAccepted(json, body) {
    const rawBody = String(body || "").trim();
    if (rawBody.toLowerCase().includes('"error"')) {
        try {
            const parsed = JSON.parse(rawBody);
            if (parsed?.error)
                return false;
        }
        catch {
            /* */
        }
    }
    if (!json || typeof json !== "object")
        return true;
    const root = json;
    if (root.error)
        return false;
    const status = String(root.status ?? "").trim().toUpperCase();
    if (status === "ERROR" || status === "FAILED")
        return false;
    const message = root.message;
    if (message && typeof message === "object") {
        const msgStatus = String(message.status ?? "")
            .trim()
            .toUpperCase();
        if (msgStatus === "ERROR" || msgStatus === "FAILED")
            return false;
    }
    return true;
}
function resolveAquecedorInstanceDigits(raw) {
    const text = String(raw || "").trim();
    if (!text)
        return "";
    const prefix = text.includes("@") ? text.split("@")[0] : text;
    return prefix.replace(/\D/g, "");
}
function toAquecedorRemoteJid(num) {
    const digits = resolveAquecedorInstanceDigits(String(num || "").trim());
    return digits ? `${digits}@s.whatsapp.net` : "";
}
function buildAquecedorRemoteJidCandidates(num) {
    const rawDigits = resolveAquecedorInstanceDigits(num);
    if (!rawDigits)
        return [];
    const out = new Set();
    const add = (digits) => {
        const d = String(digits || "").replace(/\D/g, "");
        if (d)
            out.add(`${d}@s.whatsapp.net`);
    };
    add(rawDigits);
    if (rawDigits.length === 10) {
        add(`1${rawDigits}`);
        add(`55${rawDigits}`);
    }
    if (rawDigits.length === 11 && !rawDigits.startsWith("1")) {
        add(`55${rawDigits}`);
    }
    if (rawDigits.startsWith("55") && rawDigits.length > 11) {
        add(rawDigits.slice(2));
    }
    if (rawDigits.startsWith("1") && rawDigits.length >= 11) {
        add(rawDigits.slice(1));
    }
    const suffix10 = rawDigits.slice(-10);
    if (suffix10.length === 10) {
        add(suffix10);
        add(`1${suffix10}`);
        add(`55${suffix10}`);
    }
    const legacyBr = normalizeWhatsAppNumber(num);
    if (legacyBr && legacyBr !== rawDigits)
        add(legacyBr);
    return Array.from(out);
}
async function resolveEvoInstanceNameCandidates(displayName) {
    const raw = String(displayName || "").trim();
    if (!raw)
        return [];
    const aliasesMap = await loadInstanceAliasesMap();
    const candidates = new Set([raw]);
    for (const [technical, alias] of aliasesMap.entries()) {
        if (technical.toLowerCase() === raw.toLowerCase())
            candidates.add(technical);
        if (alias.toLowerCase() === raw.toLowerCase())
            candidates.add(technical);
    }
    return Array.from(candidates);
}
function buildAquecedorDeliveryTag() {
    const raw = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return raw.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase().padStart(6, "0");
}
function appendAquecedorDeliveryTag(text, tag) {
    const base = String(text || "").trim();
    const token = String(tag || "").trim();
    if (!base)
        return token;
    if (!token)
        return base;
    return `${base} ${token}`;
}
function extractAquecedorMessageMarker(text) {
    const value = String(text || "").trim();
    const suffix = value.match(/\b([a-z0-9]{5,8})\s*$/i);
    if (suffix?.[1])
        return suffix[1].toLowerCase();
    return value.slice(-24).toLowerCase();
}
function extractAquecedorMessageTimestampMs(node) {
    const key = node.key;
    const raw = key?.messageTimestamp ?? node.messageTimestamp ?? node.timestamp;
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw > 1000000000000 ? raw : raw * 1000;
    }
    if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed))
            return parsed > 1000000000000 ? parsed : parsed * 1000;
    }
    return null;
}
function extractAquecedorFromMe(node) {
    const key = node.key;
    if (typeof key?.fromMe === "boolean")
        return key.fromMe;
    if (typeof node.fromMe === "boolean")
        return node.fromMe;
    return null;
}
function collectEvoChatMessageTexts(node, out, depth = 0) {
    if (depth > 10 || node == null)
        return;
    if (typeof node === "string")
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            collectEvoChatMessageTexts(item, out, depth + 1);
        return;
    }
    if (typeof node !== "object")
        return;
    const obj = node;
    if (typeof obj.conversation === "string" && obj.conversation.trim()) {
        out.push(obj.conversation.trim());
    }
    const ext = obj.extendedTextMessage;
    if (typeof ext?.text === "string" && ext.text.trim())
        out.push(ext.text.trim());
    if (typeof obj.text === "string" && obj.text.trim())
        out.push(obj.text.trim());
    for (const value of Object.values(obj)) {
        if (value && typeof value === "object")
            collectEvoChatMessageTexts(value, out, depth + 1);
    }
}
function evoPayloadIncludesNeedle(node, needles, options, depth = 0) {
    if (depth > 14 || node == null)
        return false;
    if (Array.isArray(node)) {
        return node.some((item) => evoPayloadIncludesNeedle(item, needles, options, depth + 1));
    }
    if (typeof node !== "object")
        return false;
    const obj = node;
    const fromMe = extractAquecedorFromMe(obj);
    const texts = [];
    collectEvoChatMessageTexts(obj.message ?? obj, texts);
    const normalizedNeedles = needles
        .map((needle) => String(needle || "").trim().toLowerCase())
        .filter(Boolean);
    if (normalizedNeedles.length && texts.length) {
        const minTs = options?.minTimestampMs;
        const ts = extractAquecedorMessageTimestampMs(obj);
        const tsOk = minTs == null || ts == null || ts >= minTs;
        const fromMeOk = options?.fromMe == null || fromMe == null || fromMe === options.fromMe;
        if (tsOk && fromMeOk) {
            const matched = texts.some((text) => {
                const lowered = text.toLowerCase();
                return normalizedNeedles.some((needle) => lowered.includes(needle));
            });
            if (matched)
                return true;
        }
    }
    for (const value of Object.values(obj)) {
        if (value && typeof value === "object") {
            if (evoPayloadIncludesNeedle(value, needles, options, depth + 1))
                return true;
        }
    }
    return false;
}
function evoChatTextsIncludeMarker(node, marker) {
    return evoChatTextsIncludeNeedle(node, [marker]);
}
function evoChatTextsIncludeNeedle(node, needles) {
    return evoPayloadIncludesNeedle(node, needles);
}
async function probeAquecedorDeliveryViaFindMessages(instanceCandidates, remoteJids, needles, minTimestampMs, fromMe = null) {
    for (const instanceName of instanceCandidates) {
        const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(instanceName)}`;
        for (const remoteJid of remoteJids) {
            const whereKey = { remoteJid };
            if (fromMe != null)
                whereKey.fromMe = fromMe;
            const bodies = [
                { where: { key: whereKey }, limit: 50 },
                { where: { key: { remoteJid } }, limit: 50 },
                { where: { key: { remoteJid } }, take: 50 },
                { where: { key: { remoteJid: remoteJid.replace("@s.whatsapp.net", "") } }, limit: 50 },
                { limit: 80 },
                {},
            ];
            for (const body of bodies) {
                const result = await callEvoAction(url, "POST", body, {
                    timeoutMs: Math.min((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 25000),
                    retries: 1,
                });
                if (!result.ok)
                    continue;
                if (evoPayloadIncludesNeedle(result.json, needles, { minTimestampMs, fromMe })) {
                    return true;
                }
            }
        }
    }
    return false;
}
async function verifyAquecedorMessageDelivered(instanciaDestino, numeroOrigem, messageText, options) {
    const destino = String(instanciaDestino || "").trim();
    const remoteJids = buildAquecedorRemoteJidCandidates(numeroOrigem);
    if (!destino || !remoteJids.length) {
        return { ok: false, detail: "Parâmetros inválidos para conferir entrega no destinatário." };
    }
    const marker = extractAquecedorMessageMarker(messageText);
    const fullText = String(messageText || "").trim().toLowerCase();
    const needles = new Set();
    if (marker)
        needles.add(marker);
    if (fullText.length >= 6)
        needles.add(fullText);
    if (fullText.length >= 12)
        needles.add(fullText.slice(0, 48));
    const needleList = Array.from(needles);
    const timestampGraceMs = options?.timestampGraceMs ?? 5000;
    const minTimestampMs = (options?.sendStartedAtMs ?? Date.now()) - timestampGraceMs;
    const maxAttempts = Math.max(3, options?.maxAttempts ?? 12);
    const attemptIntervalMs = Math.max(1000, options?.attemptIntervalMs ?? 3000);
    const skipInitialDelay = options?.skipInitialDelay === true;
    const relaxTimestampOnLastAttempt = options?.relaxTimestampOnLastAttempt === true;
    const destinoCandidates = await resolveEvoInstanceNameCandidates(destino);
    if (!skipInitialDelay) {
        await sleepMs(3000);
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (attempt > 1)
            await sleepMs(attemptIntervalMs);
        const tsFilter = relaxTimestampOnLastAttempt && attempt === maxAttempts ? undefined : minTimestampMs;
        const foundOnDestino = await probeAquecedorDeliveryViaFindMessages(destinoCandidates, remoteJids, needleList, tsFilter, false);
        if (foundOnDestino) {
            return { ok: true, detail: "" };
        }
    }
    const origem = String(options?.instanciaOrigem || "").trim();
    const numeroDestino = resolveAquecedorInstanceDigits(String(options?.numeroDestino || ""));
    if (origem && numeroDestino) {
        const origemCandidates = await resolveEvoInstanceNameCandidates(origem);
        const destJids = buildAquecedorRemoteJidCandidates(numeroDestino);
        const foundOnOrigem = await probeAquecedorDeliveryViaFindMessages(origemCandidates, destJids, needleList, minTimestampMs, true);
        if (foundOnOrigem) {
            return {
                ok: false,
                detail: `Mensagem apareceu só na origem (${origem}); destino (${destino}) não recebeu no WhatsApp. Verifique conexão ou restrição do número destino.`,
            };
        }
    }
    return {
        ok: false,
        detail: "EVO aceitou o envio, mas a mensagem não apareceu no WhatsApp do destinatário (conferência findMessages).",
    };
}
async function revertAquecedorPendingAfterFailedSend(supabase, pendingId) {
    await supabase.from("aquecedor")
        .update({
        status: "PENDENTE",
        instancia: null,
        numero_destino: null,
        processing_at: null,
        sent_at: null,
    })
        .eq("id", pendingId);
}
const META_GRAPH_BASE = String(process.env.META_GRAPH_BASE || "https://graph.facebook.com").replace(/\/+$/, "");
const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v22.0").trim();
function sanitizeMetaId(value) {
    return String(value || "").trim();
}
async function callMetaGraphApi(input) {
    const token = String(input.token || "").trim();
    if (!token)
        throw new Error("Token da Meta não informado.");
    const path = String(input.path || "").trim().replace(/^\/+/, "");
    if (!path)
        throw new Error("Path da API da Meta não informado.");
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
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                json = null;
            }
            if (response.ok) {
                return { ok: true, status: response.status, json, body: text, endpoint };
            }
            lastStatus = response.status;
            lastBody = text;
            const transient = response.status === 429 ||
                response.status === 500 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504;
            if (!transient || attempt >= maxAttempts) {
                return { ok: false, status: response.status, json, body: text, endpoint };
            }
            const waitMs = Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    return { ok: false, status: lastStatus, json: null, body: lastBody, endpoint };
}
function metaAppSecretProof(accessToken, appSecret) {
    return crypto_1.default.createHmac("sha256", String(appSecret || "")).update(String(accessToken || "")).digest("hex");
}
function buildDisparosAiPrompt(input) {
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
function ensureMessageContainsLink(message, link, cta) {
    const text = String(message || "").trim();
    const safeLink = String(link || "").trim();
    if (!safeLink)
        return text;
    // Se a IA incluir o link longo do WhatsApp (wa.me), substituímos por shortUrl
    // para que o usuário receba sempre a URL curta e para manter o relatório consistente.
    const waMeRegex = /https?:\/\/wa\.me\/[0-9]+[^\s)"]*/gi;
    const replaced = text.replace(waMeRegex, safeLink);
    if (replaced.includes(safeLink))
        return replaced;
    const safeCta = String(cta || "Acesse aqui").trim();
    const joiner = text ? "\n\n" : "";
    return `${replaced}${joiner}${safeCta}: ${safeLink}`.trim();
}
async function generateShortUrlForDisparos(longUrl, publicBaseHints) {
    const baseUrl = String(longUrl || "").trim();
    if (!/^https?:\/\//i.test(baseUrl)) {
        throw new Error("accessUrl deve ser uma URL válida (http/https).");
    }
    const providers = getAutoShortenerProviderOrder();
    const maxAttempts = 5;
    let shortUrl = "";
    let sourceUrlUsed = baseUrl;
    let providerUsed = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const candidateUrl = attempt === 1 ? baseUrl : appendAntiRepeatParam(baseUrl, attempt);
        for (const provider of providers) {
            try {
                const candidateShort = await shortenUrlWithProvider(candidateUrl, provider, "", publicBaseHints);
                shortUrl = candidateShort;
                sourceUrlUsed = candidateUrl;
                providerUsed = provider;
                break;
            }
            catch {
                // tenta proximo provider
            }
        }
        if (shortUrl)
            break;
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
function extractFirstHttpUrl(text) {
    const raw = String(text || "");
    const match = raw.match(/https?:\/\/[^\s)]+/i);
    if (!match?.[0])
        return null;
    return match[0].trim();
}
function parseEncurtadorProClicks(payload) {
    const asNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const direct = asNumber(payload?.clicks);
    if (direct != null)
        return direct;
    const dataClicks = asNumber(payload?.data?.clicks);
    if (dataClicks != null)
        return dataClicks;
    const urls = Array.isArray(payload?.data?.urls) ? payload.data.urls : [];
    if (urls.length > 0) {
        const fromList = asNumber(urls[0]?.clicks);
        if (fromList != null)
            return fromList;
    }
    return 0;
}
async function fetchClicksForShortUrl(shortUrl) {
    if ((0, waba_shortener_service_1.isWabaManagedShortUrl)(shortUrl)) {
        const local = await (0, waba_shortener_service_1.fetchWabaShortUrlClicks)(shortUrl);
        if (local != null)
            return local;
    }
    return fetchClicksForShortUrlFromEncurtadorPro(shortUrl);
}
async function fetchClicksForShortUrlFromEncurtadorPro(shortUrl) {
    const safeShort = String(shortUrl || "").trim();
    if (!/^https?:\/\//i.test(safeShort))
        return 0;
    const cached = shortUrlClicksCache.get(safeShort);
    const nowMs = Date.now();
    if (cached && nowMs - cached.checkedAtMs < 120000) {
        return cached.clicks;
    }
    const apiKey = String(process.env.ENCURTADORPRO_API_KEY || "").trim();
    if (!apiKey)
        return 0;
    const endpoint = `https://app.encurtadorpro.com.br/api/urls?short=${encodeURIComponent(safeShort)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
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
    }
    catch {
        return 0;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function extractOpenAiText(payload) {
    const direct = String(payload?.output_text || "").trim();
    if (direct)
        return direct;
    const out = Array.isArray(payload?.output) ? payload.output : [];
    const chunks = [];
    for (const item of out) {
        const content = Array.isArray(item?.content) ? item.content : [];
        for (const part of content) {
            const text = String(part?.text || part?.output_text || "").trim();
            if (text)
                chunks.push(text);
        }
    }
    return chunks.join("\n").trim();
}
async function callOpenAiGenerateMessage(input) {
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
            let json = null;
            try {
                json = bodyText ? JSON.parse(bodyText) : null;
            }
            catch {
                json = null;
            }
            if (response.ok) {
                const text = extractOpenAiText(json);
                if (!text)
                    throw new Error("OpenAI retornou resposta sem texto.");
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
            if (!isTransient || attempt >= maxAttempts)
                break;
            const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
            await new Promise((r) => setTimeout(r, sleepMs));
        }
        catch (error) {
            const message = String(error?.message || "Erro de rede/timeout ao chamar OpenAI.");
            lastError = message;
            if (attempt >= maxAttempts)
                break;
            const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
            await new Promise((r) => setTimeout(r, sleepMs));
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    throw new Error(lastError);
}
async function shortenUrlWithProvider(longUrl, provider, customDomain = "", publicBaseHints) {
    const safeLongUrl = String(longUrl || "").trim();
    if (!safeLongUrl) {
        throw new Error("URL original é obrigatória.");
    }
    if (provider === "waba") {
        try {
            return await (0, waba_shortener_service_1.createWabaShortUrl)(safeLongUrl, {
                tenantId: "disparador",
                publicBaseHints,
            });
        }
        catch (error) {
            throw new Error(String(error?.message || "Falha no encurtador WABA."));
        }
    }
    if (provider === "encurtadorpro") {
        const apiKey = String(process.env.ENCURTADORPRO_API_KEY || "").trim();
        if (!apiKey) {
            throw new Error("ENCURTADORPRO_API_KEY não configurada.");
        }
        const payload = {
            url: safeLongUrl,
            status: "private",
        };
        const customAliasEnv = String(process.env.ENCURTADORPRO_CUSTOM_ALIAS || "").trim();
        if (customAliasEnv) {
            payload.custom = customAliasEnv;
        }
        else {
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
        if (preferredDomain)
            payload.domain = preferredDomain;
        const maxAttempts = 3;
        let lastErrorMessage = "Falha no encurtador EncurtadorPro.";
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
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
                const isTransient = response.status === 429 ||
                    response.status === 500 ||
                    response.status === 502 ||
                    response.status === 503 ||
                    response.status === 504;
                if (!isTransient || attempt >= maxAttempts)
                    break;
            }
            catch (error) {
                const message = String(error?.message || "Erro de rede ao chamar EncurtadorPro.");
                lastErrorMessage = message;
                if (attempt >= maxAttempts)
                    break;
            }
            finally {
                clearTimeout(timeoutId);
            }
            const sleepMs = Math.floor(300 * Math.pow(2, attempt - 1) + Math.random() * 150);
            await new Promise((r) => setTimeout(r, sleepMs));
        }
        throw new Error(lastErrorMessage);
    }
    throw new Error("Provedor de encurtador não suportado.");
}
function appendAntiRepeatParam(rawUrl, attempt) {
    try {
        const u = new URL(rawUrl);
        u.searchParams.set("_n8n_link_nonce", `${Date.now()}-${Math.floor(Math.random() * 1000000)}-${attempt}`);
        return u.toString();
    }
    catch {
        // fallback em caso de URL não parseável pelo construtor URL
        const sep = rawUrl.includes("?") ? "&" : "?";
        return `${rawUrl}${sep}_n8n_link_nonce=${Date.now()}-${attempt}`;
    }
}
function tryExtractQrCode(payload) {
    const normalizeCandidate = (value) => {
        if (typeof value !== "string")
            return null;
        const raw = value.trim();
        if (!raw)
            return null;
        if (raw.startsWith("data:image"))
            return raw;
        if (raw.startsWith("http://") || raw.startsWith("https://"))
            return raw;
        if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.length >= 100)
            return raw;
        return null;
    };
    const visit = (node, depth = 0) => {
        if (depth > 6 || node == null)
            return null;
        const normalizedDirect = normalizeCandidate(node);
        if (normalizedDirect)
            return normalizedDirect;
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item, depth + 1);
                if (found)
                    return found;
            }
            return null;
        }
        if (typeof node !== "object")
            return null;
        const priorityKeys = [
            "response",
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
                const found = visit(node[key], depth + 1);
                if (found)
                    return found;
            }
        }
        for (const [key, value] of Object.entries(node)) {
            if (!/(qr|qrcode|base64|code|pairing)/i.test(key))
                continue;
            const found = visit(value, depth + 1);
            if (found)
                return found;
        }
        return null;
    };
    return visit(payload);
}
function isIgnorableEvoQrFetchError(status, detail) {
    const text = String(detail || "").toLowerCase();
    if (status === 404 && text.includes("/instance/qrcode/"))
        return true;
    if (status === 404 && text.includes("cannot get /instance/qrcode"))
        return true;
    if (status === 404 && text.includes("cannot post /instance/connect"))
        return true;
    return false;
}
function isEvoConnectEmptyQrDetail(detail) {
    const text = String(detail || "").trim();
    if (!text)
        return false;
    if (/^\s*\{\s*"count"\s*:\s*0\s*\}\s*$/i.test(text))
        return true;
    if (!text.startsWith("{"))
        return false;
    try {
        const parsed = JSON.parse(text);
        if (Number(parsed?.count) !== 0)
            return false;
        const keys = Object.keys(parsed);
        return keys.length <= 2 && keys.every((key) => key === "count" || key === "status");
    }
    catch {
        return /"count"\s*:\s*0/.test(text);
    }
}
function isEvoQrRecoverableFailure(detail, status) {
    if (isEvoConnectEmptyQrDetail(detail))
        return true;
    if (status >= 500 || /integrationSession|prisma/i.test(detail))
        return true;
    return false;
}
function rememberEvoQrFetchError(current, status, detail) {
    const nextDetail = String(detail || "").slice(0, 400);
    if (isIgnorableEvoQrFetchError(status, nextDetail))
        return current;
    if (isEvoConnectEmptyQrDetail(nextDetail)) {
        if (!current.detail || (current.status >= 200 && current.status < 300)) {
            return { status: status || 200, detail: nextDetail };
        }
        return current;
    }
    if (!current.detail)
        return { status, detail: nextDetail };
    if (current.status === 404 && status !== 404)
        return { status, detail: nextDetail };
    if (isEvoConnectEmptyQrDetail(current.detail) && status >= 400) {
        return { status, detail: nextDetail };
    }
    return { status, detail: nextDetail };
}
/** Evolution API v2: QR só via GET /instance/connect/{instance} (?number= opcional). */
function buildEvoConnectQrCandidates(instanceName, number) {
    const enc = encodeURIComponent(instanceName);
    const connectBase = `${EVO_API_BASE}/instance/connect/${enc}`;
    const templateUrl = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
    const bases = Array.from(new Set([connectBase, templateUrl].filter(Boolean)));
    const candidates = [];
    for (const base of bases) {
        candidates.push({ url: base, method: "GET" });
        if (number) {
            candidates.push({
                url: `${base}?number=${encodeURIComponent(number)}`,
                method: "GET",
            });
        }
    }
    return candidates;
}
async function prepareEvoInstanceForQrConnect(instanceName) {
    const enc = encodeURIComponent(String(instanceName || "").trim());
    if (!enc)
        return;
    const steps = [
        { url: `${EVO_API_BASE}/instance/logout/${enc}`, method: "DELETE" },
        { url: `${EVO_API_BASE}/instance/restart/${enc}`, method: "POST" },
    ];
    for (const step of steps) {
        await callEvoAction(step.url, step.method, undefined, {
            timeoutMs: 12000,
            retries: 1,
        });
    }
    await sleepMs(2500);
}
function pickEvoConnectionState(payload) {
    if (!payload || typeof payload !== "object")
        return "";
    const root = payload;
    const inst = root.instance ?? root;
    const raw = inst.state ??
        inst.connectionStatus ??
        inst.status ??
        root.state ??
        root.connectionStatus ??
        "";
    return String(raw || "").trim().toLowerCase();
}
async function fetchEvoInstanceConnectionState(instanceName) {
    const enc = encodeURIComponent(String(instanceName || "").trim());
    if (!enc)
        return { ok: false, state: "", open: false };
    const urls = [
        `${EVO_API_BASE}/instance/connectionState/${enc}`,
        `${EVO_API_BASE}/instance/connection-state/${enc}`,
    ];
    for (const url of urls) {
        const result = await callEvoAction(url, "GET", undefined, {
            timeoutMs: 8000,
            retries: 1,
        });
        if (!result.ok && result.status === 404)
            continue;
        const state = pickEvoConnectionState(result.json);
        if (state) {
            return { ok: true, state, open: state.includes("open") };
        }
    }
    return { ok: false, state: "", open: false };
}
async function resetEvoInstanceForQr(instanceName) {
    const enc = encodeURIComponent(String(instanceName || "").trim());
    if (!enc)
        return;
    await callEvoAction(`${EVO_API_BASE}/instance/logout/${enc}`, "DELETE", undefined, {
        timeoutMs: 12000,
        retries: 1,
    });
    await callEvoAction(`${EVO_API_BASE}/instance/delete/${enc}`, "DELETE", undefined, {
        timeoutMs: 15000,
        retries: 1,
    });
    await sleepMs(2500);
}
const qrRegisterJobs = new Map();
function pruneQrRegisterJobs() {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [id, job] of qrRegisterJobs) {
        if (job.updatedAt < cutoff)
            qrRegisterJobs.delete(id);
    }
}
async function runRegistrarQrcode(input) {
    const name = String(input.name || "").trim();
    const number = String(input.number || "").trim();
    const token = String(input.token || "").trim();
    const ownerEmail = String(input.ownerEmail || "").trim().toLowerCase();
    if (!input.ownershipAlreadyClaimed && (0, waba_auth_service_1.isWabaAuthConfigured)()) {
        if (!ownerEmail.includes("@")) {
            return { ok: false, httpStatus: 401, error: "Faça login para registrar uma instância." };
        }
        const reserve = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.claimOnRegister(name, ownerEmail);
        if (!reserve.ok) {
            return { ok: false, httpStatus: 409, error: reserve.error };
        }
        void ensureAquecedorInstanceRegistered(name);
    }
    const createPayload = {
        instanceName: name,
        name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
    };
    if (number)
        createPayload.number = number;
    const createUrls = [
        EVO_CREATE_INSTANCE_URL,
        `${EVO_API_BASE}/instance/create`,
        `${EVO_API_BASE}/instance/create/${encodeURIComponent(name)}`,
    ].filter(Boolean);
    let createOk = false;
    let lastCreateStatus = 0;
    let lastCreateDetail = "";
    let qrFromCreate = null;
    let instanceWasNew = false;
    for (const createUrl of createUrls) {
        const createResult = await callEvoAction(createUrl, "POST", createPayload, {
            timeoutMs: Math.min((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 30000),
            retries: 2,
        });
        lastCreateStatus = createResult.status;
        lastCreateDetail = String(createResult.body || createResult.error || "").slice(0, 400);
        if (createResult.ok) {
            createOk = true;
            instanceWasNew = true;
            qrFromCreate =
                tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
            if (qrFromCreate)
                break;
            break;
        }
        if (createResult.status === 409) {
            createOk = true;
            qrFromCreate =
                tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
            if (qrFromCreate)
                break;
            break;
        }
    }
    let createWarning = null;
    if (!createOk) {
        createWarning = `Não foi possível salvar/atualizar a instância (status ${lastCreateStatus}). Tentando gerar QRCode da instância existente.`;
    }
    if (qrFromCreate) {
        return {
            ok: true,
            message: createWarning
                ? "QRCode gerado com sucesso para a instância existente."
                : "Dados salvos e QRCode gerado com sucesso.",
            warning: createWarning,
            qrCode: qrFromCreate,
        };
    }
    const shouldPrepareSession = !instanceWasNew || !createOk;
    const qrFetch = await fetchInstanceQrCodeFromEvo(name, number, {
        timeoutMs: Math.max((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 60000),
        retries: 3,
        prepareSession: shouldPrepareSession,
    });
    if (qrFetch.ok) {
        return {
            ok: true,
            message: createWarning
                ? "QRCode gerado com sucesso para a instância existente."
                : "Dados salvos e QRCode gerado com sucesso.",
            warning: createWarning,
            qrCode: qrFetch.qrCode,
            providerResponse: qrFetch.providerResponse,
        };
    }
    if (isEvoQrRecoverableFailure(qrFetch.lastQrDetail, qrFetch.lastQrStatus)) {
        await resetEvoInstanceForQr(name);
        let retryCreateOk = false;
        let retryCreateStatus = 0;
        let retryCreateDetail = "";
        let retryQrFromCreate = null;
        for (const createUrl of createUrls) {
            const createResult = await callEvoAction(createUrl, "POST", createPayload, {
                timeoutMs: Math.min((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 30000),
                retries: 2,
            });
            retryCreateStatus = createResult.status;
            retryCreateDetail = String(createResult.body || createResult.error || "").slice(0, 400);
            if (createResult.ok || createResult.status === 409) {
                retryCreateOk = true;
                retryQrFromCreate =
                    tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
                break;
            }
        }
        if (retryQrFromCreate) {
            return {
                ok: true,
                message: "Instância recriada na Evolution e QRCode gerado com sucesso.",
                warning: createWarning,
                qrCode: retryQrFromCreate,
            };
        }
        if (retryCreateOk) {
            const qrRetry = await fetchInstanceQrCodeFromEvo(name, number, {
                timeoutMs: Math.max((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 90000),
                retries: 4,
                prepareSession: false,
                extended: true,
            });
            if (qrRetry.ok) {
                return {
                    ok: true,
                    message: "Instância recriada na Evolution e QRCode gerado com sucesso.",
                    warning: createWarning,
                    qrCode: qrRetry.qrCode,
                    providerResponse: qrRetry.providerResponse,
                };
            }
            lastCreateStatus = retryCreateStatus || lastCreateStatus;
            lastCreateDetail = qrRetry.lastQrDetail || retryCreateDetail || lastCreateDetail;
            return {
                ok: false,
                httpStatus: 502,
                error: describeEvoQrFailure(lastCreateStatus, qrRetry.lastQrStatus, lastCreateDetail, qrRetry.lastQrDetail),
                detail: qrRetry.lastQrDetail || lastCreateDetail,
                evoCreateStatus: lastCreateStatus,
                evoQrStatus: qrRetry.lastQrStatus,
            };
        }
        lastCreateStatus = retryCreateStatus || lastCreateStatus;
        lastCreateDetail = retryCreateDetail || lastCreateDetail;
    }
    return {
        ok: false,
        httpStatus: 502,
        error: describeEvoQrFailure(lastCreateStatus, qrFetch.lastQrStatus, lastCreateDetail, qrFetch.lastQrDetail),
        detail: qrFetch.lastQrDetail || lastCreateDetail,
        evoCreateStatus: lastCreateStatus,
        evoQrStatus: qrFetch.lastQrStatus,
    };
}
async function fetchInstanceQrCodeFromEvo(instanceName, number = "", options = {}) {
    const timeoutMs = options.timeoutMs ?? (0, evo_http_client_1.defaultEvoHttpTimeoutMs)();
    const retries = options.retries ?? 3;
    if (options.prepareSession !== false) {
        await prepareEvoInstanceForQrConnect(instanceName);
    }
    const connectCandidates = buildEvoConnectQrCandidates(instanceName, number);
    let lastError = { status: 0, detail: "" };
    const fastRoundDelaysMs = [0, 700, 1100, 1600, 2200];
    const slowRoundDelaysMs = options.extended ? [3000, 4500, 6000] : [2800];
    const roundDelaysMs = [...fastRoundDelaysMs, ...slowRoundDelaysMs];
    for (let round = 0; round < roundDelaysMs.length; round += 1) {
        if (round > 0) {
            if (options.extended && round === fastRoundDelaysMs.length) {
                await prepareEvoInstanceForQrConnect(instanceName);
            }
            else {
                await sleepMs(roundDelaysMs[round]);
            }
        }
        for (const candidate of connectCandidates) {
            const result = await callEvoAction(candidate.url, candidate.method, undefined, {
                timeoutMs,
                retries,
            });
            lastError = rememberEvoQrFetchError(lastError, result.status, String(result.body || result.error || ""));
            if (!result.ok)
                continue;
            const qrCode = tryExtractQrCode(result.json) || tryExtractQrCode(result.body);
            if (qrCode) {
                const normalized = qrCode.startsWith("data:image") || qrCode.startsWith("http")
                    ? qrCode
                    : `data:image/png;base64,${qrCode.replace(/\s+/g, "")}`;
                return { ok: true, qrCode: normalized, providerResponse: result.json ?? null };
            }
        }
    }
    return { ok: false, lastQrStatus: lastError.status, lastQrDetail: lastError.detail };
}
app.post("/instancias/:name/atualizar", async (req, res) => {
    try {
        const instanceName = String(req.params.name || "").trim();
        if (!instanceName) {
            return res.status(400).json({ error: "Nome da instância é obrigatório." });
        }
        if (await rejectForeignInstance(req, res, instanceName))
            return;
        const url = buildTemplateUrl(EVO_REFRESH_URL_TEMPLATE, instanceName);
        if (!url) {
            return res.status(501).json({
                error: "Ação atualizar não configurada. Defina EVO_REFRESH_URL_TEMPLATE no backend.",
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
    }
    catch (error) {
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
        if (await rejectForeignInstance(req, res, instanceName))
            return;
        const url = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
        if (!url) {
            return res.status(501).json({
                error: "Ação QRCode não configurada. Defina EVO_QRCODE_URL_TEMPLATE no backend.",
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
    }
    catch (error) {
        console.error("Erro ao solicitar QRCode:", error);
        return res.status(500).json({ error: "Erro ao solicitar QRCode." });
    }
});
app.post("/instancias/registrar-qrcode", async (req, res) => {
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const name = String(req.body?.name || "").trim();
        const rawToken = String(req.body?.token || "").trim();
        const number = String(req.body?.number || "").trim();
        const token = rawToken ||
            crypto_1.default
                .randomUUID()
                .replace(/-/g, "")
                .toUpperCase()
                .replace(/(.{12})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
        if (!name) {
            return res.status(400).json({ error: "Campo 'name' é obrigatório." });
        }
        const ownerEmail = String(auth.email || "").trim().toLowerCase();
        if ((0, waba_auth_service_1.isWabaAuthConfigured)()) {
            if (!ownerEmail.includes("@")) {
                return res.status(401).json({ error: "Faça login para registrar uma instância." });
            }
            const reserve = await waba_instance_ownership_service_1.wabaInstanceOwnershipService.claimOnRegister(name, ownerEmail);
            if (!reserve.ok) {
                return res.status(409).json({ error: reserve.error });
            }
            void ensureAquecedorInstanceRegistered(name);
        }
        try {
            const checkResult = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
                apiKey: EVO_API_KEY,
                timeoutMs: Math.min((0, evo_http_client_1.defaultEvoHttpTimeoutMs)(), 15000),
                retries: 2,
            });
            if (checkResult.ok) {
                const rawInstances = checkResult.json ?? checkResult.body;
                const parsed = typeof rawInstances === "string"
                    ? (() => {
                        try {
                            return JSON.parse(rawInstances);
                        }
                        catch {
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
                const alreadyActive = list.some((item) => {
                    const inst = item?.instance ?? item;
                    const existingName = String(inst?.name ?? inst?.instanceName ?? inst?.instance ?? "").trim();
                    const status = String(inst?.connectionStatus ?? inst?.status ?? "")
                        .toLowerCase()
                        .trim();
                    return existingName.toLowerCase() === name.toLowerCase() && status.includes("open");
                });
                if (alreadyActive) {
                    return res.status(409).json({
                        error: "Já existe uma instância ativa/conectada com este nome. Use outro nome para registrar.",
                    });
                }
            }
        }
        catch {
            /* verificação opcional */
        }
        pruneQrRegisterJobs();
        const jobId = crypto_1.default.randomUUID();
        const now = Date.now();
        qrRegisterJobs.set(jobId, { status: "pending", createdAt: now, updatedAt: now });
        res.status(202).json({
            ok: true,
            accepted: true,
            jobId,
            status: "pending",
        });
        void (async () => {
            try {
                const result = await runRegistrarQrcode({
                    name,
                    token,
                    number,
                    ownerEmail,
                    ownershipAlreadyClaimed: true,
                });
                const updatedAt = Date.now();
                if (result.ok) {
                    qrRegisterJobs.set(jobId, {
                        status: "done",
                        createdAt: now,
                        updatedAt,
                        message: result.message,
                        qrCode: result.qrCode,
                        warning: result.warning ?? null,
                    });
                    return;
                }
                qrRegisterJobs.set(jobId, {
                    status: "error",
                    createdAt: now,
                    updatedAt,
                    error: result.error,
                    detail: result.detail,
                    evoCreateStatus: result.evoCreateStatus,
                    evoQrStatus: result.evoQrStatus,
                });
            }
            catch (error) {
                qrRegisterJobs.set(jobId, {
                    status: "error",
                    createdAt: now,
                    updatedAt: Date.now(),
                    error: "Erro ao gerar QRCode da instância.",
                    detail: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return;
    }
    catch (error) {
        console.error("Erro ao registrar instância e gerar QRCode:", error);
        const detail = error instanceof Error ? error.message : String(error);
        return res.status(500).json({
            error: "Erro ao gerar QRCode da instância.",
            detail,
        });
    }
});
app.get("/instancias/registrar-qrcode/jobs/:jobId", async (req, res) => {
    const jobId = String(req.params.jobId || "").trim();
    if (!jobId) {
        return res.status(400).json({ error: "jobId é obrigatório." });
    }
    const job = qrRegisterJobs.get(jobId);
    if (!job) {
        return res.status(404).json({ error: "Geração de QRCode não encontrada ou expirada." });
    }
    return res.status(200).json({ jobId, ...job });
});
app.delete("/instancias/:name", async (req, res) => {
    try {
        const instanceName = String(req.params.name || "").trim();
        if (!instanceName) {
            return res.status(400).json({ error: "Nome da instância é obrigatório." });
        }
        if (await rejectForeignInstance(req, res, instanceName))
            return;
        if (!buildEvoDeleteCandidateUrls(instanceName).length) {
            return res.status(501).json({
                error: "Ação deletar não configurada. Defina EVO_DELETE_URL_TEMPLATE no backend.",
            });
        }
        const evoResult = await tryDeleteEvoInstance(instanceName);
        await purgeInstanceLocalState(instanceName);
        const message = evoResult.evoDeleted
            ? "Instância deletada com sucesso."
            : evoResult.status === 404
                ? "Instância removida do painel (não encontrada na Evolution)."
                : "Instância removida do painel. Se ainda existir na Evolution, remova manualmente no servidor EVO.";
        return res.json({
            ok: true,
            message,
            degraded: !evoResult.evoDeleted,
            evoStatus: evoResult.status || undefined,
            evoDetail: evoResult.evoDeleted
                ? undefined
                : summarizeEvolutionErrorDetail(evoResult.body, evoResult.status),
        });
    }
    catch (error) {
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
        if (await rejectForeignInstance(req, res, oldName))
            return;
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
                const rawInstances = await checkResponse.json().catch(() => []);
                const list = Array.isArray(rawInstances)
                    ? rawInstances
                    : Array.isArray(rawInstances?.response)
                        ? rawInstances.response
                        : Array.isArray(rawInstances?.data)
                            ? rawInstances.data
                            : [];
                const conflict = list.some((item) => {
                    const inst = item?.instance ?? item;
                    const existingName = String(inst?.name ?? inst?.instanceName ?? inst?.instance ?? "").trim();
                    const status = String(inst?.connectionStatus ?? inst?.status ?? "")
                        .toLowerCase()
                        .trim();
                    return (existingName &&
                        existingName.toLowerCase() === newName.toLowerCase() &&
                        status.includes("open") &&
                        existingName.toLowerCase() !== oldName.toLowerCase());
                });
                if (conflict) {
                    return res.status(409).json({
                        error: "Já existe uma instância ativa/conectada com este nome. Informe outro nome.",
                    });
                }
            }
        }
        catch {
            // Se a verificação externa falhar, não bloqueamos a ação.
        }
        const candidateCalls = [
            {
                url: buildTemplateUrl(EVO_RENAME_URL_TEMPLATE, oldName),
                method: "POST",
                body: { newName, name: newName, instanceName: newName },
            },
            {
                url: `${EVO_API_BASE}/instance/rename`,
                method: "POST",
                body: { instanceName: oldName, newName },
            },
            {
                url: `${EVO_API_BASE}/instance/update/${encodeURIComponent(oldName)}`,
                method: "PUT",
                body: { name: newName, instanceName: newName, newName },
            },
        ].filter((c) => Boolean(c.url));
        let lastStatus = 0;
        for (const candidate of candidateCalls) {
            const result = await callEvoAction(candidate.url, candidate.method, candidate.body);
            lastStatus = result.status;
            if (result.ok) {
                await waba_instance_ownership_service_1.wabaInstanceOwnershipService.renameInstance(oldName, newName);
                return res.json({ ok: true, message: "Nome da instância alterado com sucesso." });
            }
        }
        return res.status(502).json({
            error: "Não foi possível renomear a instância na EVO.",
            status: lastStatus,
        });
    }
    catch (error) {
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
    }
    catch (error) {
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
            message: storageSource === "local"
                ? "Configuração salva localmente (Supabase indisponível)."
                : "Configuração do aquecedor salva com sucesso.",
            useRecommended,
            recommendedConfig: AQUECEDOR_DEFAULTS,
            customConfig,
            effectiveConfig,
            storageSource,
        });
    }
    catch (error) {
        const message = error?.message || "Erro ao validar configuração do aquecedor.";
        return res.status(400).json({ error: message });
    }
});
app.get("/aquecedor/status", async (_req, res) => {
    try {
        await reloadAquecedorPersistedBundleFromDisk();
        const config = await loadAquecedorEffectiveConfig();
        const nowSp = nowInSaoPaulo();
        const windowOpen = isAquecedorWindowOpen(config, nowSp);
        const nextWindowOpenAt = windowOpen ? null : nextAquecedorWindowOpenAt(config, nowSp);
        return res.json({
            ...buildLiveAquecedorStatusPayload(),
            windowOpen,
            nextWindowOpenAt: nextWindowOpenAt ? nextWindowOpenAt.toISOString() : null,
            nextWindowOpenBr: nextWindowOpenAt ? formatDateBr(nextWindowOpenAt.toISOString()) : null,
        });
    }
    catch (error) {
        console.error("[Aquecedor] erro em GET /aquecedor/status:", error);
        return res.json({
            ...buildLiveAquecedorStatusPayload(),
            statusReadError: true,
            statusReadMessage: "Falha ao ler estado persistido; exibindo último snapshot conhecido.",
        });
    }
});
app.get("/aquecedor/envios", async (req, res) => {
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const ownerEmail = auth.email?.trim().toLowerCase() || "";
        const rawLimit = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(rawLimit)
            ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
            : 50;
        const items = [];
        const aliasesMap = await loadInstanceAliasesMap();
        const withAlias = (instanceName) => {
            const key = String(instanceName || "").trim();
            if (!key)
                return "—";
            return aliasesMap.get(key) || key;
        };
        const allowed = await resolveAquecedorEnviosAllowedInstances(ownerEmail);
        const scopedTechnicalNames = isAquecedorGlobalScopeOwner(ownerEmail)
            ? []
            : await listAquecedorScopedInstanceNames(ownerEmail);
        const filterQueueByOwner = scopedTechnicalNames.length > 0;
        const pushItem = (instanciaOrigem, instanciaDestino, dataEnvio, status) => {
            if (!aquecedorEnvioMatchesOwner(instanciaOrigem, instanciaDestino, allowed))
                return;
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
            if (ownerEmail && row.ownerEmail && row.ownerEmail !== ownerEmail)
                continue;
            // Com Supabase, envios concluídos vêm só de logs_envios (evita linha duplicada no painel).
            if (supabase && row.status === "Envio com Sucesso")
                continue;
            pushItem(row.instanciaOrigem, row.instanciaDestino, row.dataEnvio, row.status);
        }
        let pendingCount = 0;
        if (supabase) {
            const numToInst = await buildControleInstanciaNumToNameMap(supabase);
            const processandoQuery = filterQueueByOwner
                ? supabase
                    .from("aquecedor")
                    .select("instancia, numero_destino, scheduled_at, processing_at")
                    .eq("status", "PROCESSANDO")
                    .in("instancia", scopedTechnicalNames)
                    .order("processing_at", { ascending: false })
                    .limit(5)
                : supabase
                    .from("aquecedor")
                    .select("instancia, numero_destino, scheduled_at, processing_at")
                    .eq("status", "PROCESSANDO")
                    .order("processing_at", { ascending: false })
                    .limit(5);
            const { data: processandoData } = (await processandoQuery);
            if (Array.isArray(processandoData) && processandoData.length > 0) {
                for (const row of processandoData) {
                    const origem = String(row?.instancia || "").trim() || "—";
                    const numDest = resolveAquecedorInstanceDigits(String(row?.numero_destino || "").trim());
                    const destino = numToInst.get(numDest) || String(row?.numero_destino || "").trim() || "—";
                    const dataEnvio = String(row?.scheduled_at || row?.processing_at || "").trim() || null;
                    pushItem(origem, destino, dataEnvio, "Em Fila");
                }
            }
            const pendingCountQuery = filterQueueByOwner
                ? supabase
                    .from("aquecedor")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "PENDENTE")
                    .in("instancia", scopedTechnicalNames)
                : supabase
                    .from("aquecedor")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "PENDENTE");
            const { count: pendingTotal } = (await pendingCountQuery);
            pendingCount = typeof pendingTotal === "number" ? pendingTotal : 0;
            const pendingDataQuery = filterQueueByOwner
                ? supabase
                    .from("aquecedor")
                    .select("scheduled_at, instancia, numero_destino")
                    .eq("status", "PENDENTE")
                    .in("instancia", scopedTechnicalNames)
                    .order("scheduled_at", { ascending: true })
                    .limit(1)
                    .maybeSingle()
                : supabase
                    .from("aquecedor")
                    .select("scheduled_at, instancia, numero_destino")
                    .eq("status", "PENDENTE")
                    .order("scheduled_at", { ascending: true })
                    .limit(1)
                    .maybeSingle();
            const { data: pendingData } = (await pendingDataQuery);
            if (pendingData) {
                let origem = String(pendingData?.instancia || "").trim();
                let destino = "—";
                const dataEnvio = String(pendingData?.scheduled_at || "").trim() || null;
                const numDest = normalizeWhatsAppNumber(String(pendingData?.numero_destino || "").trim());
                if (numDest) {
                    destino = numToInst.get(numDest) || "—";
                }
                if (!origem || destino === "—") {
                    const resolvedConnected = await resolveAquecedorConnectedForOwner(ownerEmail);
                    const connected = await (0, aquecedor_instance_lifecycle_service_1.filterAquecedorCycleConnected)(resolvedConnected.connected);
                    if (connected.length >= 2) {
                        const combinations = connected.flatMap((origemItem) => connected
                            .filter((destinoItem) => destinoItem.instancia !== origemItem.instancia)
                            .map((destinoItem) => ({
                            instancia_origem: origemItem.instancia,
                            instancia_destino: destinoItem.instancia,
                            numero_whatsapp: destinoItem.numero,
                        })));
                        const { data: cicloData } = await (supabase
                            .from("controle_ciclo")
                            .select("ciclo_global")
                            .order("id", { ascending: true })
                            .limit(1)
                            .maybeSingle());
                        const cicloGlobal = typeof cicloData?.ciclo_global === "number"
                            ? Math.floor(cicloData.ciclo_global)
                            : 0;
                        const picked = await pickAquecedorCombinationAsync(supabase, connected, combinations, cicloGlobal);
                        if (picked) {
                            origem = picked.chosen.instancia_origem;
                            destino = picked.chosen.instancia_destino;
                        }
                    }
                }
                pushItem(origem || "—", destino, dataEnvio, "Em Fila");
            }
            const { data: logsData, error } = await (supabase
                .from("logs_envios_br")
                .select("instancia_origem, instancia_destino, data_envio_br")
                .order("data_envio_br", { ascending: false })
                .limit(limit));
            if (!error && Array.isArray(logsData)) {
                for (const row of logsData) {
                    const dataEnvio = String(row?.data_envio_br || row?.data_envio || "").trim() || null;
                    pushItem(String(row?.instancia_origem || "").trim() || "—", String(row?.instancia_destino || "").trim() || "—", dataEnvio, "Envio com Sucesso");
                }
            }
        }
        const dedup = new Map();
        for (const item of items) {
            const key = buildAquecedorEnvioDedupKey(item);
            if (!dedup.has(key))
                dedup.set(key, item);
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
    }
    catch (error) {
        console.error("Erro inesperado ao listar envios do aquecedor:", error);
        return res.status(500).json({ error: "Erro ao listar envios do aquecedor." });
    }
});
app.get("/aquecedor/command-logs", async (req, res) => {
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const ownerEmail = auth.email?.trim().toLowerCase() || "";
        const rawLimit = Number(req.query.limit ?? 30);
        const limit = Number.isFinite(rawLimit)
            ? Math.max(1, Math.min(120, Math.floor(rawLimit)))
            : 30;
        const globalScope = isAquecedorGlobalScopeOwner(ownerEmail);
        const items = (await readAquecedorCommandLog()).filter((row) => {
            if (globalScope)
                return true;
            const rowOwner = String(row.ownerEmail || "").trim().toLowerCase();
            return !rowOwner || rowOwner === ownerEmail;
        });
        return res.json({ items: items.slice(0, limit) });
    }
    catch (error) {
        console.error("Erro inesperado ao listar logs de comando do aquecedor:", error);
        return res.status(500).json({ error: "Erro ao listar logs de comando." });
    }
});
app.post("/aquecedor/command-logs", async (req, res) => {
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const message = String(req.body?.message ?? "").trim();
        if (!message) {
            return res.status(400).json({ error: "Informe a mensagem do log." });
        }
        await appendAquecedorCommandLog(message, auth.email);
        return res.status(201).json({ ok: true });
    }
    catch (error) {
        console.error("Erro inesperado ao gravar log de comando do aquecedor:", error);
        return res.status(500).json({ error: "Erro ao gravar log de comando." });
    }
});
app.post("/aquecedor/start", async (req, res) => {
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    if (!ENABLE_AQUECEDOR_PROCESSING) {
        return res.status(409).json({
            ok: false,
            message: "Aquecedor desativado neste processo. Defina ENABLE_AQUECEDOR_PROCESSING=true ou use o runtime de produção.",
            status: aquecedorRuntime,
            runtime: {
                mode: RUNTIME_MODE,
                backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
                aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
            },
        });
    }
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    aquecedorRuntimeOwnerEmail = auth.email?.trim().toLowerCase() || null;
    if (!aquecedorRuntimeOwnerEmail) {
        return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
    }
    await persistAquecedorRuntimeIntent(true, aquecedorRuntimeOwnerEmail);
    startAquecedorRuntimeLocal();
    void ensureAquecedorPendingMessage();
    aquecedorRuntime.lastResult = "Aquecedor iniciado.";
    void appendAquecedorCommandLog("Aquecedor iniciado.", aquecedorRuntimeOwnerEmail);
    return res.json({
        ok: true,
        message: "Aquecedor iniciado.",
        status: {
            ...buildLiveAquecedorStatusPayload(),
            running: true,
            desiredRunning: true,
            lastResult: aquecedorRuntime.lastResult,
        },
        desiredRunning: true,
    });
});
app.post("/aquecedor/stop", async (_req, res) => {
    stopAquecedorRuntime();
    aquecedorRuntime.lastResult = "Aquecedor parado.";
    const stopOwner = aquecedorRuntimeOwnerEmail;
    await persistAquecedorRuntimeIntent(false, null);
    void appendAquecedorCommandLog("Aquecedor parado.", stopOwner);
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
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    if (!ENABLE_AQUECEDOR_PROCESSING) {
        return res.status(409).json({
            ok: false,
            error: "Aquecedor desativado neste processo. Defina ENABLE_AQUECEDOR_PROCESSING=true ou use o runtime de produção.",
            status: aquecedorRuntime,
            runtime: {
                mode: RUNTIME_MODE,
                backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
                aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
            },
        });
    }
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    aquecedorRuntimeOwnerEmail = auth.email?.trim().toLowerCase() || null;
    if (!aquecedorRuntimeOwnerEmail) {
        return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
    }
    await runAquecedorCycle(true); // bypass janela e cooldown para teste entre 2 instâncias
    stopAquecedorRuntimeLocal();
    void persistAquecedorRuntimeIntent(false, null);
    const status = buildLiveAquecedorStatusPayload();
    const lastResult = String(aquecedorRuntime.lastResult || "").trim();
    const ok = /enviado com sucesso|realizado/i.test(lastResult);
    void appendAquecedorCommandLog(lastResult ? `Envio teste: ${lastResult}` : "Envio teste executado.", aquecedorRuntimeOwnerEmail);
    return res.json({
        ok,
        message: lastResult || "Ciclo de teste executado.",
        status: {
            ...status,
            running: false,
            desiredRunning: false,
            isProcessing: false,
            lastResult: lastResult || status.lastResult,
        },
    });
});
app.post("/aquecedor/criar-mensagem-teste", async (req, res) => {
    if (rejectAquecedorWithoutEntitlement(req, res))
        return;
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
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
        const { data, error } = await supabase.from("aquecedor")
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
            status: "Em Fila",
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
    }
    catch (error) {
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
            .from("aquecedor")
            .select("id, status, scheduled_at, instancia, numero_destino")
            .eq("status", "PENDENTE")
            .order("scheduled_at", { ascending: true })
            .limit(10));
        const { data: processando } = await (supabase
            .from("aquecedor")
            .select("id, status, scheduled_at, processing_at, instancia, numero_destino")
            .eq("status", "PROCESSANDO")
            .order("processing_at", { ascending: false })
            .limit(10));
        const processandoComMinutos = (processando || []).map((r) => {
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
    }
    catch (error) {
        console.error("Erro ao localizar fila:", error);
        return res.status(500).json({ error: "Erro ao localizar fila." });
    }
});
app.get("/aquecedor/diagnostico", async (req, res) => {
    await reloadAquecedorPersistedBundleFromDisk();
    const persistedStatus = buildAquecedorStatusPayload();
    const diag = {
        runtime: {
            ...aquecedorRuntime,
            ...persistedStatus,
            localRunning: aquecedorRuntime.running,
            persistedRunning: persistedStatus.running,
        },
        evo: { ok: false, connectedCount: 0, instances: [] },
        supabase: { ok: false, pendingCount: 0, messageBankCount: 0 },
        janela: { aberta: false, motivo: "" },
        proximaCombinacao: null,
        cicloGlobal: null,
    };
    let timeoutId = null;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(EVO_INSTANCES_URL, {
            headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
            signal: controller.signal,
        });
        if (timeoutId)
            clearTimeout(timeoutId);
        timeoutId = null;
        if (response.ok) {
            const instances = (await response.json().catch(() => [])) || [];
            const connectedAll = await filterConnectedInstanciasForRequest(req, buildConnectedFromEvoResponse(instances));
            const usageMap = await loadInstanceUsageMap();
            const connected = connectedAll.filter((item) => {
                const usage = getInstanceUsageFromMap(usageMap, item.instancia);
                return usage ? usage.useAquecedor !== false : true;
            });
            diag.evo.ok = true;
            diag.evo.connectedCount = connected.length;
            diag.evo.instances = connected.map((c) => c.instancia);
            if (connected.length >= 2) {
                const combinations = [];
                for (const origem of connected) {
                    for (const destino of connected) {
                        if (origem.instancia === destino.instancia)
                            continue;
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
                            .from("aquecedor")
                            .select("id", { count: "exact", head: true })
                            .eq("status", "PENDENTE")
                            .lte("scheduled_at", new Date().toISOString()));
                        diag.supabase.ok = true;
                        diag.supabase.pendingCount = typeof count === "number" ? count : 0;
                        const messageBank = await loadAquecedorMessageBank(supabase);
                        diag.supabase.messageBankCount = messageBank.length;
                        const { data: cicloData } = await (supabase
                            .from("controle_ciclo")
                            .select("ciclo_global")
                            .order("id", { ascending: true })
                            .limit(1)
                            .maybeSingle());
                        const cicloGlobal = typeof cicloData?.ciclo_global === "number"
                            ? Math.floor(cicloData.ciclo_global)
                            : 0;
                        diag.cicloGlobal = cicloGlobal;
                        if (combinations.length) {
                            const comboRows = combinations.map((combo) => ({
                                instancia_origem: combo.origem,
                                instancia_destino: combo.destino,
                                numero_whatsapp: combo.numero_whatsapp,
                            }));
                            const picked = await withAquecedorTimeout(pickAquecedorCombinationAsync(supabase, connected, comboRows, cicloGlobal), 4000, null);
                            if (picked) {
                                diag.proximaCombinacao = {
                                    origem: picked.chosen.instancia_origem,
                                    destino: picked.chosen.instancia_destino,
                                };
                            }
                            else {
                                diag.proximaCombinacao = null;
                                diag.turnoBloqueado = true;
                            }
                        }
                    }
                    catch (supErr) {
                        diag.supabase.mensagem = supErr?.message || "Erro ao consultar Supabase.";
                    }
                }
                else {
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
            }
            catch (cfgErr) {
                diag.janela.motivo = cfgErr?.message || "Erro ao carregar janela.";
            }
        }
        else {
            diag.evo.mensagem = `EVO retornou status ${response.status}.`;
        }
    }
    catch (e) {
        if (timeoutId)
            clearTimeout(timeoutId);
        diag.evo.mensagem = e?.message || "Erro ao conectar na EVO (timeout ou rede).";
    }
    if (!diag.supabase.ok && getSupabaseClient()) {
        try {
            const supabase = getSupabaseClient();
            if (supabase) {
                const { count } = await (supabase
                    .from("aquecedor")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "PENDENTE")
                    .lte("scheduled_at", new Date().toISOString()));
                diag.supabase.ok = true;
                diag.supabase.pendingCount = typeof count === "number" ? count : 0;
            }
        }
        catch (_) {
            if (!diag.supabase.mensagem)
                diag.supabase.mensagem = "Erro ao consultar fila.";
        }
    }
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const motorOwner = aquecedorRuntimeOwnerEmail || auth.email?.trim().toLowerCase() || null;
        const instAnalysis = await analyzeAquecedorInstances(motorOwner);
        diag.instancias = instAnalysis;
        if (instAnalysis.eligible.length) {
            diag.evo.instances = instAnalysis.eligible.map((row) => row.instancia);
            diag.evo.connectedCount = instAnalysis.eligible.length;
        }
    }
    catch (instErr) {
        diag.instancias = {
            erro: instErr?.message || "Erro ao analisar instâncias do aquecedor.",
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
        let response;
        try {
            response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
        }
        finally {
            clearTimeout(timeoutId);
        }
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
            json = null;
        }
        if (!response.ok) {
            const detail = String(json?.error?.message || json?.error_description || text || "").slice(0, 280);
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
    }
    catch (error) {
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
        const scopes = String(req.body?.scopes ||
            "business_management,whatsapp_business_management,whatsapp_business_messaging").trim();
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
                error: "Campo 'adminAccessToken' é obrigatório (token de admin BM ou token temporário com permissão na BM).",
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
        let response;
        try {
            response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form.toString(),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
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
    }
    catch (error) {
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
async function metaEmbeddedSignupExchangeCodeHandler(req, res) {
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
        const tryExchange = async (redirectUri) => {
            const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_VERSION}/oauth/access_token`);
            url.searchParams.set("client_id", appId);
            url.searchParams.set("client_secret", appSecret);
            url.searchParams.set("code", code);
            if (redirectUri) {
                url.searchParams.set("redirect_uri", redirectUri);
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            let response;
            try {
                response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
            }
            finally {
                clearTimeout(timeoutId);
            }
            const text = await response.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                json = null;
            }
            return { response, text, json };
        };
        // Prioriza redirect_uri fixo do ambiente para bater 1:1 com o OAuth dialog.
        const uniqueRedirects = Array.from(new Set([redirectFromEnv, redirectFromBody].filter((u) => Boolean(String(u || "").trim()))));
        const candidates = [...uniqueRedirects, undefined];
        let last = null;
        for (const redirectUri of candidates) {
            last = await tryExchange(redirectUri);
            if (last.response.ok)
                break;
            const msg = String(last.json?.error?.message || last.json?.error_description || last.text || "").toLowerCase();
            const retryWithoutRedirect = redirectUri &&
                (msg.includes("redirect_uri") ||
                    msg.includes("redirect uri") ||
                    msg.includes("matching") ||
                    msg.includes("doesn't match"));
            if (retryWithoutRedirect) {
                last = await tryExchange(undefined);
                if (last.response.ok)
                    break;
            }
        }
        if (!last) {
            return res.status(500).json({ error: "Falha interna ao consultar a Meta." });
        }
        const { response, text, json } = last;
        if (!response.ok) {
            const detail = String(json?.error?.message || json?.error_description || text || "").slice(0, 500);
            const upstreamStatus = Number(response.status) || 500;
            // EasyPanel mascara 502 com página HTML; preferimos manter JSON para erro da Meta.
            const clientStatus = upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 424;
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
    }
    catch (error) {
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
        const subscribedFields = String(req.body?.subscribedFields || "messages,message_status,messaging_postbacks").trim();
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' é obrigatório." });
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao inscrever webhooks." });
    }
});
app.post("/meta-oficial/ativos/phone-numbers/list", async (req, res) => {
    try {
        const token = String(req.body?.token || "").trim();
        const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao listar números da API Meta." });
    }
});
app.post("/meta-oficial/ativos/phone-numbers/register", async (req, res) => {
    try {
        const token = String(req.body?.token || "").trim();
        const phoneNumberId = sanitizeMetaId(req.body?.phoneNumberId);
        const pin = String(req.body?.pin || "").trim();
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!phoneNumberId)
            return res.status(400).json({ error: "Campo 'phoneNumberId' é obrigatório." });
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao registrar número na API Meta." });
    }
});
app.post("/meta-oficial/ativos/subscribed-apps/list", async (req, res) => {
    try {
        const token = String(req.body?.token || "").trim();
        const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao consultar apps inscritos." });
    }
});
app.post("/meta-oficial/ativos/subscribed-apps/ensure", async (req, res) => {
    try {
        const token = String(req.body?.token || "").trim();
        const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
        const subscribedFields = String(req.body?.subscribedFields || "messages,message_status,messaging_postbacks").trim();
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao inscrever app na API Meta." });
    }
});
app.post("/meta-oficial/templates/list", async (req, res) => {
    try {
        const token = String(req.body?.token || "").trim();
        const wabaId = sanitizeMetaId(req.body?.wabaId || req.body?.id_bm);
        const limit = Math.max(1, Math.min(200, Number(req.body?.limit || 30)));
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
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
    }
    catch (error) {
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
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!wabaId)
            return res.status(400).json({ error: "Campo 'wabaId' (ou 'id_bm') é obrigatório." });
        if (!name)
            return res.status(400).json({ error: "Campo 'name' é obrigatório." });
        if (!bodyText)
            return res.status(400).json({ error: "Campo 'bodyText' é obrigatório." });
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
    }
    catch (error) {
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
            .map((v) => String(v ?? "").trim())
            .filter((v) => v.length > 0)
            .slice(0, 20);
        if (!token)
            return res.status(400).json({ error: "Campo 'token' é obrigatório." });
        if (!phoneNumberId)
            return res.status(400).json({ error: "Campo 'phoneNumberId' é obrigatório." });
        if (!to)
            return res.status(400).json({ error: "Campo 'to' é obrigatório." });
        if (!templateName)
            return res.status(400).json({ error: "Campo 'templateName' é obrigatório." });
        const payload = {
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
                    parameters: bodyParams.map((text) => ({ type: "text", text })),
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao disparar template." });
    }
});
app.get("/disparos/config", async (req, res) => {
    try {
        const config = await loadDisparosConfigFromDb();
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const selectedDisparadorInstances = await filterDisparadorInstancesReadyForAuth(auth, Array.isArray(config.selectedDisparadorInstances) ? config.selectedDisparadorInstances : []);
        const autoProviders = getAutoShortenerProviderOrder();
        const currentShortenerProvider = autoProviders[0];
        return res.json({
            config: { ...config, selectedDisparadorInstances },
            shortenerAuto: true,
            currentShortenerProvider,
            alternativaDispatch: auth.email && (await shouldApplyAlternativaDispatchProfile(auth.email))
                ? {
                    active: true,
                    rules: (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)(),
                    throttle: (0, alternativa_dispatch_rules_1.computeAlternativaThrottle)({
                        startHour: config.startHour,
                        endHour: config.endHour,
                    }),
                }
                : { active: false, rules: (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)() },
            shortenerProviders: [
                { id: "waba", label: "WABA (encurtador próprio)", auth: "interno" },
                { id: "encurtadorpro", label: "EncurtadorPro", auth: "requer API key (Bearer)" },
            ],
        });
    }
    catch {
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
            if (validationError)
                return res.status(400).json({ error: validationError });
        }
        let config = parseDisparosConfig(mergedConfig);
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        if (auth.email && (await shouldApplyAlternativaDispatchProfile(auth.email))) {
            config = applyAlternativaDispatchProfile(config);
        }
        config = {
            ...config,
            selectedDisparadorInstances: await filterDisparadorInstancesReadyForAuth(auth, config.selectedDisparadorInstances),
        };
        await saveDisparosConfigToDb(config);
        return res.json({ ok: true, message: "Configuração do Disparador salva.", config });
    }
    catch (error) {
        return res.status(400).json({ error: error?.message || "Configuração inválida." });
    }
});
app.get("/disparos/alternativa/estimate", async (req, res) => {
    try {
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar a projeção." });
        }
        const plannedSendCount = Math.floor(Number(req.query.plannedSendCount) || 0);
        const summary = await alternativaNumbersService.getSummaryAsync(auth.email);
        const config = await loadDisparosConfigFromDb();
        const workingDaysPerWeek = Array.isArray(config.workingDays) ? config.workingDays.length : 5;
        const selectedCount = Array.isArray(config.selectedDisparadorInstances)
            ? config.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean).length
            : 0;
        const instanceCount = Math.max(summary.activatedCount, selectedCount);
        const estimate = (0, alternativa_dispatch_rules_1.estimateAlternativaCampaignDuration)({
            plannedSendCount,
            activatedInstanceCount: instanceCount,
            workingDaysPerWeek,
            startHour: config.startHour,
            endHour: config.endHour,
            workingDayKeys: Array.isArray(config.workingDays) ? config.workingDays : undefined,
        });
        return res.json({
            ...estimate,
            dispatchRules: (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)(),
            canSend: summary.canSend,
            activatedCount: summary.activatedCount,
        });
    }
    catch (error) {
        return res.status(400).json({ error: error?.message || "Erro ao estimar duração da campanha." });
    }
});
app.get("/disparos/messenger-products", async (_req, res) => {
    try {
        const items = await runMessengerProductsLocked(() => loadMessengerProductsFromFile());
        const sorted = [...items].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR", { sensitivity: "base" }));
        return res.json({ items: sorted });
    }
    catch {
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
            const idx = items.findIndex((row) => row.displayName.toLowerCase() === key);
            const next = idx >= 0
                ? { ...incoming, id: items[idx].id, updatedAt: incoming.updatedAt }
                : incoming;
            const merged = idx >= 0
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
    }
    catch {
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
        const janelaPrevisaoGlobal = !janelaBase.aberta
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
        const whatsappAlvoMascarado = wapp.length >= 4 ? `…${wapp.slice(-4)}` : wapp.length > 0 ? "definido" : "não definido";
        const responseUrlRaw = normalizeDisparosResponseUrl(String(fullConfig.responseUrl || ""));
        const responseUrlMascarada = responseUrlRaw
            ? (() => {
                try {
                    const u = new URL(responseUrlRaw);
                    return `${u.protocol}//${u.host}/…`;
                }
                catch {
                    return "definida";
                }
            })()
            : "não definida";
        const diag = {
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
                linkDestinationMode: fullConfig.linkDestinationMode,
                whatsappAlvoMascarado,
                responseUrlMascarada,
            },
            evo: {
                ok: false,
                eligibleCount: 0,
                instances: [],
                semSelecaoNaUi: false,
                mensagem: "",
            },
            campanhas: {
                totalNaMemoria: disparosCampaignsMemory.length,
                emExecucao: [],
            },
            templatesAtivosNaMemoria: disparosTemplatesMemory.filter((t) => t.active !== false)
                .length,
        };
        let timeoutId = null;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(EVO_INSTANCES_URL, {
                headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
                signal: controller.signal,
            });
            if (timeoutId)
                clearTimeout(timeoutId);
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
                const connected = await filterConnectedInstanciasForRequest(req, buildConnectedFromEvoResponse(list));
                const usageMap = await loadInstanceUsageMap();
                const selectedSet = new Set(Array.isArray(fullConfig.selectedDisparadorInstances)
                    ? fullConfig.selectedDisparadorInstances
                        .map((n) => String(n || "").trim())
                        .filter(Boolean)
                    : []);
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
            }
            else {
                diag.evo.mensagem = `EVO HTTP ${response.status}`;
            }
        }
        catch (e) {
            if (timeoutId)
                clearTimeout(timeoutId);
            diag.evo.mensagem =
                e?.message || "Falha ao consultar instâncias na EVO.";
        }
        for (const c of disparosCampaignsMemory) {
            if (c.status !== "running")
                continue;
            const leads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === c.id);
            const pending = leads.filter((l) => l.status === "pending").length;
            const failed = leads.filter((l) => l.status === "failed").length;
            const nextMs = campaignNextAllowedSendAt.get(c.id) || 0;
            const nowMs = Date.now();
            const snap = c.configSnapshot || DISPAROS_DEFAULTS;
            const janelaCampanha = isDisparosWindowOpen(snap, nowSp);
            const previsaoCampanhaBr = !janelaCampanha.aberta
                ? (() => {
                    const n = findNextDisparosWindowStart(snap, nowSp);
                    return n ? formatDateBr(n.toISOString()) : null;
                })()
                : null;
            let proximoEnvio;
            if (!janelaCampanha.aberta) {
                proximoEnvio = previsaoCampanhaBr
                    ? `ciclo em execução · fora do expediente (normal) · retorno previsto ~ ${previsaoCampanhaBr} · ${janelaCampanha.motivo}`
                    : `fora do expediente · ${janelaCampanha.motivo}`;
            }
            else if (nextMs > nowMs) {
                const remainingSeconds = Math.max(1, Math.ceil((nextMs - nowMs) / 1000));
                proximoEnvio = `ciclo em execução · dentro do expediente · intervalo operacional (normal) · próximo envio em ~${remainingSeconds}s (${formatDateBr(new Date(nextMs).toISOString())})`;
            }
            else {
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
    }
    catch (error) {
        console.error("Erro em /disparos/diagnostico:", error);
        return res.status(500).json({ error: "Erro ao montar diagnóstico do Disparador." });
    }
});
app.post("/disparos/shorten", async (req, res) => {
    try {
        const longUrl = String(req.body?.longUrl || "").trim();
        const domain = ""; // domínio custom removido da UI por simplicidade operacional
        const publicBaseHints = (0, waba_public_base_url_1.publicBaseHintsFromExpressRequest)(req);
        if (!/^https?:\/\//i.test(longUrl)) {
            return res.status(400).json({ error: "longUrl deve ser uma URL válida." });
        }
        let shortUrl = "";
        let finalLongUrl = longUrl;
        let providerUsed = null;
        const maxAttempts = 5;
        const providers = getAutoShortenerProviderOrder();
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const candidateUrl = attempt === 1 ? longUrl : appendAntiRepeatParam(longUrl, attempt);
            for (const provider of providers) {
                try {
                    const candidateShort = await shortenUrlWithProvider(candidateUrl, provider, domain, publicBaseHints);
                    shortUrl = candidateShort;
                    finalLongUrl = candidateUrl;
                    providerUsed = provider;
                    break;
                }
                catch {
                    // tenta próximo provedor
                }
            }
            if (shortUrl)
                break;
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
    }
    catch (error) {
        return res.status(502).json({ error: error?.message || "Falha ao encurtar URL." });
    }
});
app.post("/disparos/gerar-mensagem-ai", async (req, res) => {
    try {
        const config = await loadDisparosConfigFromDb();
        const publicBaseHints = (0, waba_public_base_url_1.publicBaseHintsFromExpressRequest)(req);
        const customBriefing = String(req.body?.briefing || "").trim();
        const briefing = customBriefing || String(config.aiBriefing || "").trim();
        const tone = String(req.body?.tone || config.aiTone || "consultivo").trim();
        const audience = String(req.body?.audience || config.aiAudience || "CORBAN").trim();
        const cta = String(req.body?.cta || config.aiCta || "Responda no link abaixo").trim();
        const objective = String(req.body?.objective || "gerar mensagem de prospeccao").trim();
        const linkMode = String(req.body?.linkDestinationMode || config.linkDestinationMode || "whatsapp").toLowerCase() ===
            "url"
            ? "url"
            : "whatsapp";
        const previewConfig = {
            ...config,
            linkDestinationMode: linkMode,
            whatsappTargetNumber: normalizeWhatsAppNumber(String(req.body?.whatsappTargetNumber || config.whatsappTargetNumber || "")),
            responseUrl: normalizeDisparosResponseUrl(String(req.body?.responseUrl || config.responseUrl || "")),
        };
        const linkDestinationError = validateDisparosLinkDestination(previewConfig);
        if (linkDestinationError) {
            return res.status(400).json({
                error: linkMode === "url"
                    ? "URL de resposta não configurada na seção Encurtador de URL."
                    : "Número alvo não configurado na seção Encurtador de URL.",
            });
        }
        let shortUrl = "";
        let shortenerProvider = "";
        let shortenerWarning = "";
        try {
            const shortened = await generateUniqueShortUrlForDisparosConfig(previewConfig, publicBaseHints);
            shortUrl = shortened.shortUrl;
            shortenerProvider = String(config.shortenerProvider || "");
        }
        catch (shortErr) {
            console.warn("[gerar-mensagem-ai] encurtador indisponível, usando URL longa:", shortErr?.message || shortErr);
            try {
                const nonce = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                shortUrl = buildDisparosDestinationLongUrl(previewConfig, nonce);
            }
            catch {
                return res.status(400).json({
                    error: "Destino do link não configurado na seção Encurtador de URL.",
                });
            }
            shortenerWarning =
                "Link não encurtado (encurtador indisponível). Verifique WABA_PUBLIC_BASE_URL no servidor.";
        }
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
            ...(shortenerWarning ? { shortenerWarning } : {}),
        });
    }
    catch (error) {
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
        const sendBody = EVO_SEND_TEXT_V1
            ? { number: targetNumber, textMessage: { text: generated.text } }
            : { number: targetNumber, text: generated.text, textMessage: { text: generated.text } };
        const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
        if (!sendResult.ok) {
            const detail = sendResult.json?.message ||
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
    }
    catch (error) {
        return res.status(502).json({ error: error?.message || "Erro ao executar teste de mensagem AI." });
    }
});
app.get("/disparos/next-instance", async (req, res) => {
    try {
        const previewOnly = String(req.query.preview || "").toLowerCase() === "1" ||
            String(req.query.preview || "").toLowerCase() === "true";
        const parseInstancesQueryParam = () => {
            const raw = req.query.instances;
            if (raw === undefined)
                return null;
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
        const connected = await filterConnectedInstanciasForRequest(req, buildConnectedFromEvoResponse(list));
        const usageMap = await loadInstanceUsageMap();
        const fromQuery = parseInstancesQueryParam();
        const disparosConfig = await loadDisparosConfigFromDb();
        const dbSelected = Array.isArray(disparosConfig.selectedDisparadorInstances)
            ? disparosConfig.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
            : [];
        let selectedSet;
        let hasSelection;
        if (fromQuery !== null) {
            selectedSet = new Set(fromQuery);
            hasSelection = selectedSet.size > 0;
        }
        else {
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
            note: "Quando a instância atual desconectar/bloquear, o próximo ciclo deve usar a próxima conectada.",
        });
    }
    catch {
        return res.status(500).json({ error: "Erro ao selecionar próxima instância do Disparador." });
    }
});
app.get("/disparos/templates", async (_req, res) => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data } = await (supabase
                    .from("disparos_message_templates")
                    .select("id, message_text, alias, segment, source, created_at, active")
                    .eq("active", true)
                    .order("created_at", { ascending: false })
                    .limit(200));
                if (Array.isArray(data)) {
                    const items = data.map((row) => ({
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
            }
            catch {
                // fallback em memória
            }
        }
        return res.json({ items: disparosTemplatesMemory.slice(0, 200) });
    }
    catch {
        return res.status(500).json({ error: "Erro ao listar templates de mensagem." });
    }
});
app.post("/disparos/templates/import", async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const mapped = rows
            .map((row) => ({
            id: crypto_1.default.randomUUID(),
            text: String(row?.text || "").trim(),
            alias: String(row?.alias || "").trim(),
            segment: String(row?.segment || "").trim(),
            source: "spreadsheet",
            createdAt: new Date().toISOString(),
            active: true,
        }))
            .filter((row) => row.text.length > 0);
        if (!mapped.length) {
            return res.status(400).json({ error: "Nenhuma mensagem válida encontrada para importar." });
        }
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const payload = mapped.map((row) => ({
                    id: row.id,
                    message_text: row.text,
                    alias: row.alias,
                    segment: row.segment,
                    source: row.source,
                    created_at: row.createdAt,
                    active: row.active,
                }));
                await supabase.from("disparos_message_templates").insert(payload);
            }
            catch {
                disparosTemplatesMemory.unshift(...mapped);
            }
        }
        else {
            disparosTemplatesMemory.unshift(...mapped);
        }
        return res.json({
            ok: true,
            imported: mapped.length,
            message: `${mapped.length} mensagem(ns) importada(s) com sucesso.`,
        });
    }
    catch {
        return res.status(500).json({ error: "Erro ao importar templates de mensagem." });
    }
});
async function hydrateCampaignFromDbIfNeeded(campaignId, options = {}) {
    const existing = disparosCampaignsMemory.find((c) => c.id === campaignId);
    const supabase = getSupabaseClient();
    if (!supabase)
        return existing || null;
    try {
        const { data: row, error: rowErr } = await (supabase
            .from("disparos_campaigns")
            .select("id, campaign_name, status, total_numbers, sent_count, created_at")
            .eq("id", campaignId)
            .maybeSingle());
        if (rowErr) {
            console.error("[Campanha] hydrate linha:", campaignId, rowErr.message || rowErr);
            return existing || null;
        }
        let configSnapshot = existing?.configSnapshot ?? { ...DISPAROS_DEFAULTS };
        try {
            const { data: cfgRow, error: cfgErr } = await (supabase
                .from("disparos_campaigns")
                .select("config_snapshot")
                .eq("id", campaignId)
                .maybeSingle());
            if (!cfgErr && cfgRow?.config_snapshot != null) {
                try {
                    const rawCfg = typeof cfgRow.config_snapshot === "string"
                        ? JSON.parse(cfgRow.config_snapshot)
                        : cfgRow.config_snapshot;
                    configSnapshot = parseDisparosConfig(rawCfg);
                }
                catch {
                    /* mantém configSnapshot acima */
                }
            }
        }
        catch {
            /* coluna ausente */
        }
        let leadRows = [];
        try {
            let lr = null;
            const withMessage = await (supabase
                .from("disparos_campaign_leads")
                .select("id, campaign_id, phone, status, created_at, sent_at, short_url, message_text")
                .eq("campaign_id", campaignId)
                .limit(100000));
            if (!withMessage.error && Array.isArray(withMessage.data)) {
                lr = withMessage.data;
            }
            else {
                const legacy = await (supabase
                    .from("disparos_campaign_leads")
                    .select("id, campaign_id, phone, status, created_at, sent_at")
                    .eq("campaign_id", campaignId)
                    .limit(100000));
                if (!legacy.error && Array.isArray(legacy.data))
                    lr = legacy.data;
            }
            if (Array.isArray(lr))
                leadRows = lr;
        }
        catch (e) {
            console.error("[Campanha] Falha ao ler leads no hydrate:", campaignId, e);
        }
        if (!row?.id) {
            return existing || null;
        }
        const stRow = String(row.status || "paused").toLowerCase();
        const status = stRow === "running" || stRow === "paused" || stRow === "finished" || stRow === "draft"
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
                        id: String(lr?.id || crypto_1.default.randomUUID()),
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
            if (!options.skipQueueLocalPersist)
                queuePersistDisparosLocalState();
            return existing;
        }
        const campaign = {
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
                    id: String(lr?.id || crypto_1.default.randomUUID()),
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
        if (!options.skipQueueLocalPersist)
            queuePersistDisparosLocalState();
        return campaign;
    }
    catch (e) {
        console.error("[Campanha] Falha ao hidratar campanha do banco:", campaignId, e);
        return existing || null;
    }
}
/** Sobe todas as campanhas do Postgres para memória (lista + disparos após restart). */
async function syncDisparosCampaignsFromDbOnStartup() {
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
    try {
        const { data: rows, error } = await (supabase
            .from("disparos_campaigns")
            .select("id")
            .order("created_at", { ascending: false })
            .limit(200));
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
            if (!id)
                continue;
            await hydrateCampaignFromDbIfNeeded(id, { skipQueueLocalPersist: true });
        }
        console.log(`[Campanhas] sincronizadas do Supabase na subida: ${rows.length} campanha(s).`);
        queuePersistDisparosLocalState();
    }
    catch (e) {
        console.error("[Campanhas] startup sync:", e);
    }
}
async function pickDisparadorInstanceForConfig(config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(EVO_INSTANCES_URL, {
            headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
            signal: controller.signal,
        });
        if (!response.ok)
            return null;
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
        const selectedList = Array.isArray(config.selectedDisparadorInstances)
            ? config.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
            : [];
        if (!selectedList.length)
            return null;
        const selectedSet = new Set(selectedList);
        const eligible = connected.filter((item) => {
            const usage = usageMap.get(item.instancia);
            const byUsage = usage ? usage.useDisparador !== false : true;
            return byUsage && selectedSet.has(item.instancia);
        });
        if (!eligible.length)
            return null;
        const maxPerDay = Math.max(1, Number(config.maxPerDayPerInstance) || DISPAROS_DEFAULTS.maxPerDayPerInstance);
        const dateKey = saoPauloDateKey();
        const pool = eligible.filter((item) => getInstanceDailySendCount(item.instancia, dateKey) < maxPerDay);
        if (!pool.length)
            return null;
        const key = "__global_rr__";
        const cur = campaignDisparadorRoundRobin.get(key) ?? disparosRoundRobinCounter;
        const idx = cur % pool.length;
        campaignDisparadorRoundRobin.set(key, cur + 1);
        disparosRoundRobinCounter = cur + 1;
        return pool[idx];
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
async function composeOutboundMessageForConfig(config) {
    if (config.messageMode === "database") {
        let templates = [];
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data } = await (supabase
                    .from("disparos_message_templates")
                    .select("id, message_text, alias, segment, source, created_at, active")
                    .eq("active", true)
                    .order("created_at", { ascending: false })
                    .limit(200));
                if (Array.isArray(data)) {
                    templates = data.map((row) => ({
                        id: String(row?.id || ""),
                        text: String(row?.message_text || ""),
                        alias: String(row?.alias || ""),
                        segment: String(row?.segment || ""),
                        source: row?.source === "manual" ? "manual" : "spreadsheet",
                        createdAt: String(row?.created_at || ""),
                        active: row?.active !== false,
                    }));
                }
            }
            catch {
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
        const { shortUrl } = await generateUniqueShortUrlForDisparosConfig(config);
        const httpRegex = /https?:\/\/[^\s)]+/gi;
        let text = pick.text.trim();
        if (httpRegex.test(text)) {
            text = text.replace(httpRegex, shortUrl);
        }
        else {
            text = ensureMessageContainsLink(text, shortUrl, String(config.aiCta || "Acesse aqui"));
        }
        return { text, shortUrl };
    }
    const { shortUrl } = await generateUniqueShortUrlForDisparosConfig(config);
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
        text: ensureMessageContainsLink(generated.text, shortUrl, String(config.aiCta || "Responda no link abaixo")),
        shortUrl,
    };
}
async function persistLeadSentAndCampaignCount(campaignId, leadId, nextSentCount, payload) {
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
    try {
        const sentAt = new Date().toISOString();
        const shortUrl = String(payload?.shortUrl || "").trim();
        const messageText = String(payload?.messageText || "").trim();
        try {
            await supabase.from("disparos_campaign_leads")
                .update({
                status: "sent",
                sent_at: sentAt,
                short_url: shortUrl || null,
                message_text: messageText || null,
            })
                .eq("id", leadId);
        }
        catch {
            await supabase.from("disparos_campaign_leads")
                .update({ status: "sent", sent_at: sentAt })
                .eq("id", leadId);
        }
        await supabase.from("disparos_campaigns")
            .update({ sent_count: nextSentCount })
            .eq("id", campaignId);
    }
    catch {
        /* */
    }
    queuePersistDisparosLocalState();
}
async function persistLeadFailed(lead, kind) {
    lead.status = "failed";
    lead.failureKind = kind;
    lead.messageText = undefined;
    lead.sentAt = null;
    const supabase = getSupabaseClient();
    if (!supabase)
        return;
    try {
        await supabase.from("disparos_campaign_leads")
            .update({ status: "failed" })
            .eq("id", lead.id);
    }
    catch {
        /* */
    }
    queuePersistDisparosLocalState();
}
function scheduleNextCampaignDispatchDelay(campaignId, config) {
    const minS = Math.max(10, Number(config.delayMinSeconds) || DISPAROS_DEFAULTS.delayMinSeconds);
    const maxS = Math.max(minS, Number(config.delayMaxSeconds) || DISPAROS_DEFAULTS.delayMaxSeconds);
    const waitSec = minS + Math.random() * (maxS - minS);
    campaignNextAllowedSendAt.set(campaignId, Date.now() + waitSec * 1000);
}
async function processOneCampaignDispatch(campaignId) {
    const campaign = disparosCampaignsMemory.find((c) => c.id === campaignId);
    if (!campaign || campaign.status !== "running")
        return;
    const nextAt = campaignNextAllowedSendAt.get(campaignId) || 0;
    if (Date.now() < nextAt)
        return;
    const lead = disparosCampaignLeadsMemory.find((l) => l.campaignId === campaignId && l.status === "pending");
    if (!lead) {
        campaign.status = "finished";
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                await supabase.from("disparos_campaigns")
                    .update({ status: "finished" })
                    .eq("id", campaignId);
            }
            catch {
                /* */
            }
        }
        queuePersistDisparosLocalState();
        return;
    }
    let outbound;
    try {
        outbound = await composeOutboundMessageForConfig(campaign.configSnapshot);
    }
    catch (err) {
        console.error("[Campanha] Falha ao montar mensagem:", err);
        return;
    }
    const instancePick = await pickDisparadorInstanceForConfig(campaign.configSnapshot);
    if (!instancePick) {
        console.error("[Campanha] Nenhuma instância disponível entre as selecionadas no snapshot da campanha (conectadas + com Disparador ativo).");
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
    const sendBody = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text: outbound.text } }
        : { number: numero, text: outbound.text, textMessage: { text: outbound.text } };
    const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
    if (!sendResult.ok) {
        console.error("[Campanha] EVO send falhou:", sendResult.status, String(sendResult.body || "").slice(0, 200));
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
        const creditsApiKind = await resolveDispatchCreditsApiKindForOwner(ownerEmail);
        if (debitsDisparosCreditsPerSuccessfulSend(creditsApiKind)) {
            disparosCreditsService.recordShipmentConsumed(ownerEmail, 1, creditsApiKind);
            if (!disparosCreditsService.isMasterUnlimited(ownerEmail) &&
                disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, creditsApiKind) <= 0) {
                campaign.status = "paused";
                const supabase = getSupabaseClient();
                if (supabase) {
                    try {
                        await supabase.from("disparos_campaigns")
                            .update({ status: "paused" })
                            .eq("id", campaign.id);
                    }
                    catch {
                        /* */
                    }
                }
                queuePersistDisparosLocalState();
            }
        }
    }
    await persistLeadSentAndCampaignCount(campaign.id, lead.id, campaign.sentCount, {
        shortUrl: lead.shortUrl || null,
        messageText: lead.messageText || null,
    });
    scheduleNextCampaignDispatchDelay(campaignId, campaign.configSnapshot);
}
async function runCampaignDispatchTick() {
    const nowSp = nowInSaoPaulo();
    let evoRows = [];
    try {
        evoRows = await fetchEvoInstanceTagRows();
    }
    catch {
        evoRows = [];
    }
    const running = disparosCampaignsMemory.filter((c) => c.status === "running");
    for (const c of running) {
        const health = getCampaignInstanceHealth(c.configSnapshot, evoRows);
        if (health.shouldPauseByDisconnectedRatio || health.needsMoreInstancesForMinimum) {
            c.status = "paused";
            const supabase = getSupabaseClient();
            if (supabase) {
                try {
                    await supabase.from("disparos_campaigns")
                        .update({ status: "paused" })
                        .eq("id", c.id);
                }
                catch {
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
async function stopAllDispatchActivityOnServer() {
    stopAquecedorRuntime();
    const pausedSet = new Set();
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const { data: rows } = await (supabase
                .from("disparos_campaigns")
                .select("id")
                .eq("status", "running"));
            if (Array.isArray(rows)) {
                for (const r of rows) {
                    const id = String(r?.id || "").trim();
                    if (id)
                        pausedSet.add(id);
                }
            }
            await supabase.from("disparos_campaigns")
                .update({ status: "paused" })
                .eq("status", "running");
        }
        catch (e) {
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
function countCampaignLeadsProcessed(campaignId, sentFallback, totalNumbers) {
    const memLeads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === campaignId);
    if (memLeads.length > 0) {
        return memLeads.filter((l) => l.status !== "pending").length;
    }
    const sent = Number(sentFallback || 0);
    const cap = Number(totalNumbers || 0);
    if (cap > 0)
        return Math.min(cap, sent);
    return sent;
}
/** Progresso = destinos já processados (enviado ou falha), sem reenvio; pendências não entram. */
function progressPercentForCampaignListItem(campaignId, totalNumbers, sentCount) {
    const total = Number(totalNumbers || 0);
    if (total <= 0)
        return 0;
    const processed = countCampaignLeadsProcessed(campaignId, sentCount, totalNumbers);
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}
app.post("/disparos/campanhas", (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (isDisparosCampaignCreatePost(req) && ct.includes("multipart/form-data")) {
        return uploadCampaignSpreadsheet.single("spreadsheet")(req, res, (err) => {
            if (err) {
                const limitErr = err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE";
                const msg = limitErr
                    ? "Arquivo acima do limite. Ajuste CAMPAIGN_UPLOAD_MAX_MB ou use planilha menor."
                    : err.message || "Falha no upload da planilha.";
                return res.status(400).json({ error: msg });
            }
            next();
        });
    }
    next();
}, async (req, res) => {
    try {
        let name;
        let numbers;
        let configSnapshot;
        let duplicatesRemoved = 0;
        const ct = String(req.headers["content-type"] || "");
        if (ct.includes("multipart/form-data") && req.file) {
            name = String(req.body?.name || "").trim();
            const numberColumn = String(req.body?.numberColumn || "").trim();
            let rawConfig = {};
            try {
                rawConfig = JSON.parse(String(req.body?.configSnapshot || "{}"));
            }
            catch {
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
            }
            catch (e) {
                return res.status(400).json({
                    error: e?.message || "Não foi possível ler a planilha enviada.",
                });
            }
        }
        else {
            name = String(req.body?.name || "").trim();
            const numbersRaw = Array.isArray(req.body?.numbers) ? req.body.numbers : [];
            configSnapshot = parseDisparosConfig(req.body?.configSnapshot || {});
            const bucket = numbersRaw
                .map((n) => normalizeCampaignPhone(String(n || "")))
                .filter((n) => n.length >= 12);
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
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const ownerEmail = String(auth.email || "").trim().toLowerCase() || undefined;
        let importedLineCount = numbers.length;
        if (ct.includes("multipart/form-data") && req.file) {
            importedLineCount = (0, waba_campaign_spreadsheet_util_1.countSpreadsheetImportedRows)(req.file.buffer);
        }
        if (importedLineCount < 1) {
            importedLineCount = numbers.length;
        }
        let plannedSendCount = importedLineCount;
        const requestedPlannedSendCount = Math.max(0, Math.floor(Number(req.body?.plannedSendCount) || 0));
        let creditsApiKind = "oficial";
        if (ownerEmail && !disparosCreditsService.isMasterUnlimited(ownerEmail)) {
            creditsApiKind = await resolveDispatchCreditsApiKindForOwner(ownerEmail);
            const remaining = disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, creditsApiKind);
            if (remaining <= 0) {
                return res.status(400).json({
                    error: "Você não possui envios contratados disponíveis. Contrate um pacote antes de criar a campanha.",
                });
            }
            const cap = requestedPlannedSendCount > 0
                ? Math.min(importedLineCount, remaining, requestedPlannedSendCount)
                : Math.min(importedLineCount, remaining);
            plannedSendCount = cap;
            numbers = numbers.slice(0, plannedSendCount);
            if (!numbers.length) {
                return res.status(400).json({
                    error: "Não há números válidos suficientes na planilha para os envios disponíveis.",
                });
            }
            if (debitsDisparosCreditsOnCampaignCreate(creditsApiKind)) {
                disparosCreditsService.recordShipmentConsumed(ownerEmail, numbers.length, creditsApiKind);
            }
        }
        else if (requestedPlannedSendCount > 0) {
            plannedSendCount = Math.min(importedLineCount, requestedPlannedSendCount);
            numbers = numbers.slice(0, plannedSendCount);
        }
        if (ownerEmail && (await shouldApplyAlternativaDispatchProfile(ownerEmail))) {
            try {
                await assertAlternativaDispatchReady(ownerEmail);
            }
            catch (err) {
                return res.status(400).json({
                    error: err?.message || "Requisitos da API Alternativa não atendidos.",
                });
            }
            configSnapshot = applyAlternativaDispatchProfile(configSnapshot);
        }
        const campaignInstances = Array.isArray(configSnapshot.selectedDisparadorInstances)
            ? configSnapshot.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
            : [];
        if (!campaignInstances.length) {
            return res.status(400).json({
                error: "Selecione ao menos uma instância na lista «Números utilizados no disparador» (Seção 1) antes de criar a campanha. Só essas instâncias poderão enviar as mensagens.",
            });
        }
        const now = new Date().toISOString();
        const campaignId = crypto_1.default.randomUUID();
        const campaign = {
            id: campaignId,
            name,
            createdAt: now,
            status: "paused",
            totalNumbers: numbers.length,
            sentCount: 0,
            ownerEmail,
            configSnapshot,
        };
        const leads = numbers.map((phone) => ({
            id: crypto_1.default.randomUUID(),
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
                await supabase.from("disparos_campaigns").insert({
                    id: campaign.id,
                    campaign_name: campaign.name,
                    status: campaign.status,
                    total_numbers: campaign.totalNumbers,
                    sent_count: campaign.sentCount,
                    config_snapshot: campaign.configSnapshot,
                    created_at: campaign.createdAt,
                });
                await supabase.from("disparos_campaign_leads").insert(leads.map((lead) => ({
                    id: lead.id,
                    campaign_id: lead.campaignId,
                    phone: lead.phone,
                    status: lead.status,
                    created_at: lead.createdAt,
                    sent_at: lead.sentAt,
                })));
                persistedCampaignToSupabase = true;
            }
            catch (dbErr) {
                console.error("[Campanha] Falha ao gravar campanha/leads no Supabase (dados ficam na memória e em data/disparos-local-state.json):", dbErr);
            }
        }
        queuePersistDisparosLocalState();
        const msgExtra = duplicatesRemoved > 0
            ? ` Foram ignoradas ${duplicatesRemoved} linha(s) com número duplicado (cada destino recebe no máximo uma mensagem).`
            : "";
        const importSummary = plannedSendCount < importedLineCount
            ? `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${numbers.length} envios (limite do seu pacote contratado).`
            : `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${numbers.length} envios.`;
        return res.json({
            ok: true,
            message: "Campanha criada com sucesso. Ative-a à direita para iniciar os disparos." + msgExtra,
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao criar campanha." });
    }
});
app.get("/disparos/campanhas", async (req, res) => {
    try {
        const buildCampaignRuntimeStage = (item, configSnapshot, nowSp, instanceHealth) => {
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
                const pausedByHealthRule = instanceHealth?.shouldPauseByDisconnectedRatio === true ||
                    instanceHealth?.needsMoreInstancesForMinimum === true;
                return {
                    phase: "paused",
                    label: "Pausada",
                    detail: pausedByHealthRule
                        ? "Pausa manual ou automática por regra de saúde."
                        : "Campanha pausada manualmente.",
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
        const mapRowToItem = (row) => {
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
        const byId = new Map();
        const configByCampaignId = new Map();
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                let rows = null;
                const withSnap = await (supabase
                    .from("disparos_campaigns")
                    .select("id, campaign_name, status, total_numbers, sent_count, created_at, config_snapshot")
                    .order("created_at", { ascending: false })
                    .limit(200));
                if (withSnap.error) {
                    const noSnap = await (supabase
                        .from("disparos_campaigns")
                        .select("id, campaign_name, status, total_numbers, sent_count, created_at")
                        .order("created_at", { ascending: false })
                        .limit(200));
                    if (!noSnap.error && Array.isArray(noSnap.data)) {
                        rows = noSnap.data;
                    }
                }
                else if (Array.isArray(withSnap.data)) {
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
                            }
                            catch {
                                /* */
                            }
                        }
                    }
                }
            }
            catch {
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
                nextAllowedAt: (campaignNextAllowedSendAt.get(c.id) || 0) > 0
                    ? new Date(campaignNextAllowedSendAt.get(c.id) || 0).toISOString()
                    : null,
            });
            configByCampaignId.set(c.id, c.configSnapshot);
        }
        const evoRows = await fetchEvoInstanceTagRowsForRequest(req);
        const globalDisparos = await loadDisparosConfigFromDb();
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const globalSelected = await filterDisparadorInstancesReadyForAuth(auth, Array.isArray(globalDisparos.selectedDisparadorInstances)
            ? globalDisparos.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
            : []);
        const nowSp = nowInSaoPaulo();
        const items = Array.from(byId.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((item) => {
            const snapshotTags = disparadorInstanceTagsForCampaign(configByCampaignId.get(item.id), evoRows);
            const st = String(item.status || "").toLowerCase();
            const useGlobal = !snapshotTags.length && st === "running" && globalSelected.length > 0;
            const tags = useGlobal
                ? disparadorInstanceTagsForCampaign({ ...DISPAROS_DEFAULTS, selectedDisparadorInstances: globalSelected }, evoRows)
                : snapshotTags;
            const instanceHealth = getCampaignInstanceHealth(useGlobal
                ? { ...DISPAROS_DEFAULTS, selectedDisparadorInstances: globalSelected }
                : configByCampaignId.get(item.id), evoRows);
            const runtimeStage = buildCampaignRuntimeStage(item, configByCampaignId.get(item.id), nowSp, instanceHealth);
            return {
                ...item,
                disparadorInstances: tags,
                disparadorInstancesFromGlobalFallback: Boolean(useGlobal && tags.length > 0),
                instanceHealth,
                runtimeStage,
            };
        });
        return res.json({ items });
    }
    catch {
        return res.status(500).json({ error: "Erro ao listar campanhas do Disparador." });
    }
});
async function fetchLeadsFromDbForCampaignReport(campaignId) {
    const supabase = getSupabaseClient();
    if (!supabase)
        return [];
    try {
        const { data, error } = await (supabase
            .from("disparos_campaign_leads")
            .select("id, campaign_id, phone, status, created_at, sent_at")
            .eq("campaign_id", campaignId));
        if (error || !Array.isArray(data))
            return [];
        return data.map((lr) => {
            const st = String(lr?.status || "pending").toLowerCase();
            const status = st === "sent" ? "sent" : st === "failed" ? "failed" : "pending";
            return {
                id: String(lr?.id || crypto_1.default.randomUUID()),
                campaignId: String(lr?.campaign_id || campaignId),
                phone: String(lr?.phone || ""),
                status,
                failureKind: status === "failed" ? "send_error" : undefined,
                createdAt: String(lr?.created_at || new Date().toISOString()),
                sentAt: lr?.sent_at ? String(lr.sent_at) : null,
            };
        });
    }
    catch {
        return [];
    }
}
async function fetchCampaignHeaderFromDb(campaignId) {
    const supabase = getSupabaseClient();
    if (!supabase)
        return null;
    try {
        const { data: row } = await (supabase
            .from("disparos_campaigns")
            .select("id, campaign_name, status, total_numbers, sent_count, created_at")
            .eq("id", campaignId)
            .maybeSingle());
        if (!row?.id)
            return null;
        return {
            id: String(row.id),
            name: String(row.campaign_name || ""),
            createdAt: String(row.created_at || new Date().toISOString()),
            status: String(row.status || "paused") || "paused",
            totalNumbers: Number(row.total_numbers || 0),
            sentCount: Number(row.sent_count || 0),
            configSnapshot: { ...DISPAROS_DEFAULTS },
        };
    }
    catch {
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
        const totalNumeros = campaign?.totalNumbers && campaign.totalNumbers > 0
            ? campaign.totalNumbers
            : Math.max(leads.length, 1);
        let enviadosComSucesso = 0;
        let totalCliques = 0;
        let invalidPhone = 0;
        let destinationError = 0;
        let falhaTecnica = 0;
        let pendentes = 0;
        for (const l of leads) {
            if (l.status === "sent")
                enviadosComSucesso += 1;
            else if (l.status === "failed") {
                const k = l.failureKind;
                if (k === "invalid_phone")
                    invalidPhone += 1;
                else if (k === "destination_error")
                    destinationError += 1;
                else
                    falhaTecnica += 1;
            }
            else
                pendentes += 1;
        }
        const sentLeadsWithShortUrl = leads.filter((l) => l.status === "sent" && !!l.shortUrl);
        const uniqueShortUrls = Array.from(new Set(sentLeadsWithShortUrl.map((l) => String(l.shortUrl)))).slice(0, 25);
        const cliqueChecksDisponiveis = uniqueShortUrls.length;
        for (const shortUrl of uniqueShortUrls) {
            const clicks = await fetchClicksForShortUrl(String(shortUrl));
            totalCliques += clicks;
        }
        const cliqueChecksExecutados = uniqueShortUrls.length;
        const numerosErrados = invalidPhone + destinationError;
        const totalProcessados = enviadosComSucesso + numerosErrados + falhaTecnica;
        const top = Math.max(totalNumeros, leads.length, 1);
        const pct = (n) => Math.round((n / top) * 1000) / 10;
        const conversaoPercent = enviadosComSucesso > 0 ? Math.round((totalCliques / enviadosComSucesso) * 1000) / 10 : 0;
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
    }
    catch (error) {
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
        const campaign = disparosCampaignsMemory.find((c) => c.id === id) || (await hydrateCampaignFromDbIfNeeded(id));
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
                    let rows = [];
                    const withMessage = await (supabase
                        .from("disparos_campaign_leads")
                        .select("id, campaign_id, phone, status, created_at, sent_at, short_url, message_text")
                        .eq("campaign_id", id)
                        .eq("status", "sent")
                        .order("sent_at", { ascending: false })
                        .limit(1));
                    if (!withMessage.error && Array.isArray(withMessage.data)) {
                        rows = withMessage.data;
                    }
                    else {
                        const legacy = await (supabase
                            .from("disparos_campaign_leads")
                            .select("id, campaign_id, phone, status, created_at, sent_at")
                            .eq("campaign_id", id)
                            .eq("status", "sent")
                            .order("sent_at", { ascending: false })
                            .limit(1));
                        if (!legacy.error && Array.isArray(legacy.data))
                            rows = legacy.data;
                    }
                    if (rows.length) {
                        const r = rows[0];
                        sentLeads = [
                            {
                                id: String(r?.id || crypto_1.default.randomUUID()),
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
                }
                catch {
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao consultar último disparo." });
    }
});
app.post("/disparos/parar-envios", async (_req, res) => {
    try {
        const { pausedCampaignIds } = await stopAllDispatchActivityOnServer();
        return res.json({
            ok: true,
            message: "Envios interrompidos: aquecedor parado e campanhas em execução foram pausadas (se houver).",
            aquecedorRodando: aquecedorRuntime.running,
            campanhasPausadas: pausedCampaignIds.length,
            idsCampanhasPausadas: pausedCampaignIds,
        });
    }
    catch (error) {
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
        const nextStatus = ativa ? "running" : "paused";
        let campaign = disparosCampaignsMemory.find((c) => c.id === id);
        if (!campaign) {
            campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
        }
        if (!campaign) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        if (ativa && campaign.status === "finished") {
            return res.status(409).json({
                error: "Campanha já finalizada: cada número da lista foi processado uma vez (envio ou falha). Crie uma nova campanha para novo disparo.",
            });
        }
        if (ativa) {
            const ownerEmail = String(campaign.ownerEmail || "").trim().toLowerCase();
            if (ownerEmail) {
                try {
                    await assertAlternativaDispatchReady(ownerEmail);
                }
                catch (err) {
                    return res.status(400).json({
                        error: err?.message || "Requisitos da API Alternativa não atendidos.",
                    });
                }
            }
            let evoRows = [];
            try {
                evoRows = await fetchEvoInstanceTagRows();
            }
            catch {
                evoRows = [];
            }
            const health = getCampaignInstanceHealth(campaign.configSnapshot, evoRows);
            if (health.needsMoreInstancesForMinimum) {
                return res.status(409).json({
                    error: `Campanha bloqueada: são necessários ao menos ${health.minConnectedRequired} números conectados. Você possui ${health.connectedCount}. Use «+ Instâncias» ou compre mais números.`,
                    instanceHealth: health,
                    code: "campaign_min_instances",
                });
            }
            if (health.shouldPauseByDisconnectedRatio) {
                return res.status(409).json({
                    error: "Campanha bloqueada: 50% ou mais das instâncias selecionadas estão desconectadas. Reconecte as instâncias ou use «+ Instâncias».",
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
                await supabase.from("disparos_campaigns")
                    .update({ status: nextStatus })
                    .eq("id", id);
            }
            catch {
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
    }
    catch (error) {
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
        const merged = {
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
                await supabase.from("disparos_campaigns")
                    .update({ config_snapshot: campaign.configSnapshot })
                    .eq("id", id);
            }
            catch {
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
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao atualizar config da campanha." });
    }
});
app.post("/disparos/campanhas/:id/instancias", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ error: "Identificador da campanha é obrigatório." });
        }
        const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
        const auto = req.body?.auto === true;
        let campaign = disparosCampaignsMemory.find((c) => c.id === id);
        if (!campaign) {
            campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
        }
        if (!campaign) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        let evoRows = [];
        try {
            evoRows = await fetchEvoInstanceTagRowsForRequest(req);
        }
        catch {
            evoRows = [];
        }
        const prev = campaign.configSnapshot || { ...DISPAROS_DEFAULTS };
        const healthBefore = getCampaignInstanceHealth(prev, evoRows);
        let incoming = [];
        if (auto) {
            if (!healthBefore.needsMoreInstancesForMinimum) {
                return res.status(400).json({
                    error: "A campanha já possui números conectados suficientes.",
                    instanceHealth: healthBefore,
                });
            }
            incoming = await resolveAutoInstancesForCampaign(auth, prev, evoRows, healthBefore.missingConnectedForMinimum);
            if (!incoming.length) {
                return res.status(409).json({
                    error: "Não há números disponíveis no aquecedor nem entre os comprados. Compre mais números para continuar a campanha.",
                    instanceHealth: healthBefore,
                    code: "buy_numbers_required",
                    needsPurchase: true,
                });
            }
        }
        else {
            const raw = Array.isArray(req.body?.instanceNames) ? req.body.instanceNames : [];
            incoming = await filterDisparadorInstancesReadyForAuth(auth, raw.map((n) => String(n || "").trim()).filter(Boolean));
            if (!incoming.length) {
                return res.status(400).json({ error: "Informe ao menos uma instância válida para adicionar." });
            }
        }
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
                await supabase.from("disparos_campaigns")
                    .update({ config_snapshot: campaign.configSnapshot })
                    .eq("id", id);
            }
            catch {
                /* */
            }
        }
        queuePersistDisparosLocalState();
        const instanceHealth = getCampaignInstanceHealth(campaign.configSnapshot, evoRows);
        const stillNeedsMore = instanceHealth.needsMoreInstancesForMinimum;
        return res.json({
            ok: true,
            id,
            auto,
            selectedDisparadorInstances: campaign.configSnapshot.selectedDisparadorInstances,
            addedCount: Math.max(0, mergedSelected.length - prevSelected.length),
            instanceHealth,
            stillNeedsMore,
            needsPurchase: stillNeedsMore && incoming.length < healthBefore.missingConnectedForMinimum,
            message: stillNeedsMore
                ? `Adicionamos ${Math.max(0, mergedSelected.length - prevSelected.length)} número(s), mas ainda faltam ${instanceHealth.missingConnectedForMinimum} conectado(s). Compre mais números para concluir a campanha.`
                : "Instâncias adicionadas à campanha. Você já pode ativar novamente.",
        });
    }
    catch (error) {
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
                const { data: rows, error } = await supabase.from("disparos_campaigns")
                    .update({ campaign_name: name })
                    .eq("id", id)
                    .select("id, campaign_name, status, total_numbers, sent_count, created_at");
                const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
                if (!error && row?.id) {
                    await hydrateCampaignFromDbIfNeeded(id);
                    const c2 = disparosCampaignsMemory.find((c) => c.id === id);
                    if (c2)
                        c2.name = name;
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
                            progressPercent: total > 0 ? Math.max(0, Math.min(100, Math.round((sent / total) * 100))) : 0,
                        },
                    });
                }
            }
            catch {
                /* */
            }
        }
        if (!campaign) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        campaign.name = name;
        if (supabase) {
            try {
                await supabase.from("disparos_campaigns")
                    .update({ campaign_name: name })
                    .eq("id", id);
            }
            catch {
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
                progressPercent: campaign.totalNumbers > 0
                    ? Math.max(0, Math.min(100, Math.round((campaign.sentCount / campaign.totalNumbers) * 100)))
                    : 0,
            },
        });
    }
    catch (error) {
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
                await supabase.from("disparos_campaign_leads").delete().eq("campaign_id", id);
                const { error: delCampErr, data: delData } = await supabase.from("disparos_campaigns")
                    .delete()
                    .eq("id", id)
                    .select("id");
                if (!delCampErr && Array.isArray(delData) && delData.length > 0) {
                    queuePersistDisparosLocalState();
                    return res.json({ ok: true, message: "Campanha excluída." });
                }
            }
            catch {
                /* */
            }
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        if (!campaign) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        const idx = disparosCampaignsMemory.findIndex((c) => c.id === id);
        if (idx !== -1)
            disparosCampaignsMemory.splice(idx, 1);
        for (let k = disparosCampaignLeadsMemory.length - 1; k >= 0; k--) {
            if (disparosCampaignLeadsMemory[k].campaignId === id)
                disparosCampaignLeadsMemory.splice(k, 1);
        }
        campaignNextAllowedSendAt.delete(id);
        if (supabase) {
            try {
                await supabase.from("disparos_campaign_leads").delete().eq("campaign_id", id);
                await supabase.from("disparos_campaigns").delete().eq("id", id);
            }
            catch {
                /* memória já limpa */
            }
        }
        queuePersistDisparosLocalState();
        return res.json({ ok: true, message: "Campanha excluída." });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || "Erro ao excluir campanha." });
    }
});
(0, waba_fazenda_pool_service_1.configureWabaFazendaPool)({ loadInstanceUsageMap });
(0, waba_billing_routes_1.registerWabaBillingRoutes)(app);
(0, waba_campaign_intake_routes_1.registerWabaCampaignIntakeRoutes)(app);
(0, waba_support_routes_1.registerWabaSupportRoutes)(app);
(0, waba_push_routes_1.registerWabaPushRoutes)(app);
(0, waba_admin_routes_1.registerWabaAdminRoutes)(app);
(0, waba_operacional_campanhas_routes_1.registerWabaOperacionalCampanhasRoutes)(app);
new waba_system_user_service_1.WabaSystemUserService().ensureBootstrapFromEnvMaster();
const httpServer = app.listen(PORT, () => {
    const publicRoot = base_path_1.BASE_PATH
        ? `http://localhost:${PORT}${base_path_1.BASE_PATH}/`
        : `http://localhost:${PORT}/`;
    console.log(`Disparador N8 [${load_env_1.WABA_ENV}] - servidor rodando em ${publicRoot}`);
    if (base_path_1.BASE_PATH) {
        console.log(`[base-path] prefixo público: ${base_path_1.BASE_PATH}`);
    }
    draxLogoBytes = undefined;
    const logoProbe = resolveDraxLogoPng();
    console.log(`[brand] logo PNG: ${logoProbe ? `${logoProbe.length} bytes (ok)` : "FALHOU — embed vazio ou ficheiros em falta"} | use GET /logo.png ou /media/Drax-logo-footer.png`);
    console.log(`[runtime] mode=${RUNTIME_MODE} backgroundProcessing=${ENABLE_BACKGROUND_PROCESSING} aquecedorProcessing=${ENABLE_AQUECEDOR_PROCESSING}`);
    console.log(`[evo] base=${(0, evo_http_client_1.describeEvoApiBaseForOps)(EVO_API_BASE)} tlsInsecure=${(0, evo_http_client_1.isEvoTlsInsecure)()} timeoutMs=${(0, evo_http_client_1.defaultEvoHttpTimeoutMs)()}`);
    if (/walkup[-_]evo|evo-walkup-api:8080/i.test(EVO_API_BASE)) {
        console.warn("[evo] EVO_API_URL parece hostname interno Docker/Swarm. Se QRCode falhar em producao, use https://walkup-evo-walkup-api.achpyp.easypanel.host ou http://172.17.0.1:30181");
    }
    console.log(`[campanhas] upload planilha até ${Math.round(CAMPAIGN_UPLOAD_MAX_BYTES / 1024 / 1024)}MB (multipart) | JSON legado=${CAMPAIGN_CREATE_JSON_LIMIT}`);
    if (MAINTENANCE_MODE) {
        console.log(`[maintenance] ativo — tráfego de API bloqueado; probes em /health, /ready, /service/maintenance (porta ${PORT})`);
    }
    void (async () => {
        try {
            await loadDisparosLocalState();
            await syncDisparosCampaignsFromDbOnStartup();
        }
        catch (e) {
            console.error("[Campanhas] bootstrap (estado local + Supabase):", e);
        }
        setInterval(() => {
            queuePersistDisparosLocalState();
        }, DISPAROS_CHECKPOINT_MS);
        console.log(`[durabilidade] checkpoint campanhas a cada ${Math.round(DISPAROS_CHECKPOINT_MS / 1000)}s → data/disparos-local-state.json`);
        const desiredHeater = await loadAquecedorRuntimeIntent();
        if (desiredHeater.desired === true &&
            ENABLE_AQUECEDOR_PROCESSING &&
            !MAINTENANCE_MODE) {
            aquecedorRuntimeOwnerEmail = desiredHeater.ownerEmail;
            if (!aquecedorRuntimeOwnerEmail) {
                console.warn("[Aquecedor] runtime-intent pede motor ligado, mas sem aquecedorOwnerEmail — aguardando POST /aquecedor/start.");
            }
            else {
                await syncAquecedorWorkerLeadership();
                console.log("[Aquecedor] retomado após restart (data/runtime-intent.json — último «Iniciar» explícito).");
            }
        }
        setInterval(() => {
            syncAquecedorWorkerLeadership().catch((err) => console.error("[Aquecedor] sync worker:", err));
        }, AQUECEDOR_WORKER_SYNC_MS);
        const AQUECEDOR_PREPARE_PROMOTE_MS = 15000;
        setInterval(() => {
            (0, aquecedor_instance_lifecycle_service_1.syncAquecedorPreparingPromotions)()
                .then((promoted) => {
                if (promoted.length) {
                    console.log(`[Aquecedor] ${promoted.length} instância(s) promovida(s) de Preparando → ativo: ${promoted.join(", ")}`);
                }
            })
                .catch((err) => console.error("[Aquecedor] promoção Preparando:", err));
        }, AQUECEDOR_PREPARE_PROMOTE_MS);
        void (0, aquecedor_instance_lifecycle_service_1.syncAquecedorPreparingPromotions)();
        console.log(`[Aquecedor] promoção Preparando→ativo a cada ${Math.round(AQUECEDOR_PREPARE_PROMOTE_MS / 1000)}s (independente do motor ligado)`);
        if (ENABLE_BACKGROUND_PROCESSING && !MAINTENANCE_MODE) {
            if (load_env_1.WABA_ENV === "v01") {
                console.log("[campanhas] Disparador EVO ativo (ambiente v01 — tick a cada 7s).");
            }
            setInterval(() => {
                runCampaignDispatchTick().catch((err) => console.error("[Campanhas] tick:", err));
            }, 7000);
        }
        else if (!ENABLE_BACKGROUND_PROCESSING) {
            console.log(load_env_1.WABA_ENV === "v01"
                ? "[campanhas] Disparador EVO desativado neste processo (WABA_EVO_DISPARADOR=false)."
                : "[campanhas] processamento automático desativado neste processo (dev isolado).");
        }
        (0, asaas_integration_monitor_service_1.startAsaasIntegrationMonitorScheduler)();
    })();
});
(0, waba_graceful_shutdown_1.registerWabaGracefulShutdown)(httpServer);
