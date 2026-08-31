import "./load-env";
process.env.TZ = process.env.TZ || "America/Sao_Paulo";
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import crypto from "crypto";
import { promises as fs, existsSync, readFileSync, statSync } from "fs";
import { lookup } from "dns/promises";
import { hostname } from "os";
import { createClient } from "@supabase/supabase-js";
import { DRAX_LOGO_PNG_BASE64 } from "./generated-brand-logo";
import { WABA_ENV } from "./load-env";
import { resolveDataFile } from "./data-path";
import {
  type AquecedorOwnerMotor,
  type AquecedorRuntimeStatus,
  AQUECEDOR_OWNER_WORKER_ID,
  applyPersistedSnapshotToMotor,
  buildAquecedorOwnerStatusPayload,
  buildLiveAquecedorOwnerStatusPayload,
  buildPersistedSnapshotFromMotor,
  getAquecedorOwnerMotor,
  getAquecedorOwnerCicloGlobal,
  listAquecedorOwnerEmails,
  listAquecedorOwnersWithDesiredRunning,
  loadAquecedorOwnerRuntimeIntents,
  loadAndApplyDurableDesiredOwners,
  flushAquecedorOwnerMotorsToDisk,
  normalizeAquecedorOwnerEmail,
  persistAquecedorOwnerIntent,
  persistAquecedorOwnerSnapshot,
  reloadAquecedorOwnerMotorsFromDisk,
  setAquecedorOwnerCicloGlobal,
  shouldProcessLeadOwnerMotor,
  stopAquecedorOwnerMotorLocal,
  updateAquecedorOwnerConnectedSummary,
} from "./services/aquecedor-owner-runtime.registry";
import {
  BASE_PATH,
  stripBasePathMiddleware,
  requestUnderBasePath,
  injectRuntimeIntoIndexHtml,
  resolveDeployResilienceForClient,
  resolveShellCacheKey,
  type WabaUiProfile,
} from "./base-path";
import {
  bootstrapOwnerGraphFromEvents,
  ensureCompletePairGraph,
  getOwnerConversationGraph,
  recordDirectedSend,
  recordPairSelection,
} from "./aquecedor/conversation-graph.service";
import {
  buildAquecedorDeliveryNeedles,
  buildAquecedorFindMessagesBodies,
  decideAquecedorDeliveryConfirmation,
  evoPayloadIncludesNeedle,
  extractEvoMessageAckStatus,
  isEvoAckDeviceDelivered,
  isEvoAckFailure,
  type EvoMessageAckStatus,
} from "./aquecedor/delivery-verify.helpers";
import {
  evaluateOutboundSamplePayload,
  getCachedAquecedorOutboundHealth,
  rememberAquecedorOutboundHealth,
} from "./aquecedor/outbound-ack-health.service";
import {
  buildDirectedCooldownKey,
  listBlockedDirectedKeys,
  recordDirectedDeliveryFailure,
} from "./aquecedor/delivery-cooldown.service";
import {
  buildSelectionRecord,
  pickNextDirectedExchange,
} from "./aquecedor/pair-orchestrator.service";
import { buildNetworkHealthReport } from "./aquecedor/network-health.service";
import {
  aquecedorChipKeyFromNumber,
  buildAquecedorChipIndex,
  buildAquecedorNumberVariantToChipMap,
  dedupeAquecedorConnectedByNumber,
  resolveAquecedorInstanceToChip,
  resolveNumberVariantToChip,
} from "./aquecedor/aquecedor-chip-identity";
import { resolveWabaContainerServiceId } from "./waba-container-service";
import { registerWabaAuthRoutes, wabaRequireAuthMiddleware } from "./auth/waba-auth.routes";
import { registerMetaWhatsappIntegrationRoutes } from "./integrations/meta-whatsapp/meta-whatsapp.routes";
import { startMetaWhatsappAutomation } from "./integrations/meta-whatsapp/meta-whatsapp-automation.bootstrap";
import {
  registerMetaWhatsappSubscriptionRoute,
  registerMetaWhatsappWebhookRoutes,
} from "./integrations/meta-whatsapp/meta-whatsapp-webhook.routes";
import { isMetaWhatsappWebhookPath } from "./integrations/meta-whatsapp/meta-whatsapp-webhook-path";
import { resolveWabaRequestAuth, type WabaRequestAuth } from "./auth/waba-request-auth";
import { isWabaAuthConfigured, isWabaMasterEmail } from "./auth/waba-auth.service";
import { authorizeMetaOficialLabAccess } from "./auth/waba-meta-oficial-token-access";
import { WabaSystemUserRepository } from "./users/waba-system-user.repository";
import { AlternativaNumberActivationRepository } from "./billing/alternativa-number-activation.repository";
import { WabaAlternativaNumbersService } from "./billing/waba-alternativa-numbers.service";
import {
  assertAlternativaMinActivated,
  CAMPAIGN_SEND_INTERVAL_RATIO,
  computeAlternativaThrottle,
  computeAlternativaTypingDelayMs,
  DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES,
  estimateAlternativaCampaignDuration,
  getAlternativaDispatchRulesMeta,
  isAlternativaBurstWindowOpen,
} from "./disparos/alternativa-dispatch-rules";
import { wabaInstanceOwnershipService } from "./instances/waba-instance-ownership.service";
import { resolveEvoInstanceKey } from "./instances/evo-instance-key";
import {
  brazilWhatsAppNumbersMatch,
  canonicalizeBrazilWhatsAppNumber,
  expandBrazilWhatsAppNumberVariants,
  extractPhoneFromEvoListItem,
  normalizeEvoWhatsAppNumber,
  resolveEvoInstancePhone,
} from "./instances/evo-instance-phone.service";
import {
  describeEvoConnectionMismatch,
  invalidateEvoLiveStateCache,
  fetchEvoInstanceLiveState,
  aquecedorLiveStateAllowsConnected,
  campaignChipConnectedForDispatch,
  fetchEvoInstanceLiveDetail,
  isEvoWhatsAppRestrictedReason,
  isEvoLiveStateOpen,
  isEvoConnectionInProgress,
  pickEvoConnectionState,
  resolveEvoLiveConnectionSnapshots,
  waitForEvoInstanceLiveOpenLenient,
} from "./instances/evo-connection-state.service";
import {
  getWhatsappConnectingRestrictionMap,
  markWhatsappRestrictionExplicit,
  purgeAutomaticWhatsappConnectingRestrictions,
  recheckWhatsappConnectingRestrictions,
  syncWhatsappConnectingRestriction,
  clearWhatsappConnectingRestriction,
  WA_CONNECTING_RECHECK_MS,
} from "./instances/whatsapp-connecting-restriction.service";
import {
  collectEvoInstancesSharingPhone,
  splitCanonicalAndDuplicateNames,
} from "./instances/evo-reconnect-purge.service";
import {
  resolveCampaignStoredNameToEvoKey,
  uniqueProbeNamesForLiveState,
} from "./instances/campaign-instance-identity";
import { runEvoIntegrationProbe } from "./services/evo-integration-probe.service";
import { registerWabaBillingRoutes } from "./billing/waba-billing.routes";
import { configureWabaFazendaPool, wabaFazendaPoolService } from "./instances/waba-fazenda-pool.service";
import { registerWabaAdminRoutes } from "./admin/waba-admin.routes";
import { registerWabaPushRoutes } from "./push/waba-push.routes";
import { registerWabaLeadsCnpjRoutes } from "./marketing/leads-cnpj/waba-leads-cnpj.routes";
import { registerWabaOperacionalCampanhasRoutes } from "./admin/waba-operacional-campanhas.routes";
import { registerDeviceCloudRoutes } from "./device-cloud/waba-device-cloud.routes";
import { startAsaasIntegrationMonitorScheduler } from "./monitoring/asaas-integration-monitor.service";
import { startUptimeMonitorScheduler } from "./monitoring/uptime-monitor.service";
import { startCampaignSupplierAssignmentScheduler } from "./services/waba-campaign-supplier-assignment.service";
import { startVpsCpuLocalSampler } from "./infra/vps-cpu-monitor.service";
import { evoHttpRequestWithBaseFailover } from "./evo-api-config";
import { defaultEvoHttpTimeoutMs, describeEvoApiBaseForOps, defaultEvoSendTextTimeoutMs, evoHttpRequest, isEvoTlsInsecure } from "./evo-http.client";
import {
  isEvoSendTransientError,
  recoverEvoSendTextAfterFailure,
  restartEvoInstanceLight,
} from "./services/evo-send-recovery.service";
import {
  createWabaShortUrl,
  fetchWabaShortUrlClicks,
  isWabaManagedShortUrl,
  peekWabaShortPublicBaseUrl,
  resolveWabaShortRedirect,
} from "./shortener/waba-shortener.service";
import {
  publicBaseHintsFromExpressRequest,
  resolveWabaPublicBaseUrl,
  type WabaPublicBaseRequestHints,
} from "./lib/waba-public-base-url";
import { WabaSystemUserService } from "./users/waba-system-user.service";
import { registerWabaCampaignIntakeRoutes } from "./disparos/waba-campaign-intake.routes";
import {
  resolveSubscriberDispatchesApiKindFromOrders,
  type WabaDispatchesApiKind,
} from "./disparos/waba-dispatches-api-kind";
import { countSpreadsheetImportedRows } from "./disparos/waba-campaign-spreadsheet.util";
import {
  messengerImagesAreComplete,
  normalizeMessengerImagesConfig,
  pickNextMessengerImageIndex,
  readCampaignMessengerImageBase64,
  resolveCampaignMessengerImageFile,
  saveCampaignMessengerImage,
  type CampaignMessengerImageMeta,
} from "./disparos/waba-campaign-messenger-images.service";
import { WabaDisparosCreditsService } from "./billing/waba-disparos-credits.service";
import {
  getWabaFeatureFlagsForClient,
  isAlternativaNumbersPurchaseEnabled,
} from "./config/waba-feature-flags";
import { registerWabaEntitlementRoutes } from "./entitlements/waba-entitlement.routes";
import { WabaEntitlementService } from "./entitlements/waba-entitlement.service";
import { registerWabaCors } from "./lib/waba-cors";
import { registerWabaSubscriberRoutes } from "./subscribers/waba-subscriber.routes";
import { isBetsSubscriberEmail } from "./subscribers/waba-subscriber-segment";
import { registerWabaSupportRoutes } from "./support/waba-support.routes";
import {
  getIntegrationProbeStatus,
  handleEvolutionWebhookPayload,
  setIntegrationProbeFinishedHandler,
  startIntegrationProbe,
} from "./instance-integration-probe";
import {
  confirmUserSentInbound,
  getInboundValidationStatus,
  handleInboundValidationWebhook,
  refreshInboundValidation,
  setInboundValidationFinishedHandler,
  startInboundValidation,
} from "./instance-inbound-validation.service";
import {
  detectAndMarkRestrictionFromSend,
  filterAquecedorCycleConnected,
  canAquecedorInstanceSendToday,
  filterInstancesLifecycleReady,
  findAquecedorLifecycleRow,
  getAquecedorLifecycleStatusMap,
  markAquecedorInstanceRestricted,
  clearAquecedorHumanPause,
  noteAquecedorInstanceReconnected,
  recordAquecedorInstanceDailySend,
  registerAquecedorInstancePreparing,
  removeAquecedorInstanceLifecycle,
  syncAquecedorPreparingPromotions,
  getAquecedorLifecycleStatusForInstance,
} from "./services/aquecedor-instance-lifecycle.service";
import { getAquecedorWarmthMapForInstances } from "./services/aquecedor-instance-warmth.service";
import { getAquecedorMessageStatsForInstances } from "./services/aquecedor-instance-message-stats.service";
import { getProductionDataPersistenceSnapshot } from "./services/production-data-persistence.service";
import {
  loadProxyBrasilConfig,
  proxyBrasilPublicSummary,
} from "./proxy/proxy-brasil.config";
import {
  applyProxyBrasilToEvoInstance,
  areAllInstanceNamesProxyConfirmedEnabled,
  disableProxyBrasilOnEvoInstance,
  fetchEvoProxyFindEnabled,
  getConfirmedProxyFind,
  prepareProxyBrasilSessionsForCampaign,
  campaignStatusHoldsProxyBrasil,
  instanceNamesToReleaseAfterCampaignEnd,
  queueApplyProxyBrasilToInstances,
  queueConfirmProxyFindForInstanceNames,
  queueDisableProxyBrasilOnInstances,
  queueSyncProxyBrasilForCampaignSelection,
  reconcileProxyBrasilForCampaignInstances,
  refreshConfirmedProxyFindForNames,
} from "./proxy/evo-instance-proxy.service";
import {
  classifyProxyBrasilConnection,
  heldProxyBrasilInstanceNames,
  instanceMaySendWithProxyBrasil,
  instanceNameConflictsWithHeld,
  namesHeldByUnfinishedCampaigns,
  pickBalancedEligibleCampaignInstance,
} from "./proxy/proxy-brasil-campaign.rules";
import { WABA_DEPLOY_MARKER } from "./deploy-marker";
import {
  WABA_CAMPAIGN_INTAKE_API_VERSION,
  WABA_CAMPAIGN_INTAKE_SAFE_PARSER,
} from "./disparos/waba-campaign-intake.constants";
import { wabaMailService } from "./mail/waba-mail.service";
import {
  isWabaServerShuttingDown,
  registerWabaGracefulShutdown,
  registerWabaShutdownGate,
} from "./server/waba-graceful-shutdown";

/** Identificador único por processo — muda a cada redeploy/restart (overlay de deploy). */
const WABA_SERVER_BOOT_ID = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;

const app = express();
app.use(stripBasePathMiddleware);

app.get("/live", (_req, res) => res.status(200).send("ok"));

app.get("/ready", (_req, res) => {
  const shuttingDown = isWabaServerShuttingDown();
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
/** Webhook Meta: JSON + raw body intacto para HMAC SHA-256 (X-Hub-Signature-256). */
const parseJsonMetaWhatsappWebhook = express.json({
  limit: "1mb",
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
});

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

const uploadMessengerImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
      cb(null, true);
      return;
    }
    cb(new Error("Envie JPEG, PNG ou WebP 1080×1080."));
  },
});

function isDisparosCampaignCreatePost(req: express.Request) {
  if (req.method !== "POST") return false;
  const p = String(req.path || "").replace(/\/+$/, "") || "/";
  return p === "/disparos/campanhas";
}

/** Multipart não pode passar pelo express.json/urlencoded — corrompe o stream antes do multer. */
function shouldSkipBodyParserForMultipart(req: express.Request) {
  if (req.method !== "POST") return false;
  const p = String(req.path || "").replace(/\/+$/, "") || "/";
  // Intake do wizard é sempre multipart; não depender só do Content-Type (proxies podem alterá-lo).
  if (p === "/disparos/campanhas/intake") return true;
  if (p === "/disparos/messenger-images") return true;
  if (/^\/device-cloud\/device\/[^/]+\/push-media$/.test(p)) return true;
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("multipart/form-data")) return false;
  return p === "/disparos/campanhas";
}

app.use((req, res, next) => {
  if (shouldSkipBodyParserForMultipart(req)) {
    return next();
  }
  if (req.method === "POST" && isMetaWhatsappWebhookPath(req.path)) {
    return parseJsonMetaWhatsappWebhook(req, res, next);
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
  if (isMetaWhatsappWebhookPath(req.path)) {
    return next();
  }
  return express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT })(req, res, next);
});

function isMaintenanceBypassPath(method: string, reqPath: string): boolean {
  const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
  if (p === "/webhooks/asaas" || p.startsWith("/webhooks/asaas/") || p === "/webhooks/evolution") {
    return true;
  }
  if (p === "/webhooks/meta/whatsapp") {
    return true;
  }
  if (method !== "GET" && method !== "HEAD") return false;
  return (
    p === "/health" ||
    p === "/ready" ||
    p === "/service/maintenance" ||
    p === "/service/evo-integration-probe" ||
    p === "/service/evo-qr-create-smoke" ||
    p === "/service/evo-qr-recent-failures" ||
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

registerWabaShutdownGate(app);

app.get("/health", (_req, res) => {
  const shuttingDown = isWabaServerShuttingDown();
  res.status(shuttingDown ? 503 : 200).json({
    ok: !shuttingDown,
    shuttingDown,
    deployMarker: WABA_DEPLOY_MARKER,
    serverBootId: WABA_SERVER_BOOT_ID,
    campaignIntakeApiVersion: WABA_CAMPAIGN_INTAKE_API_VERSION,
    campaignIntakeSafeParser: WABA_CAMPAIGN_INTAKE_SAFE_PARSER,
    mailConfigured: wabaMailService.isConfigured(),
    operacionalCampaignNotifyEnabled: true,
    wabaEnv: WABA_ENV,
    uiProfile: resolveUiProfile(),
    featureFlags: getWabaFeatureFlagsForClient(),
    basePath: BASE_PATH || "/",
    port: PORT,
    maintenanceMode: MAINTENANCE_MODE,
    runtimeMode: RUNTIME_MODE,
    deployResilienceEnabled: resolveDeployResilienceForClient(),
    containerService: resolveWabaContainerServiceId(),
    backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
    aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
    aquecedorDesiredOwners: listAquecedorOwnersWithDesiredRunning().length,
    proxyBrasil: proxyBrasilPublicSummary(loadProxyBrasilConfig()),
    evoApiBase: describeEvoApiBaseForOps(EVO_API_BASE),
    evoTlsInsecure: isEvoTlsInsecure(),
    evoHttpTimeoutMs: defaultEvoHttpTimeoutMs(),
    shortPublicBase: peekWabaShortPublicBaseUrl(),
    dataPersistence: getProductionDataPersistenceSnapshot(),
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

app.get("/service/evo-integration-probe", async (_req, res) => {
  try {
    const result = await runEvoIntegrationProbe();
    res.status(result.ok ? 200 : 503).json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: msg.slice(0, 300) });
  }
});

/** Smoke create→extract QR→delete (sem sendText). Diagnóstico do wizard QR. */
app.get("/service/evo-qr-create-smoke", async (_req, res) => {
  const name = `qrsmoke-${Date.now().toString(36).slice(-6)}`;
  const started = Date.now();
  try {
    const createPayload = {
      instanceName: name,
      name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };
    const createResult = await callEvoAction(
      `${EVO_API_BASE}/instance/create`,
      "POST",
      createPayload,
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 30000), retries: 1 },
    );
    const qrCode =
      tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
    const deleteResult = await callEvoAction(
      `${EVO_API_BASE}/instance/delete/${encodeURIComponent(name)}`,
      "DELETE",
      undefined,
      { timeoutMs: 15000, retries: 1 },
    );
    const ok = Boolean(createResult.ok && qrCode);
    res.status(ok ? 200 : 503).json({
      ok,
      name,
      evoApiBase: describeEvoApiBaseForOps(EVO_API_BASE),
      createStatus: createResult.status,
      createOk: createResult.ok,
      extractOk: Boolean(qrCode),
      qrLen: qrCode ? String(qrCode).length : 0,
      deleteStatus: deleteResult.status,
      durationMs: Date.now() - started,
      createDetail: String(createResult.body || createResult.error || "").slice(0, 240),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      name,
      evoApiBase: describeEvoApiBaseForOps(EVO_API_BASE),
      durationMs: Date.now() - started,
      error: msg.slice(0, 400),
    });
  }
});

app.get("/service/evo-qr-recent-failures", (_req, res) => {
  res.status(200).json({
    ok: true,
    evoApiBase: describeEvoApiBaseForOps(EVO_API_BASE),
    count: qrRegisterRecentFailures.length,
    items: qrRegisterRecentFailures,
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
registerMetaWhatsappWebhookRoutes(app);
registerWabaSubscriberRoutes(app);
registerWabaEntitlementRoutes(app);
app.use(wabaRequireAuthMiddleware);
registerMetaWhatsappIntegrationRoutes(app);
startMetaWhatsappAutomation();
registerMetaWhatsappSubscriptionRoute(app);

const wabaEntitlementService = new WabaEntitlementService();

async function rejectForeignInstance(
  req: express.Request,
  res: express.Response,
  instanceName: string
): Promise<boolean> {
  const auth = resolveWabaRequestAuth(req);
  const candidates = await resolveInstanceDeletionKeys(instanceName);
  const allowed = await wabaInstanceOwnershipService.canAccessInstance(
    auth,
    instanceName,
    candidates,
  );
  if (allowed) return false;

  const owner = await wabaInstanceOwnershipService.resolveOwnerEmailForCandidates(candidates);
  res.status(403).json({
    error: "Esta instância pertence a outro usuário ou você não tem permissão para acessá-la.",
    ownerEmail: owner || undefined,
    instanceName: String(instanceName || "").trim() || undefined,
  });
  return true;
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
    if (instanceNameHeldByUnfinishedCampaign(status.sourceInstance)) {
      markCampaignChipUnsendable(
        status.sourceInstance,
        "restriction-probe-held",
      );
      console.info(
        `[Campanha] ${status.sourceInstance} bloqueado para disparo (restrição com chip em campanha) — troca automática.`,
      );
      return;
    }
    await markAquecedorInstanceRestricted(
      status.sourceInstance,
      status.apiTest.detail || "Restrição detectada no teste de integração.",
    );
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
    if (instanceNameHeldByUnfinishedCampaign(status.instanceName)) {
      markCampaignChipUnsendable(status.instanceName, "inbound-restriction-held");
      console.info(
        `[Campanha] ${status.instanceName} bloqueado para disparo (restrição inbound com chip em campanha) — troca automática.`,
      );
      return;
    }
    await markAquecedorInstanceRestricted(
      status.instanceName,
      status.sendTest.detail || "Restrição detectada na validação inbound.",
    );
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
  // Base de mensagens (planilha) removida: campanhas Alternativa usam apenas IA.
  const safeMode: DisparosConfig["messageMode"] = "ai";
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
    linkDestinationMode:
      String(input?.linkDestinationMode || "").toLowerCase().trim() === "url" ? "url" : "whatsapp",
    whatsappTargetNumber: normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || "")),
    responseUrl: normalizeDisparosResponseUrl(String(input?.responseUrl || "")),
    selectedDisparadorInstances,
    messengerImages: normalizeMessengerImagesConfig(input?.messengerImages),
  };
}

function normalizeDisparosResponseUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2000);
  return `https://${trimmed.replace(/^\/+/, "")}`.slice(0, 2000);
}

function validateDisparosLinkDestination(input: any): string | null {
  const mode =
    String(input?.linkDestinationMode || DISPAROS_DEFAULTS.linkDestinationMode).toLowerCase() ===
    "url"
      ? "url"
      : "whatsapp";
  if (mode === "whatsapp") {
    const num = normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || ""));
    if (!num) return "Campo obrigatório ausente no Disparador: whatsappTargetNumber.";
    return null;
  }
  const url = normalizeDisparosResponseUrl(String(input?.responseUrl || ""));
  if (!url || !/^https?:\/\//i.test(url)) {
    return "Campo obrigatório ausente no Disparador: responseUrl.";
  }
  return null;
}

function buildDisparosDestinationLongUrl(config: DisparosConfig, nonce: string): string {
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
    } catch {
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

async function generateUniqueShortUrlForDisparosConfig(
  config: DisparosConfig,
  publicBaseHints?: WabaPublicBaseRequestHints,
): Promise<{ shortUrl: string; longUrl: string }> {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const longUrl = buildDisparosDestinationLongUrl(config, nonce);
  const shortened = await generateShortUrlForDisparos(longUrl, publicBaseHints);
  return { shortUrl: shortened.shortUrl, longUrl };
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
    "messageMode",
  ];
  for (const key of requiredKeys) {
    if (!hasValue(key)) return `Campo obrigatório ausente no Disparador: ${key}.`;
  }
  const linkDestinationError = validateDisparosLinkDestination(input);
  if (linkDestinationError) return linkDestinationError;
  const aiRequired = ["aiTone", "aiCta", "aiAudience", "aiBriefing"];
  for (const key of aiRequired) {
    if (!hasValue(key)) return `Campo obrigatório ausente no modo IA: ${key}.`;
  }
  const images = normalizeMessengerImagesConfig(input?.messengerImages);
  if (!messengerImagesAreComplete(images)) {
    return "Envie as 4 imagens 1080×1080 px na aba Imagem do Mensageiro.";
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
const EVO_SEND_MEDIA_URL_TEMPLATE =
  process.env.EVO_SEND_MEDIA_URL_TEMPLATE || `${EVO_API_BASE}/message/sendMedia/{instance}`;
/** ~1,2 MB em base64 (4/3) — alinhado ao limite inline do Push/EVO. */
const CAMPAIGN_MEDIA_INLINE_BASE64_MAX_CHARS = Math.floor(1.2 * 1024 * 1024 * (4 / 3));
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
const AQUECEDOR_COMMAND_LOG_FILE = resolveDataFile("aquecedor-command-log.json");
const AQUECEDOR_COMMAND_LOG_MAX = 500;

type AquecedorCommandLogRow = {
  id: string;
  ownerEmail: string;
  at: string;
  message: string;
};

async function readAquecedorCommandLog(): Promise<AquecedorCommandLogRow[]> {
  try {
    const raw = await fs.readFile(AQUECEDOR_COMMAND_LOG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { items?: AquecedorCommandLogRow[] };
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function appendAquecedorCommandLog(
  message: string,
  ownerEmail?: string | null,
): Promise<void> {
  const text = String(message ?? "").trim();
  if (!text) return;
  const email = String(ownerEmail ?? "")
    .trim()
    .toLowerCase();
  const items = await readAquecedorCommandLog();
  items.unshift({
    id: crypto.randomUUID(),
    ownerEmail: email,
    at: new Date().toISOString(),
    message: text,
  });
  await fs.mkdir(path.dirname(AQUECEDOR_COMMAND_LOG_FILE), { recursive: true });
  const tmp = `${AQUECEDOR_COMMAND_LOG_FILE}.tmp`;
  await fs.writeFile(
    tmp,
    JSON.stringify({ items: items.slice(0, AQUECEDOR_COMMAND_LOG_MAX) }, null, 2),
    "utf-8",
  );
  await fs.rename(tmp, AQUECEDOR_COMMAND_LOG_FILE);
}

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
  const ownerEmail = String(params.ownerEmail ?? "")
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
    void appendAquecedorCommandLog(
      `Envio realizado: ${params.instanciaOrigem} → ${params.instanciaDestino}`,
      ownerEmail,
    );
  }
}

function aquecedorEnvioMatchesOwner(
  instanciaOrigem: string,
  instanciaDestino: string,
  allowed: Set<string> | null
): boolean {
  if (!allowed) return true;
  const origin = String(instanciaOrigem || "").trim().toLowerCase();
  const dest = String(instanciaDestino || "").trim().toLowerCase();
  if (!origin || origin === "—") return false;
  if (!allowed.has(origin)) return false;
  if (dest && dest !== "—" && !/^\d{10,15}$/.test(dest) && !allowed.has(dest)) return false;
  return true;
}

async function resolveAquecedorEnviosAllowedInstances(
  ownerEmail: string
): Promise<Set<string> | null> {
  if (!isWabaAuthConfigured()) return null;

  const names = await listAquecedorScopedInstanceNames(ownerEmail);
  const aliasesMap = await loadInstanceAliasesMap();
  const allowed = new Set<string>();
  for (const name of names) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) continue;
    allowed.add(normalized);
    const alias = mapGetInsensitive(aliasesMap, name);
    if (alias) allowed.add(alias.toLowerCase());
  }
  return allowed;
}

type AquecedorDashboardScope = {
  globalScope: boolean;
  instanceNames: string[];
  filterValues: string[];
};

async function resolveAquecedorDashboardScope(ownerEmail: string): Promise<AquecedorDashboardScope> {
  const email = String(ownerEmail || "").trim().toLowerCase();
  const names = await listAquecedorScopedInstanceNames(email);
  const aliasesMap = await loadInstanceAliasesMap();
  const filterValues: string[] = [];
  for (const name of names) {
    const normalized = String(name || "").trim();
    if (!normalized) continue;
    filterValues.push(normalized);
    const alias = mapGetInsensitive(aliasesMap, normalized);
    if (alias && alias !== normalized) filterValues.push(alias);
  }
  return { globalScope: false, instanceNames: names, filterValues };
}

function buildDadosScopeFingerprint(scope: AquecedorDashboardScope): string {
  if (scope.globalScope) return "global";
  if (!scope.instanceNames.length) return "empty";
  return scope.instanceNames.slice().sort().join("|");
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
/**
 * Janela dos contadores de equidade. Sem ela, histórico antigo (semanas) pune pares
 * veteranos para sempre: soma↔walkup tinha 281 trocas acumuladas e nunca mais era
 * escolhido — o ciclo degenerava para um "hub" (todos falam só com uma instância).
 */
const AQUECEDOR_TURN_EQUITY_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Par sem troca há mais que isso: o turno do par reinicia (qualquer lado pode iniciar).
 * 90 min (antes 6h): com intervalo 2–4 min, 6h congelava o motor quando o "devedor" saía do ciclo.
 */
const AQUECEDOR_PAIR_TURN_STALE_MS = 90 * 60 * 1000;
/** Cooldown curto ao falhar open/turno/cota — libera outros pares sem rajada de sendText. */
const AQUECEDOR_SOFT_DIRECTED_COOLDOWN_MS = 3 * 60 * 1000;
const AQUECEDOR_PICK_ATTEMPTS_MAX = 12;

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

function buildAquecedorDirectedKey(instanciaOrigem: string, instanciaDestino: string): string {
  const origem = String(instanciaOrigem || "").trim().toLowerCase();
  const destino = String(instanciaDestino || "").trim().toLowerCase();
  return `${origem}→${destino}`;
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
  const canon = canonicalizeBrazilWhatsAppNumber(normalized);
  if (canon) {
    const byCanon = numberToInstance.get(canon);
    if (byCanon) return byCanon;
  }
  for (const [stored, inst] of numberToInstance.entries()) {
    if (brazilWhatsAppNumbersMatch(stored, normalized)) return inst;
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
  _canonicalMap: Map<string, string>,
  _numberToInstance: Map<string, string>,
): Promise<Array<{ at: string; fromInst: string; toInst: string }>> {
  const events: Array<{ at: string; fromInst: string; toInst: string }> = [];
  const chipIndex = buildAquecedorChipIndex(connected);
  if (chipIndex.chips.length < 2) return events;

  const variantToChip = buildAquecedorNumberVariantToChipMap(connected);
  const nameToChip = new Map<string, string>(chipIndex.instanceToChip);
  const chipSet = new Set(chipIndex.chips);

  try {
    const { data: controle } = (await (supabase
      .from("controle_instancia" as any)
      .select("instancia, numero_whatsapp")
      .limit(500)) as any);
    for (const row of Array.isArray(controle) ? controle : []) {
      const inst = String(row?.instancia || "").trim();
      const chip = resolveNumberVariantToChip(String(row?.numero_whatsapp || ""), variantToChip);
      if (!inst || !chip || !chipSet.has(chip)) continue;
      nameToChip.set(inst.toLowerCase(), chip);
    }
  } catch {
    /* optional */
  }

  const resolveNameToChip = (rawName: string): string => {
    const key = String(rawName || "").trim().toLowerCase();
    if (!key) return "";
    return nameToChip.get(key) || "";
  };

  const historicalNames = Array.from(
    new Set([
      ...connected.map((c) => c.instancia),
      ...Array.from(nameToChip.keys()),
    ]),
  ).filter(Boolean);
  if (historicalNames.length < 2) return events;

  try {
    const { data, error } = (await (supabase
      .from("aquecedor" as any)
      .select("instancia, numero_destino, sent_at")
      .eq("status", "ENVIADO")
      .in("instancia", historicalNames)
      .order("sent_at", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK)) as any);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const fromChip = resolveNameToChip(String(row?.instancia || ""));
        const toChip = resolveNumberVariantToChip(
          String(row?.numero_destino || ""),
          variantToChip,
        );
        const at = String(row?.sent_at || "").trim();
        if (fromChip && toChip && at && chipSet.has(fromChip) && chipSet.has(toChip) && fromChip !== toChip) {
          events.push({ at, fromInst: fromChip, toInst: toChip });
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
      .in("instancia_origem", historicalNames)
      .in("instancia_destino", historicalNames)
      .order("data_envio", { ascending: false })
      .limit(AQUECEDOR_PAIR_SENDER_LOOKBACK)) as any);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const fromChip = resolveNameToChip(String(row?.instancia_origem || ""));
        const toChip = resolveNameToChip(String(row?.instancia_destino || ""));
        const at = String(row?.data_envio || "").trim();
        if (fromChip && toChip && at && chipSet.has(fromChip) && chipSet.has(toChip) && fromChip !== toChip) {
          events.push({ at, fromInst: fromChip, toInst: toChip });
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
    const key = `${ev.fromInst}|${ev.toInst}|${bucket}`;
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
  /** Último destino outbound — se sair do ciclo, libera origem para outros pares. */
  lastOutboundTo: string | null;
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
  /** Últimos envios direcionados (mais recente primeiro): origem→destino */
  recentDirectedEdges: string[];
  canSendDirected: (origemRaw: string, destinoRaw: string) => boolean;
  owesPairReply: (origemRaw: string, destinoRaw: string) => boolean;
  describeBlockReason: (origemRaw: string, destinoRaw: string) => string;
  getDirectedSendCount: (origemRaw: string, destinoRaw: string) => number;
  getOriginSendCount: (origemRaw: string) => number;
  getDestReceiveCount: (destinoRaw: string) => number;
  getUndirectedPairSendTotal: (instA: string, instB: string) => number;
  getTotalDirectedSendCount: () => number;
  /** Par (chave indireta) do evento mais recente — usado para rodízio de conversas. */
  getLastEventPairKey: () => string | null;
  scoreEquityCombination: (
    origemRaw: string,
    destinoRaw: string,
    comboIndex: number,
    startIndex: number,
    equityBaseline: {
      minPairTotal: number;
      minDirected: number;
      minOriginSend: number;
      minDestReceive: number;
    },
  ) => number;
};

async function loadAquecedorTurnManager(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
): Promise<AquecedorTurnManager> {
  const aliasesMap = await loadInstanceAliasesMap();
  const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
  const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
  const chipIndex = buildAquecedorChipIndex(connected);
  const resolveToChip = (raw: string): string => {
    const fromInstance = resolveAquecedorInstanceToChip(raw, chipIndex);
    if (fromInstance) return fromInstance;
    // Aceita chip já canônico (ex.: chaves internas / cooldowns migrados).
    const asChip = aquecedorChipKeyFromNumber(raw);
    if (asChip && chipIndex.chipToInstance.has(asChip)) return asChip;
    const key = String(raw || "").trim().toLowerCase();
    if (key && chipIndex.chipToInstance.has(key)) return key;
    return "";
  };
  const events = await loadAquecedorExchangeEvents(
    supabase,
    connected,
    canonicalMap,
    numberToInstance,
  );

  const instanceStats = new Map<string, AquecedorInstanceTurnStats>();
  const pairLastSender = new Map<string, string>();
  const pairStates = new Map<string, AquecedorPairConversationState>();
  const directedSendCounts = new Map<string, number>();
  const pairLastEventAtMs = new Map<string, number>();
  const equityWindowStartMs = Date.now() - AQUECEDOR_TURN_EQUITY_WINDOW_MS;
  const pairTurnStaleBeforeMs = Date.now() - AQUECEDOR_PAIR_TURN_STALE_MS;

  const ensureStats = (canonical: string): AquecedorInstanceTurnStats => {
    const key = canonical.toLowerCase();
    let stats = instanceStats.get(key);
    if (!stats) {
      stats = {
        canonical,
        lastSentAt: null,
        lastReceivedAt: null,
        lastReceivedFrom: null,
        lastOutboundTo: null,
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
    const evAtMs = new Date(ev.at).getTime();
    const withinEquityWindow = Number.isFinite(evAtMs) && evAtMs >= equityWindowStartMs;
    const fromStats = ensureStats(ev.fromInst);
    const toStats = ensureStats(ev.toInst);
    // Contadores de equidade só na janela recente — histórico antigo não pune o par para sempre.
    if (withinEquityWindow) {
      fromStats.sendCount += 1;
      toStats.receiveCount += 1;
      const directedKey = buildAquecedorDirectedKey(ev.fromInst, ev.toInst);
      directedSendCounts.set(directedKey, (directedSendCounts.get(directedKey) || 0) + 1);
    }
    fromStats.lastSentAt = ev.at;
    fromStats.lastOutboundTo = ev.toInst;
    toStats.lastReceivedAt = ev.at;
    toStats.lastReceivedFrom = ev.fromInst;
    fromStats.outboundSinceInbound += 1;
    toStats.outboundSinceInbound = 0;
    pairLastSender.set(buildAquecedorPairKey(ev.fromInst, ev.toInst), ev.fromInst);

    const pairKey = buildAquecedorPairKey(ev.fromInst, ev.toInst);
    if (Number.isFinite(evAtMs)) pairLastEventAtMs.set(pairKey, evAtMs);
    const pairState = ensurePairState(pairKey);
    pairState.exchangeCount += 1;
    if (pairState.pendingReplyFrom?.toLowerCase() === ev.fromInst.toLowerCase()) {
      pairState.pendingReplyFrom = null;
    } else {
      pairState.pendingReplyFrom = ev.toInst;
    }
  }

  // Par parado há muito tempo: turno reinicia (qualquer lado pode abrir a conversa).
  // Sem isso, "soma enviou por último em 08/07" bloqueava soma→walkup indefinidamente.
  for (const [pairKey, lastAtMs] of pairLastEventAtMs) {
    if (lastAtMs >= pairTurnStaleBeforeMs) continue;
    pairLastSender.delete(pairKey);
    const pairState = pairStates.get(pairKey);
    if (pairState) pairState.pendingReplyFrom = null;
  }

  // Instância sem enviar há muito tempo também não fica presa aguardando inbound antigo.
  for (const stats of instanceStats.values()) {
    const lastSentMs = stats.lastSentAt ? new Date(stats.lastSentAt).getTime() : Number.NaN;
    if (Number.isFinite(lastSentMs) && lastSentMs < pairTurnStaleBeforeMs) {
      stats.outboundSinceInbound = 0;
    }
  }

  const recentDirectedEdges: string[] = [];
  for (let i = events.length - 1; i >= 0 && recentDirectedEdges.length < 32; i -= 1) {
    const ev = events[i];
    recentDirectedEdges.push(buildAquecedorDirectedKey(ev.fromInst, ev.toInst));
  }

  const connectedChips = new Set(chipIndex.chips);

  const owesPairReply = (origemRaw: string, destinoRaw: string): boolean => {
    const origem = resolveToChip(origemRaw);
    const destino = resolveToChip(destinoRaw);
    if (!origem || !destino || origem === destino) return false;

    const pairKey = buildAquecedorPairKey(origem, destino);
    const pairState = pairStates.get(pairKey);
    return pairState?.pendingReplyFrom === origem;
  };

  const canSendDirected = (origemRaw: string, destinoRaw: string): boolean => {
    const origem = resolveToChip(origemRaw);
    const destino = resolveToChip(destinoRaw);
    if (!origem || !destino || origem === destino) return false;
    if (!connectedChips.has(origem) || !connectedChips.has(destino)) {
      return false;
    }

    const pairKey = buildAquecedorPairKey(origem, destino);
    const lastSender = pairLastSender.get(pairKey);
    if (lastSender && lastSender === origem) {
      return false;
    }

    if (owesPairReply(origemRaw, destinoRaw)) {
      return true;
    }

    const stats = instanceStats.get(origem);
    if (!stats?.lastSentAt || stats.outboundSinceInbound === 0) return true;
    // Peer do último outbound saiu do ciclo → não congelar a origem para outros pares.
    const lastTo = stats.lastOutboundTo;
    if (lastTo && !connectedChips.has(lastTo)) {
      return true;
    }
    return false;
  };

  const describeBlockReason = (origemRaw: string, destinoRaw: string): string => {
    const origem = resolveToChip(origemRaw);
    const destino = resolveToChip(destinoRaw);
    const label = (chip: string) => chipIndex.chipToInstance.get(chip) || chip;
    const pairKey = buildAquecedorPairKey(origem, destino);
    const lastSender = pairLastSender.get(pairKey);
    const stats = instanceStats.get(origem);

    if (lastSender && lastSender === origem) {
      return `${label(origem)} já enviou para ${label(destino)} e precisa aguardar resposta de ${label(destino)} no par (A→B, depois B→A).`;
    }
    if (owesPairReply(origemRaw, destinoRaw)) {
      return `${label(origem)} deve responder ${label(destino)} neste par antes de outras combinações.`;
    }
    if (stats && stats.outboundSinceInbound > 0) {
      const esperado = stats.lastReceivedFrom
        ? ` Responder a ${label(stats.lastReceivedFrom)} libera o turno global.`
        : "";
      return `${label(origem)} enviou ${stats.outboundSinceInbound} vez(es) sem receber de volta; aguardando mensagem inbound antes de novo envio.${esperado}`;
    }
    return `${label(origem) || origemRaw} não pode enviar para ${label(destino) || destinoRaw} no turno atual.`;
  };

  const lastEvent = events.length ? events[events.length - 1] : null;
  const lastEventPairKey = lastEvent
    ? buildAquecedorPairKey(lastEvent.fromInst, lastEvent.toInst)
    : null;
  const getLastEventPairKey = (): string | null => lastEventPairKey;

  const scoreEquityCombination = (
    origemRaw: string,
    destinoRaw: string,
    comboIndex: number,
    startIndex: number,
    equityBaseline: {
      minPairTotal: number;
      minDirected: number;
      minOriginSend: number;
      minDestReceive: number;
    },
  ): number => {
    const origem = resolveToChip(origemRaw);
    const destino = resolveToChip(destinoRaw);
    const directedKey = buildAquecedorDirectedKey(origem, destino);
    const directed = directedSendCounts.get(directedKey) ?? 0;
    const pairTotal = getUndirectedPairSendTotal(origem, destino);
    const oSend = instanceStats.get(origem)?.sendCount ?? 0;
    const oRecv = instanceStats.get(origem)?.receiveCount ?? 0;
    const dRecv = instanceStats.get(destino)?.receiveCount ?? 0;
    const dSend = instanceStats.get(destino)?.sendCount ?? 0;
    const replyDue = owesPairReply(origemRaw, destinoRaw);

    let score = 0;
    // Rodízio de conversas: o par que acabou de trocar cede a vez — EXCETO se a resposta
    // do turno ainda está pendente (senão o destinatário nunca devolve e só recebe).
    if (
      lastEventPairKey &&
      buildAquecedorPairKey(origem, destino) === lastEventPairKey &&
      !replyDue
    ) {
      score += 1e18;
    }
    // Completar o turno do par tem prioridade absoluta sobre rodízio/volume.
    if (replyDue) {
      score -= 2e18;
    }
    // Primário: rodízio LRU por par — quem trocou há MAIS tempo vai primeiro.
    // Garante que todos os pares circulem continuamente (frequências iguais →
    // enviados/recebidos convergem), sem pausar um par por horas para "compensar".
    const pairLastAtMs = pairLastEventAtMs.get(buildAquecedorPairKey(origem, destino)) ?? 0;
    const recencyMinutes = Math.max(0, (pairLastAtMs - equityWindowStartMs) / 60_000);
    score += recencyMinutes * 1_000_000_000_000;
    // Equidade por volume do par na janela — desempate.
    score += (pairTotal - equityBaseline.minPairTotal) * 1_000_000_000;
    score += (directed - equityBaseline.minDirected) * 1_000_000;
    score += (oSend - equityBaseline.minOriginSend) * 1_000;
    score += (dRecv - equityBaseline.minDestReceive) * 100;
    // Quem recebe muito e envia pouco deve ser origem; quem já está saturado de inbox
    // deve deixar de ser destino preferencial (ex.: 6011 só recebendo).
    score += (oSend - oRecv) * 50_000_000;
    score += (dRecv - dSend) * 10_000_000;

    const recentIdx = recentDirectedEdges.indexOf(directedKey);
    if (recentIdx >= 0) {
      score += (recentIdx + 1) * 10;
    }

    const rotation = ((comboIndex - startIndex) % 1000 + 1000) % 1000;
    score += rotation * 0.001;
    return score;
  };

  const getDirectedSendCount = (origemRaw: string, destinoRaw: string): number => {
    const origem = resolveToChip(origemRaw);
    const destino = resolveToChip(destinoRaw);
    if (!origem || !destino) return 0;
    return directedSendCounts.get(buildAquecedorDirectedKey(origem, destino)) ?? 0;
  };

  const getOriginSendCount = (origemRaw: string): number =>
    instanceStats.get(resolveToChip(origemRaw))?.sendCount ?? 0;

  const getDestReceiveCount = (destinoRaw: string): number =>
    instanceStats.get(resolveToChip(destinoRaw))?.receiveCount ?? 0;

  const getUndirectedPairSendTotal = (instA: string, instB: string): number =>
    getDirectedSendCount(instA, instB) + getDirectedSendCount(instB, instA);

  const getTotalDirectedSendCount = (): number => {
    let total = 0;
    for (const count of directedSendCounts.values()) total += count;
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
    getLastEventPairKey,
    scoreEquityCombination,
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

async function ensureAquecedorOwnerConversationGraph(
  ownerEmail: string,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
): Promise<Awaited<ReturnType<typeof getOwnerConversationGraph>>> {
  const chipIndex = buildAquecedorChipIndex(connected);
  const chipKeys = chipIndex.chips;
  if (chipKeys.length < 2) {
    return getOwnerConversationGraph(ownerEmail);
  }
  const aliasesMap = await loadInstanceAliasesMap();
  const canonicalMap = buildAquecedorInstanceCanonicalMap(connected, aliasesMap);
  const numberToInstance = buildAquecedorNumberToInstanceMap(connected, canonicalMap);
  const existing = await getOwnerConversationGraph(ownerEmail);
  const needsChipIdentity = existing.identityMode !== "chip";
  if (!existing.bootstrapped || needsChipIdentity) {
    const events = await loadAquecedorExchangeEvents(
      supabase,
      connected,
      canonicalMap,
      numberToInstance,
    );
    await bootstrapOwnerGraphFromEvents(ownerEmail, events, {
      force: needsChipIdentity,
      instanceNames: chipKeys,
      identityMode: "chip",
    });
  } else {
    await ensureCompletePairGraph(ownerEmail, chipKeys);
  }
  return getOwnerConversationGraph(ownerEmail);
}

async function pickAquecedorCombinationAsync<T extends { instancia_origem: string; instancia_destino: string }>(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  connected: Array<{ instancia: string; numero: string }>,
  combinations: T[],
  startIndex: number,
  ownerEmail?: string,
  extraBlockedDirectedKeys?: Set<string>,
): Promise<{
  chosen: T;
  index: number;
  pickMeta: NonNullable<ReturnType<typeof pickNextDirectedExchange>>;
} | null> {
  if (!combinations.length || connected.length < 2) return null;
  const owner = normalizeAquecedorOwnerEmail(ownerEmail || "") || "default";
  const chipIndex = buildAquecedorChipIndex(connected);
  const graph = await ensureAquecedorOwnerConversationGraph(owner, supabase, connected);
  const eligibleChips = chipIndex.chips;
  const turn = await loadAquecedorTurnManager(supabase, connected);
  const blocked = await listBlockedDirectedKeys();
  if (extraBlockedDirectedKeys?.size) {
    for (const key of extraBlockedDirectedKeys) blocked.add(key);
  }
  for (const combo of combinations) {
    if (!turn.canSendDirected(combo.instancia_origem, combo.instancia_destino)) {
      blocked.add(buildDirectedCooldownKey(combo.instancia_origem, combo.instancia_destino));
    }
  }
  // Cooldowns legados por nome → também bloquear pelo chip.
  const blockedForPick = new Set<string>(blocked);
  for (const key of blocked) {
    const parts = String(key || "").split("→");
    if (parts.length !== 2) continue;
    const oChip = resolveAquecedorInstanceToChip(parts[0], chipIndex);
    const dChip = resolveAquecedorInstanceToChip(parts[1], chipIndex);
    if (oChip && dChip) blockedForPick.add(buildDirectedCooldownKey(oChip, dChip));
  }
  for (const combo of combinations) {
    const oChip = resolveAquecedorInstanceToChip(combo.instancia_origem, chipIndex);
    const dChip = resolveAquecedorInstanceToChip(combo.instancia_destino, chipIndex);
    if (
      oChip &&
      dChip &&
      blocked.has(buildDirectedCooldownKey(combo.instancia_origem, combo.instancia_destino))
    ) {
      blockedForPick.add(buildDirectedCooldownKey(oChip, dChip));
    }
  }

  const pick = pickNextDirectedExchange(graph, eligibleChips, {
    startIndex,
    blockedDirectedKeys: blockedForPick,
  });
  if (!pick) return null;

  for (let index = 0; index < combinations.length; index += 1) {
    const combo = combinations[index];
    const oChip = resolveAquecedorInstanceToChip(combo.instancia_origem, chipIndex);
    const dChip = resolveAquecedorInstanceToChip(combo.instancia_destino, chipIndex);
    if (oChip && dChip && oChip === pick.origem && dChip === pick.destino) {
      return { chosen: combo, index, pickMeta: pick };
    }
  }
  return null;
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

  const numDestino = resolveAquecedorInstanceDigits(destino.numero);
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
  const numA = resolveAquecedorInstanceDigits(String(pair.numeroOrigem || "").trim());
  const numB = resolveAquecedorInstanceDigits(String(pair.numeroDestino || "").trim());
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
      const numDest = resolveAquecedorInstanceDigits(String(row?.numero_destino || "").trim());
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

async function releaseStuckAquecedorQueueRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  _scopedInstanceNames?: string[],
): Promise<void> {
  const cutoff = new Date(Date.now() - AQUECEDOR_QUEUE_STUCK_MS).toISOString();
  const resetPayload = {
    status: "PENDENTE",
    processing_at: null,
    sent_at: null,
  };

  // Sempre libera PROCESSANDO travado em QUALQUER instancia.
  // Se filtrar só pelo escopo atual, órfãos (ex.: 6973 fora do ciclo) ficam
  // PROCESSANDO por dias e a UI mostra "há 1600+ min".
  await (supabase.from("aquecedor" as any) as any)
    .update(resetPayload)
    .eq("status", "PROCESSANDO")
    .lt("processing_at", cutoff);

  await (supabase.from("aquecedor" as any) as any)
    .update(resetPayload)
    .eq("status", "PROCESSANDO")
    .is("processing_at", null)
    .lt("scheduled_at", cutoff);
}

async function fetchProcessableAquecedorPending(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  scopedInstanceNames: string[],
  preferredOrigem?: string | null,
) {
  const scoped = scopedInstanceNames.map((n) => String(n || "").trim()).filter(Boolean);
  if (!scoped.length) return null;

  const now = new Date().toISOString();
  const preferred = String(preferredOrigem || "").trim();

  if (preferred) {
    const { data: preferredRow } = (await (supabase
      .from("aquecedor" as any)
      .select("id, mensagem, status, scheduled_at")
      .eq("status", "PENDENTE")
      .eq("instancia", preferred)
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle())) as any;
    if (preferredRow?.id) return preferredRow;
  }

  const { data } = (await (supabase
    .from("aquecedor" as any)
    .select("id, mensagem, status, scheduled_at")
    .eq("status", "PENDENTE")
    .in("instancia", scoped)
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
  if (!pair?.instanciaOrigem) {
    return { ok: true };
  }
  const origem = String(pair.instanciaOrigem).trim();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const { count: processableCount, error: processableError } = (await (supabase
    .from("aquecedor" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDENTE")
    .eq("instancia", origem)
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
    .eq("instancia", origem)
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
    const exclude = await buildAquecedorExcludeSet(supabase, pair);
    const current = String(oldestPending.mensagem || "").trim();
    let mensagem: string | undefined;
    if (!current || isAquecedorSystemMessage(current) || exclude.has(current)) {
      mensagem = await pickAquecedorMessageText(supabase, exclude);
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

  const exclude = await buildAquecedorExcludeSet(supabase, pair);
  const mensagem = await pickAquecedorMessageText(supabase, exclude);

  // Reaproveita órfãos (instancia null) de reverts antigos — evita 2º registro Em Fila.
  const { data: orphan } = (await (supabase
    .from("aquecedor" as any)
    .select("id")
    .eq("status", "PENDENTE")
    .is("instancia", null)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle())) as any;
  if (orphan?.id) {
    const { error: claimError } = await (supabase.from("aquecedor" as any) as any)
      .update({
        mensagem,
        scheduled_at: now,
        instancia: origem,
        numero_destino: null,
        processing_at: null,
        sent_at: null,
      })
      .eq("id", orphan.id)
      .eq("status", "PENDENTE");
    if (!claimError) return { ok: true, pendingId: orphan.id };
  }

  const { data: inserted, error: insertError } = await (supabase.from("aquecedor" as any) as any)
    .insert({
      mensagem,
      status: "PENDENTE",
      scheduled_at: now,
      instancia: origem,
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
  waitMinSeconds: 300,
  waitMaxSeconds: 900,
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
  linkDestinationMode: "whatsapp" | "url";
  whatsappTargetNumber: string;
  responseUrl: string;
  selectedDisparadorInstances: string[];
  /** Quatro imagens 1080×1080 para variação no envio (Alternativa). */
  messengerImages: CampaignMessengerImageMeta[];
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
  /** Motivo legível da última pausa (saúde, créditos, manual, etc.). */
  pauseReason?: string;
  configSnapshot: DisparosConfig;
};

type CampaignInstanceHealth = {
  selectedCount: number;
  connectedCount: number;
  disconnectedCount: number;
  disconnectedPercent: number;
  shouldPauseByDisconnectedRatio: boolean;
  minConnectedRequired: number;
  needsMoreInstancesForMinimum: boolean;
  missingConnectedForMinimum: number;
  /** Conectadas, fora da campanha, habilitadas para disparo — usadas na troca automática. */
  spareConnectedForSwap?: number;
};

type LeadFailureKind = "invalid_phone" | "destination_error" | "send_error";

type DisparosCampaignLead = {
  id: string;
  campaignId: string;
  phone: string;
  status: "pending" | "sending" | "sent" | "failed";
  messageText?: string;
  shortUrl?: string;
  /** Preenchido quando status === "failed" (envio na mesma execução); leads antigos sem valor caem em send_error no relatório. */
  failureKind?: LeadFailureKind;
  /** sendMedia já aceito neste lead — não reenviar imagem se o botão falhar. */
  mediaMessageId?: string;
  /** Instância que enviou a imagem; o botão precisa ir no mesmo chip. */
  mediaInstanceName?: string;
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
  aiCta: "Quero saber mais",
  aiAudience: "CORBAN",
  shortenerProvider: "waba",
  shortenerDomain: "",
  linkDestinationMode: "whatsapp",
  whatsappTargetNumber: "",
  responseUrl: "",
  selectedDisparadorInstances: [],
  messengerImages: [],
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
          pauseReason: c.pauseReason || "",
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
          mediaMessageId: l.mediaMessageId,
          mediaInstanceName: l.mediaInstanceName,
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
        pauseReason: String(c?.pauseReason || "").trim() || undefined,
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
        mediaMessageId: typeof l?.mediaMessageId === "string" ? l.mediaMessageId : undefined,
        mediaInstanceName: typeof l?.mediaInstanceName === "string" ? l.mediaInstanceName : undefined,
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
/** Cooldown de envio por chip da campanha (não trava os outros números). */
const campaignInstanceNextSendAt = new Map<string, number>();
/** Envios confirmados nesta campanha, por instância (balanço). */
const campaignInstanceSendCounts = new Map<string, Map<string, number>>();
const campaignAutoSwapAtMs = new Map<string, number>();
const CAMPAIGN_AUTO_SWAP_COOLDOWN_MS = 45_000;
const CAMPAIGN_BLOCKED_INSTANCE_TTL_MS = 3 * 60 * 60 * 1000;
const campaignBlockedInstanceUntilMs = new Map<string, number>();

function campaignBlockedInstanceKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
}

function markCampaignInstanceBlocked(instanceName: string, reason: string): void {
  const key = campaignBlockedInstanceKey(instanceName);
  if (!key) return;
  campaignBlockedInstanceUntilMs.set(key, Date.now() + CAMPAIGN_BLOCKED_INSTANCE_TTL_MS);
  console.warn(
    `[Campanha] chip ${instanceName} tratado como bloqueado (${reason}) — troca automática.`,
  );
}

/** Inapto a enviar: vermelho na campanha, tag Restrição persistida, entra na troca 1:1. */
function markCampaignChipUnsendable(instanceName: string, reason: string): void {
  markCampaignInstanceBlocked(instanceName, reason);
  void markWhatsappRestrictionExplicit(instanceName, reason);
}

function isCampaignInstanceBlocked(instanceName: string): boolean {
  const key = campaignBlockedInstanceKey(instanceName);
  if (!key) return false;
  const until = campaignBlockedInstanceUntilMs.get(key) || 0;
  if (until <= Date.now()) {
    campaignBlockedInstanceUntilMs.delete(key);
    return false;
  }
  return true;
}

function isEvoSenderBanHttp(status: number, body: string): boolean {
  if (Number(status) === 403) return true;
  const b = String(body || "").toLowerCase();
  return (
    (b.includes("statusreason") && b.includes("403")) ||
    /\b(banned|banished|whatsapp.*restrict)\b/.test(b)
  );
}
/** Round-robin de imagens 1080×1080 por campanha (Alternativa). */
const campaignMessengerImageCursor = new Map<string, number>();
/** Evita dois processamentos paralelos da mesma campanha (tick a cada 7s vs typing/IA). */
const campaignDispatchBusy = new Set<string>();
let campaignDispatchTickRunning = false;
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
  const pushUnique = (p: DisparosConfig["shortenerProvider"]) => {
    if (!order.includes(p)) order.push(p);
  };
  // Fallbacks gratuitos/resilientes — evita «Não foi possível gerar link curto» quando um provedor cai.
  pushUnique("waba");
  if (String(process.env.ENCURTADORPRO_API_KEY || "").trim()) {
    pushUnique("encurtadorpro");
  }
  pushUnique("isgd");
  pushUnique("tinyurl");
  return order;
}

let aquecedorCycleMotor: AquecedorOwnerMotor | null = null;

function aquecedorCycleRuntime(): AquecedorRuntimeStatus {
  if (!aquecedorCycleMotor) {
    throw new Error("Ciclo do aquecedor sem motor de proprietário.");
  }
  return aquecedorCycleMotor.runtime;
}

const AQUECEDOR_CYCLE_TICK_MIN_MS = 5_000;
const AQUECEDOR_CYCLE_TICK_MAX_MS = 30_000;
const AQUECEDOR_PROCESSING_STALE_MS = 8 * 60 * 1000;
const AQUECEDOR_QUEUE_STUCK_MS = 3 * 60 * 1000;
const AQUECEDOR_WORKER_SYNC_MS = 12_000;

function getAquecedorWorkerId(): string {
  return AQUECEDOR_OWNER_WORKER_ID;
}

function computeAquecedorNextCycleDelayMs(runtime: AquecedorRuntimeStatus): number {
  if (runtime.nextAllowedAt) {
    const nextMs = new Date(runtime.nextAllowedAt).getTime();
    if (Number.isFinite(nextMs)) {
      const delta = nextMs - Date.now();
      if (delta > 0) {
        return Math.min(AQUECEDOR_CYCLE_TICK_MAX_MS, Math.max(AQUECEDOR_CYCLE_TICK_MIN_MS, delta));
      }
      return AQUECEDOR_CYCLE_TICK_MIN_MS;
    }
  }
  return 15_000;
}

function scheduleAquecedorCycleTick(ownerEmail: string): void {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  if (!motor.runtime.running || !ENABLE_AQUECEDOR_PROCESSING) return;
  if (motor.scheduleTimer) clearTimeout(motor.scheduleTimer);
  const delay = computeAquecedorNextCycleDelayMs(motor.runtime);
  motor.scheduleTimer = setTimeout(() => {
    motor.scheduleTimer = null;
    if (!motor.runtime.running) return;
    void runAquecedorCycle(ownerEmail).finally(() => scheduleAquecedorCycleTick(ownerEmail));
  }, delay);
}

async function syncAquecedorWorkerLeadership(): Promise<void> {
  if (!ENABLE_AQUECEDOR_PROCESSING || MAINTENANCE_MODE) return;
  await reloadAquecedorOwnerMotorsFromDisk(true);

  for (const ownerEmail of listAquecedorOwnerEmails()) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    if (motor.desired !== true) {
      stopAquecedorOwnerMotorLocal(ownerEmail);
      applyPersistedSnapshotToMotor(motor, motor.snapshot);
      continue;
    }

    if (shouldProcessLeadOwnerMotor(motor)) {
      // desired=true basta: retoma timer mesmo sem sessão HTTP (logout não pode parar envios).
      motor.snapshot.running = true;
      if (!motor.runtime.running) {
        applyPersistedSnapshotToMotor(motor, {
          ...motor.snapshot,
          running: true,
        });
      }
      startAquecedorRuntimeLocal(ownerEmail);
      motor.snapshot.workerId = getAquecedorWorkerId();
      motor.snapshot.workerHeartbeatAt = new Date().toISOString();
      await persistAquecedorOwnerSnapshot(ownerEmail, {
        running: true,
        workerId: motor.snapshot.workerId,
        workerHeartbeatAt: motor.snapshot.workerHeartbeatAt,
      });
      continue;
    }

    // Outro worker tem lease válido — só pausa timer local; não grava desired=false.
    applyPersistedSnapshotToMotor(motor, motor.snapshot);
    stopAquecedorOwnerMotorLocal(ownerEmail);
  }
}

function startAquecedorRuntimeLocal(ownerEmail: string): void {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  if (!ENABLE_AQUECEDOR_PROCESSING) {
    motor.runtime.running = false;
    motor.runtime.lastResult =
      "Aquecedor desativado neste processo (ENABLE_AQUECEDOR_PROCESSING=false).";
    return;
  }
  if (motor.runtime.running && motor.scheduleTimer) return;
  motor.runtime.running = true;
  void runAquecedorCycle(ownerEmail).finally(() => scheduleAquecedorCycleTick(ownerEmail));
}

async function stopAquecedorRuntimeForOwner(ownerEmail: string): Promise<void> {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  stopAquecedorOwnerMotorLocal(ownerEmail);
  motor.runtime.lastResult = "Aquecedor parado.";
  await persistAquecedorOwnerIntent(ownerEmail, false);
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

async function ensureAquecedorInstanceRegistered(
  instanceName: string,
  options?: { forceNewIntegration?: boolean },
): Promise<void> {
  try {
    const name = String(instanceName || "").trim();
    if (!name) return;
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
    const cacheRow = (cache?.items || []).find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    const preparingSince = cacheRow?.createdAt ? String(cacheRow.createdAt) : null;
    const forceNew = options?.forceNewIntegration === true;
    if (forceNew) {
      // Data desta integração = agora (evita createdAt EVO legado promover Preparando na hora).
      await registerAquecedorInstancePreparing(name, new Date().toISOString(), {
        forceNewIntegration: true,
      });
      return;
    }
    // Sem createdAt (create EVO ainda pendente): não grandfather como active.
    if (!preparingSince) {
      const existing = await findAquecedorLifecycleRow(name);
      if (existing) {
        await registerAquecedorInstancePreparing(name);
      }
      return;
    }
    await registerAquecedorInstancePreparing(name, preparingSince);
  } catch (error) {
    console.warn("[Aquecedor] ensureAquecedorInstanceRegistered:", error);
  }
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
    for (const row of toRegister) {
      if (row.useAquecedor) {
        await registerAquecedorInstancePreparing(row.instanceName, new Date().toISOString(), {
          forceNewIntegration: true,
        });
      }
    }
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

/** Live EVO é fonte de verdade; cache só preenche número quando a instância está conectada agora. */
function mergeAquecedorConnectedRows(
  live: Array<{ instancia: string; numero: string }>,
  cache: Array<{ instancia: string; numero: string }>,
): {
  rows: Array<{ instancia: string; numero: string }>;
  usedCacheOnlyForNumbers: boolean;
} {
  const cacheByKey = new Map<string, { instancia: string; numero: string }>();
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
      .filter((row): row is { instancia: string; numero: string } => row != null)
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

async function filterAquecedorRowsByEvoLiveOpen<T extends { instancia: string }>(
  rows: T[],
): Promise<{ rows: T[]; ghostOpenSummary: string | null }> {
  const filtered: T[] = [];
  const ghost: string[] = [];
  for (const row of rows) {
    let liveState = await fetchEvoInstanceLiveState(row.instancia);
    if (!String(liveState || "").trim()) {
      liveState = await fetchEvoInstanceLiveState(row.instancia, { fresh: true });
    }
    if (aquecedorLiveStateAllowsConnected(liveState)) {
      filtered.push(row);
    } else {
      ghost.push(`${row.instancia}(${liveState || "desconhecido"})`);
    }
  }
  return {
    rows: filtered,
    ghostOpenSummary: ghost.length
      ? `${ghost.length} instância(s) aparecem no fetchInstances mas connectionState≠open: ${ghost.slice(0, 8).join(", ")}`
      : null,
  };
}

async function listMergedConnectedEvoInstancesUnscoped(): Promise<{
  rows: Array<{ instancia: string; numero: string }>;
  liveCount: number;
  cacheCount: number;
  evoOk: boolean;
  evoError?: string;
  usedCacheOnlyForNumbers: boolean;
  evoGhostOpenSummary?: string | null;
  evoFetchOpenCount?: number;
  evoLiveOpenCount?: number;
}> {
  const evoList = await fetchEvoInstancesList();
  const cache = await loadEvoInstancesCache();
  const fromLive = evoList.ok ? buildConnectedFromEvoResponse(evoList.instances) : [];
  const fromCache = cache?.items?.length ? buildConnectedFromEvoCacheItems(cache.items) : [];
  const merged = mergeAquecedorConnectedRows(fromLive, fromCache);
  const verified = await filterAquecedorRowsByEvoLiveOpen(merged.rows);
  const deduped = dedupeAquecedorConnectedByNumber(verified.rows);
  const snapshots =
    evoList.ok && evoList.instances.length
      ? await resolveEvoLiveConnectionSnapshots(evoList.instances)
      : [];
  return {
    rows: deduped,
    liveCount: fromLive.length,
    cacheCount: fromCache.length,
    evoOk: evoList.ok,
    evoError: evoList.ok ? undefined : evoList.detail,
    usedCacheOnlyForNumbers: merged.usedCacheOnlyForNumbers,
    evoGhostOpenSummary: verified.ghostOpenSummary,
    evoFetchOpenCount: snapshots.filter((row) => row.fetchStatus.includes("open")).length,
    evoLiveOpenCount: snapshots.filter((row) => row.trulyOpen).length,
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
      const numero = resolveAquecedorInstanceDigits(String(item?.number || "").trim());
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
  evoGhostOpenSummary?: string | null;
  evoFetchOpenCount?: number;
  evoLiveOpenCount?: number;
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

  connected = await filterAquecedorConnectedByOutboundHealth(connected);

  const usedCacheSupplement =
    mergedEvo.evoOk &&
    mergedEvo.usedCacheOnlyForNumbers &&
    connected.length > mergedEvo.liveCount &&
    mergedEvo.liveCount > 0;

  return {
    connected,
    source: mergedEvo.evoOk ? "evo-live" : "evo-cache",
    evoDegraded: !mergedEvo.evoOk || usedCacheSupplement || Boolean(mergedEvo.evoGhostOpenSummary),
    evoError: mergedEvo.evoError,
    evoGhostOpenSummary: mergedEvo.evoGhostOpenSummary,
    evoFetchOpenCount: mergedEvo.evoFetchOpenCount,
    evoLiveOpenCount: mergedEvo.evoLiveOpenCount,
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

function campaignInstanceGateKey(campaignId: string, instanceName: string): string {
  return `${String(campaignId || "").trim()}::${String(instanceName || "").trim().toLowerCase()}`;
}

function getCampaignInstanceSendCount(campaignId: string, instanceName: string): number {
  const camp = String(campaignId || "").trim();
  const key = String(instanceName || "").trim().toLowerCase();
  if (!camp || !key) return 0;
  return campaignInstanceSendCounts.get(camp)?.get(key) || 0;
}

function recordCampaignInstanceSend(campaignId: string, instanceName: string): void {
  const camp = String(campaignId || "").trim();
  const key = String(instanceName || "").trim().toLowerCase();
  if (!camp || !key) return;
  let bucket = campaignInstanceSendCounts.get(camp);
  if (!bucket) {
    bucket = new Map<string, number>();
    campaignInstanceSendCounts.set(camp, bucket);
  }
  bucket.set(key, (bucket.get(key) || 0) + 1);
}

function isCampaignInstanceInCooldown(campaignId: string, instanceName: string): boolean {
  const until = campaignInstanceNextSendAt.get(campaignInstanceGateKey(campaignId, instanceName)) || 0;
  return Date.now() < until;
}

function resolveSelectedDisparadorToEvoName(
  name: string,
  connected: Array<{ instancia: string; numero: string }>,
): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const exact = connected.find((c) => String(c.instancia || "").trim().toLowerCase() === lower);
  if (exact) return String(exact.instancia || "").trim() || raw;
  const digits = raw.replace(/\D/g, "");
  const tail = digits.length >= 4 ? digits.slice(-4) : "";
  if (!tail) return raw;
  const hits = connected.filter((c) => {
    const instDigits = String(c.instancia || "").replace(/\D/g, "");
    const numDigits = String(c.numero || "").replace(/\D/g, "");
    return instDigits.endsWith(tail) || numDigits.endsWith(tail);
  });
  if (hits.length === 1) return String(hits[0].instancia || "").trim() || raw;
  return raw;
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

function scaleOfficialCampaignSendInterval(config: DisparosConfig): DisparosConfig {
  const minS = Math.max(
    10,
    Math.round(
      (Number(config.delayMinSeconds) || DISPAROS_DEFAULTS.delayMinSeconds) *
        CAMPAIGN_SEND_INTERVAL_RATIO,
    ),
  );
  const maxS = Math.max(
    minS,
    Math.round(
      (Number(config.delayMaxSeconds) || DISPAROS_DEFAULTS.delayMaxSeconds) *
        CAMPAIGN_SEND_INTERVAL_RATIO,
    ),
  );
  return { ...config, delayMinSeconds: minS, delayMaxSeconds: maxS };
}

function campaignDispatchPacingConfig(
  config: DisparosConfig,
  alternativaMotor: boolean,
): DisparosConfig {
  return alternativaMotor
    ? applyAlternativaDispatchProfile(config)
    : scaleOfficialCampaignSendInterval(config);
}

async function resolveDispatchCreditsApiKindForOwner(
  ownerEmail: string
): Promise<WabaDispatchesApiKind> {
  const normalized = String(ownerEmail || "").trim().toLowerCase();
  if (!normalized.includes("@")) return "oficial";
  if (isBetsSubscriberEmail(normalized)) return "oficial";
  const summary = disparosCreditsService.getCreditsSummary(normalized);
  if (summary.activeApiKind === "alternativa") return "alternativa";
  if (summary.byApi.alternativa.remainingShipments > 0) return "alternativa";
  if (isAlternativaNumbersPurchaseEnabled()) {
    const purchased = alternativaNumbersService.getPurchasedSlots(normalized);
    const activated = alternativaActivationRepository.listForEmail(normalized).length;
    if (purchased > 0 || activated > 0) return "alternativa";
  }
  return resolveSubscriberDispatchesApiKindFromOrders(normalized);
}

function debitsDisparosCreditsOnCampaignCreate(apiKind: WabaDispatchesApiKind): boolean {
  return apiKind === "oficial";
}

function debitsDisparosCreditsPerSuccessfulSend(apiKind: WabaDispatchesApiKind): boolean {
  return apiKind === "alternativa";
}

async function shouldApplyAlternativaDispatchProfile(email: string): Promise<boolean> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  if (isBetsSubscriberEmail(normalized)) return false;
  if (isAlternativaNumbersPurchaseEnabled()) {
    const purchased = alternativaNumbersService.getPurchasedSlots(normalized);
    const activated = alternativaActivationRepository.listForEmail(normalized).length;
    if (purchased > 0 || activated > 0) return true;
  }
  const creditsApiKind = await resolveDispatchCreditsApiKindForOwner(normalized);
  return creditsApiKind === "alternativa";
}

async function assertAlternativaDispatchReady(email: string): Promise<void> {
  if (!isAlternativaNumbersPurchaseEnabled()) return;
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
  _config: AquecedorConfig,
  ownerEmail: string,
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
    ownerEmail,
  );
  const chosen = picked?.chosen ?? combinations[0] ?? null;
  const proximo = picked ? picked.index + 1 : 1;
  if (!chosen) {
    aquecedorCycleRuntime().lastResult =
      "Teste: nenhum par disponível (é necessário ao menos 2 instâncias ativas no Aquecedor).";
    return;
  }

  const openCheck = await assertAquecedorInstancesOpenForSend(
    chosen.instancia_origem,
    chosen.instancia_destino,
  );
  if (!openCheck.ok) {
    aquecedorCycleRuntime().lastResult = `Ciclo teste abortado: ${openCheck.reason}`;
    return;
  }

  const deliveryTag = buildAquecedorDeliveryTag();
  const texto = appendAquecedorDeliveryTag("Mensagem de teste do aquecedor.", deliveryTag);
  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
  const numero = resolveAquecedorInstanceDigits(chosen.numero_whatsapp);
  if (!numero || numero.length < 10) {
    aquecedorCycleRuntime().lastResult = `Ciclo teste abortado: destino ${chosen.instancia_destino} sem número WhatsApp válido.`;
    return;
  }
  // Evolution 2.3.x exige `text` na raiz (textMessage sozinho → 400).
  const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
    ? { number: numero, textMessage: { text: texto } }
    : { number: numero, text: texto };
  const sendStartedAtMs = Date.now();
  // Envio teste: 2 tentativas (UI ~3 min); ciclo automático mantém retry mais longo.
  const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 2);
  const origemConnected = connected.find(
    (item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase(),
  );
  if (sendResult.ok) {
    let numeroOrigem = resolveAquecedorInstanceDigits(String(origemConnected?.numero || ""));
    if (!numeroOrigem) {
      try {
        numeroOrigem = resolveAquecedorInstanceDigits(
          (await resolveEvoInstancePhone(chosen.instancia_origem)) || "",
        );
      } catch {
        /* opcional */
      }
    }
    const messageId = extractAquecedorSendMessageId(sendResult.json);
    const ackProbe = messageId
      ? await probeAquecedorSendAckStatus(chosen.instancia_origem, messageId, {
          maxAttempts: 5,
          intervalMs: 2000,
        })
      : { status: "UNKNOWN" as EvoMessageAckStatus };
    const deliveryCheck = await verifyAquecedorMessageDelivered(
      chosen.instancia_destino,
      numeroOrigem,
      texto,
      {
        instanciaOrigem: chosen.instancia_origem,
        numeroDestino: numero,
        sendStartedAtMs,
        // Janela maior: 2477/@lid costuma indexar findMessages depois do app WhatsApp.
        maxAttempts: 12,
        attemptIntervalMs: 2500,
        skipInitialDelay: false,
        relaxTimestampOnLastAttempt: true,
        ackStatusHint: ackProbe.status,
        messageId,
      },
    );
    if (!deliveryCheck.ok) {
      aquecedorCycleRuntime().lastEvoError = {
        status: sendResult.status,
        body: deliveryCheck.detail.slice(0, 500),
        instance: chosen.instancia_destino,
        numeroLen: numero.length,
      };
      aquecedorCycleRuntime().lastResult = `Ciclo teste: ${chosen.instancia_origem} → ${chosen.instancia_destino} NÃO confirmado no WhatsApp. ${deliveryCheck.detail.slice(0, 180)}`;
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
      await recordDirectedSend({
        ownerEmail,
        fromInst:
          aquecedorChipKeyFromNumber(
            connected.find((c) => c.instancia === chosen.instancia_origem)?.numero || "",
          ) || chosen.instancia_origem,
        toInst:
          aquecedorChipKeyFromNumber(chosen.numero_whatsapp || "") || chosen.instancia_destino,
      });
      aquecedorCycleRuntime().lastEvoError = null;
      aquecedorCycleRuntime().lastResult = `Ciclo teste: ${chosen.instancia_origem} → ${chosen.instancia_destino} enviado com sucesso.`;
    }
  } else {
    aquecedorCycleRuntime().lastEvoError = {
      status: sendResult.status,
      body: String(sendResult.body || "").slice(0, 500),
      instance: chosen.instancia_origem,
      numeroLen: numero.length,
    };
    const detail = String(sendResult.body || (sendResult as { error?: string }).error || "").slice(0, 160);
    aquecedorCycleRuntime().lastResult = `Ciclo teste falhou: ${chosen.instancia_origem} → ${chosen.instancia_destino}. EVO HTTP ${sendResult.status}${detail ? `: ${detail}` : ""}.`;
  }
  if (aquecedorCycleMotor) {
    setAquecedorOwnerCicloGlobal(aquecedorCycleMotor, proximo);
  }
}

function deferAquecedorOutsideWindow(config: AquecedorConfig, fromSp: Date): void {
  const nextOpen = nextAquecedorWindowOpenAt(config, fromSp);
  aquecedorCycleRuntime().nextAllowedAt = nextOpen ? nextOpen.toISOString() : null;
  aquecedorCycleRuntime().lastResult = nextOpen
    ? `Fora da janela humanizada. Próximo retorno previsto: ${formatDateBr(nextOpen.toISOString())}.`
    : "Fora da janela humanizada.";
}

function deferAquecedorRetryOrWindow(
  config: AquecedorConfig,
  nowSp: Date,
  retrySeconds: number,
  retryReason: string,
): void {
  if (!isAquecedorWindowOpen(config, nowSp)) {
    deferAquecedorOutsideWindow(config, nowSp);
    return;
  }
  const boundedRetry = Math.max(15, Math.min(300, Math.floor(retrySeconds)));
  aquecedorCycleRuntime().nextAllowedAt = new Date(Date.now() + boundedRetry * 1000).toISOString();
  aquecedorCycleRuntime().lastResult = retryReason;
}

async function waitAquecedorCycleIdle(ownerEmail: string, maxWaitMs = 45_000): Promise<boolean> {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const started = Date.now();
  while (motor.runtime.isProcessing) {
    if (Date.now() - started >= maxWaitMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return true;
}

async function runAquecedorCycle(ownerEmail: string, forceTest = false) {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  aquecedorCycleMotor = motor;
  const runtime = motor.runtime;
  if (runtime.isProcessing) {
    if (!forceTest) return;
    // Envio teste não pode abortar em silêncio enquanto o ciclo automático roda.
    const idle = await waitAquecedorCycleIdle(ownerEmail, 45_000);
    if (!idle || runtime.isProcessing) {
      runtime.lastResult =
        "Envio teste aguardou o ciclo atual terminar, mas o motor ainda está processando. Tente novamente em instantes.";
      return;
    }
  }
  runtime.isProcessing = true;
  runtime.lastRunAt = new Date().toISOString();

  try {
    const now = new Date();
    if (!forceTest && runtime.nextAllowedAt) {
      const nextAllowed = new Date(runtime.nextAllowedAt);
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

    const resolved = await resolveAquecedorConnectedForOwner(ownerEmail);
    const connectedAll = resolved.connected;
    for (const item of connectedAll) {
      await registerAquecedorInstancePreparing(item.instancia);
    }
    const connectedActive = await filterAquecedorCycleConnected(connectedAll);
    // Envio teste usa instâncias live-open do escopo (inclui Preparando).
    // O filtro active vale só para o ciclo automático (anti-restrição WhatsApp).
    const connected = forceTest ? connectedAll : connectedActive;
    updateAquecedorOwnerConnectedSummary(ownerEmail, connectedActive, connectedAll);

    const preparingCount = motor.connectedSummary.preparingCount;
    if (!forceTest && preparingCount > 0 && connected.length < 2 && connectedAll.length >= 2) {
      runtime.lastResult = `${preparingCount} instância(s) em preparação (6h desde a integração). Aquecedor ativo em ${connected.length}.`;
      return;
    }

    if (connected.length < 2) {
      const analysis = await analyzeAquecedorInstances(ownerEmail);
      const hints = analysis.excluded
        .map((row) => `${row.instancia} (${row.motivos.join(", ")})`)
        .slice(0, 6)
        .join("; ");
      const scopedCount = analysis.ownedInstances.length;
      const ghostNote = resolved.evoGhostOpenSummary ? ` ${resolved.evoGhostOpenSummary}` : "";
      const liveCounts =
        resolved.evoFetchOpenCount != null && resolved.evoLiveOpenCount != null
          ? ` fetchOpen=${resolved.evoFetchOpenCount} liveOpen=${resolved.evoLiveOpenCount}.`
          : "";
      const evoNote = resolved.evoDegraded
        ? resolved.evoGhostOpenSummary ||
          resolved.evoError ||
          " Sistema WABA - Drax indisponível ou instâncias não estão open (connectionState)."
        : "";
      runtime.lastResult = hints
        ? `Menos de 2 instâncias realmente conectadas (${connected.length} live-open de ${scopedCount} no escopo).${liveCounts}${ghostNote || ""} Verifique: ${hints}${evoNote ? ` ${evoNote}` : ""}`
        : scopedCount < 2
          ? `Menos de 2 instâncias no seu escopo (${scopedCount}). Vincule ou ative números na API Alternativa.${ghostNote}`
          : `Menos de 2 instâncias open no sistema WABA - Drax (connectionState).${liveCounts}${ghostNote || ""}${evoNote ? ` ${evoNote}` : ""}`;
      return;
    }

    if (resolved.source === "evo-cache") {
      console.warn(
        `[Aquecedor] Sistema WABA - Drax degradado — ${connected.length} instância(s) via cache (${resolved.evoError || "sem detalhe"}).`,
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      runtime.lastResult = "Supabase não configurado.";
      return;
    }

    const scopedInstanceNames = connected.map((item) => item.instancia);
    await releaseStuckAquecedorQueueRows(supabase, scopedInstanceNames);

    await syncAquecedorConnectedInstances(supabase, connectedAll);

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
      runtime.lastResult = "Sem combinações válidas.";
      return;
    }

    const cicloGlobal = getAquecedorOwnerCicloGlobal(motor);
    if (forceTest) {
      await runAquecedorCycleTestBatch(connected, cicloGlobal, supabase, config, ownerEmail);
      return;
    }

    const scopedKeys = new Set(
      (await listAquecedorScopedInstanceNames(ownerEmail)).map((name) => name.toLowerCase()),
    );
    const softSkipDirected = new Set<string>();
    const maxPickAttempts = Math.min(
      AQUECEDOR_PICK_ATTEMPTS_MAX,
      Math.max(1, combinations.length),
    );

    let picked: Awaited<ReturnType<typeof pickAquecedorCombinationAsync<(typeof combinations)[number]>>> =
      null;
    let chosen: (typeof combinations)[number] | null = null;
    let proximo = cicloGlobal + 1;
    let pairContext: ReturnType<typeof buildAquecedorPairContext> | null = null;
    let pendingData: Awaited<ReturnType<typeof fetchProcessableAquecedorPending>> = null;
    let texto = "";
    let lastSoftReason = "";

    for (let attempt = 0; attempt < maxPickAttempts; attempt += 1) {
      const candidate = await pickAquecedorCombinationAsync(
        supabase,
        connected,
        combinations,
        cicloGlobal + attempt,
        ownerEmail,
        softSkipDirected,
      );
      if (!candidate) break;

      const dirKey = buildDirectedCooldownKey(
        candidate.chosen.instancia_origem,
        candidate.chosen.instancia_destino,
      );
      if (softSkipDirected.has(dirKey)) continue;

      if (
        !scopedKeys.has(candidate.chosen.instancia_origem.toLowerCase()) ||
        !scopedKeys.has(candidate.chosen.instancia_destino.toLowerCase())
      ) {
        softSkipDirected.add(dirKey);
        lastSoftReason = `Par ${candidate.chosen.instancia_origem} → ${candidate.chosen.instancia_destino} fora do escopo.`;
        continue;
      }

      const dailyQuota = await canAquecedorInstanceSendToday(candidate.chosen.instancia_origem);
      if (!dailyQuota.ok) {
        softSkipDirected.add(dirKey);
        lastSoftReason = `${candidate.chosen.instancia_origem}: ${dailyQuota.reason}`;
        continue;
      }

      const turnCheck = await verifyAquecedorConversationTurn(
        supabase,
        connected,
        candidate.chosen.instancia_origem,
        candidate.chosen.instancia_destino,
      );
      if (!turnCheck.ok) {
        softSkipDirected.add(dirKey);
        lastSoftReason = turnCheck.reason;
        continue;
      }

      if (
        await hasRecentAquecedorSendBetween(
          supabase,
          connected,
          candidate.chosen.instancia_origem,
          candidate.chosen.instancia_destino,
          90,
        )
      ) {
        softSkipDirected.add(dirKey);
        lastSoftReason = `Envio ${candidate.chosen.instancia_origem} → ${candidate.chosen.instancia_destino} ignorado: duplicata recente.`;
        continue;
      }

      const openCheck = await assertAquecedorInstancesOpenForSend(
        candidate.chosen.instancia_origem,
        candidate.chosen.instancia_destino,
      );
      if (!openCheck.ok) {
        softSkipDirected.add(dirKey);
        lastSoftReason = openCheck.reason;
        await recordDirectedDeliveryFailure({
          origem: candidate.chosen.instancia_origem,
          destino: candidate.chosen.instancia_destino,
          reason: openCheck.reason,
          cooldownMs: AQUECEDOR_SOFT_DIRECTED_COOLDOWN_MS,
        });
        continue;
      }

      const candidateContext = buildAquecedorPairContext(candidate.chosen, connected);
      const ensured = await ensureAquecedorPendingMessage(candidateContext);
      const pending = await fetchProcessableAquecedorPending(
        supabase,
        scopedInstanceNames,
        candidate.chosen.instancia_origem,
      );
      if (!pending?.id) {
        softSkipDirected.add(dirKey);
        lastSoftReason =
          ensured.reason || "Falha ao preparar mensagem pendente na fila do aquecedor.";
        if (!ensured.ok && isSupabaseTransientError({ message: lastSoftReason })) {
          aquecedorCycleRuntime().nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
          aquecedorCycleRuntime().lastResult = await describeSupabaseConnectivityFailure();
          return;
        }
        continue;
      }

      picked = candidate;
      chosen = candidate.chosen;
      proximo = candidate.index + 1;
      pairContext = candidateContext;
      pendingData = pending;
      texto = await resolveAquecedorMessageForSend(
        supabase,
        pending.id,
        String(pending.mensagem || ""),
        candidateContext,
      );
      break;
    }

    if (!picked || !chosen || !pairContext || !pendingData?.id) {
      const blocked = await listBlockedDirectedKeys();
      const blockedHint = blocked.size
        ? ` ${blocked.size} direção(ões) em cooldown de entrega.`
        : "";
      const skipHint = softSkipDirected.size
        ? ` ${softSkipDirected.size} direção(ões) ignorada(s) neste ciclo.`
        : "";
      deferAquecedorRetryOrWindow(
        config,
        nowSp,
        blocked.size || softSkipDirected.size ? 45 : 30,
        lastSoftReason
          ? `${lastSoftReason}${skipHint}${blockedHint}`
          : `Aguardando equilíbrio de pares: nenhum envio elegível agora (saldo/anti-duplicata).${skipHint}${blockedHint}`,
      );
      return;
    }

    const deliveryTag = buildAquecedorDeliveryTag();
    const textoEnvio = appendAquecedorDeliveryTag(texto, deliveryTag);

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "PROCESSANDO",
        processing_at: new Date().toISOString(),
        instancia: chosen.instancia_origem,
        numero_destino: resolveAquecedorInstanceDigits(chosen.numero_whatsapp) || chosen.numero_whatsapp,
        mensagem: textoEnvio,
      })
      .eq("id", pendingData.id);

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
    const numberCandidates = buildAquecedorSendNumberCandidates(chosen.numero_whatsapp);
    if (!numberCandidates.length) {
      await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id, {
        keepInstancia: chosen.instancia_origem,
      });
      await recordDirectedDeliveryFailure({
        origem: chosen.instancia_origem,
        destino: chosen.instancia_destino,
        reason: "destino sem número WhatsApp válido",
        cooldownMs: AQUECEDOR_SOFT_DIRECTED_COOLDOWN_MS,
      });
      deferAquecedorRetryOrWindow(
        config,
        nowSp,
        120,
        `Destino ${chosen.instancia_destino} sem número WhatsApp válido para envio.`,
      );
      return;
    }

    const origemConnected = connected.find(
      (item) => item.instancia.toLowerCase() === chosen.instancia_origem.toLowerCase(),
    );
    let sendAccepted = false;
    let deliveryOk = false;
    let deliveryDetail = "";
    let lastSendStatus = 0;
    let lastSendBody = "";
    let numeroUsado = numberCandidates[0];
    let sendStartedAtMs = Date.now();
    let sawOrigemOnly = false;
    let outboundAckBroken = false;
    let lastAckStatus: EvoMessageAckStatus | null = null;
    const MAX_FAILED_NUMBER_TRIES = 2;
    let failedNumberTries = 0;

    // Anti-ban / anti-spam WhatsApp (incidente 2026-07-24):
    // - No máximo 1 sendText ACEITO por ciclo.
    // - Variantes só se o envio anterior FALHOU (exists:false), e no máx. 2 falhas.
    // - Nunca reenviar porque findMessages não confirmou no destino.
    for (let ni = 0; ni < numberCandidates.length; ni += 1) {
      if (sendAccepted) break;
      if (failedNumberTries >= MAX_FAILED_NUMBER_TRIES) break;
      const numero = numberCandidates[ni];
      numeroUsado = numero;
      const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text: textoEnvio } }
        : { number: numero, text: textoEnvio };
      sendStartedAtMs = Date.now();
      const sendResult = await callEvoSendTextWithRetry(sendUrl, sendBody, 2);
      lastSendStatus = sendResult.status;
      lastSendBody = String(sendResult.body || "");
      if (!sendResult.ok) {
        failedNumberTries += 1;
        const detailStr = String(
          sendResult.json?.message ||
            sendResult.json?.error ||
            sendResult.body ||
            "",
        );
        if (!instanceNameHeldByUnfinishedCampaign(chosen.instancia_origem)) {
          await detectAndMarkRestrictionFromSend(
            chosen.instancia_origem,
            sendResult.status,
            detailStr,
          );
        }
        continue;
      }
      sendAccepted = true;
      await (supabase.from("aquecedor" as any) as any)
        .update({
          numero_destino: numero,
          mensagem: textoEnvio,
        })
        .eq("id", pendingData.id);

      const messageId = extractAquecedorSendMessageId(sendResult.json);
      const ackProbe = messageId
        ? await probeAquecedorSendAckStatus(
            chosen.instancia_origem,
            messageId,
            { maxAttempts: 4, intervalMs: 2000 },
          )
        : { status: "UNKNOWN" as EvoMessageAckStatus };
      lastAckStatus = ackProbe.status;
      if (isEvoAckFailure(ackProbe.status)) {
        outboundAckBroken = true;
        rememberAquecedorOutboundHealth(chosen.instancia_origem, "broken", {
          sampleSize: 1,
          errorCount: 1,
        });
        deliveryDetail = decideAquecedorDeliveryConfirmation({
          sawOrigem: true,
          sawDestino: false,
          origem: chosen.instancia_origem,
          destino: chosen.instancia_destino,
          ackStatus: ackProbe.status,
        }).detail;
        break;
      }

      const deliveryCheck = await verifyAquecedorMessageDelivered(
        chosen.instancia_destino,
        resolveAquecedorInstanceDigits(String(origemConnected?.numero || "")),
        textoEnvio,
        {
          instanciaOrigem: chosen.instancia_origem,
          numeroDestino: numero,
          sendStartedAtMs,
          maxAttempts: outboundAckBroken ? 1 : 12,
          attemptIntervalMs: 3000,
          relaxTimestampOnLastAttempt: true,
          ackStatusHint: lastAckStatus,
          messageId,
        },
      );
      deliveryDetail = deliveryCheck.detail;
      if (deliveryCheck.ok) {
        deliveryOk = true;
      } else if (deliveryCheck.sawOrigem && !deliveryCheck.sawDestino) {
        sawOrigemOnly = true;
      }
      break;
    }

    if (!sendAccepted) {
      await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id, {
        keepInstancia: chosen.instancia_origem,
      });
      deferAquecedorRetryOrWindow(
        config,
        nowSp,
        lastSendStatus === 0 ? 180 : 120,
        `Falha no envio via EVO (HTTP ${lastSendStatus}). Mensagem voltou para pendente.`,
      );
      aquecedorCycleRuntime().lastEvoError = {
        status: lastSendStatus,
        body: lastSendBody.slice(0, 500),
        instance: chosen.instancia_origem,
        numeroLen: numeroUsado.length,
      };
      console.error("[Aquecedor] sendText falhou:", aquecedorCycleRuntime().lastEvoError);
      return;
    }

    if (!deliveryOk) {
      await revertAquecedorPendingAfterFailedSend(supabase, pendingData.id, {
        keepInstancia: chosen.instancia_origem,
      });
      // Outbound ERROR = sessão origem quebrada (não culpar o destino nem rajada).
      const cooldownMs = outboundAckBroken ? 60 * 60 * 1000 : 15 * 60 * 1000;
      if (outboundAckBroken) {
        if (instanceNameHeldByUnfinishedCampaign(chosen.instancia_origem)) {
          markCampaignChipUnsendable(chosen.instancia_origem, "aquecedor-outbound-error");
        } else {
          await markAquecedorInstanceRestricted(
            chosen.instancia_origem,
            `Aquecedor: outbound MessageUpdate=${lastAckStatus || "ERROR"} — reconecte QR da ${chosen.instancia_origem}.`,
          );
        }
      }
      const cooldown = await recordDirectedDeliveryFailure({
        origem: chosen.instancia_origem,
        destino: chosen.instancia_destino,
        reason: deliveryDetail || "entrega não confirmada no destinatário",
        cooldownMs,
      });
      const untilBr = formatDateBr(new Date(cooldown.untilMs).toISOString());
      deferAquecedorRetryOrWindow(
        config,
        nowSp,
        30,
        `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} não confirmado no destinatário. ${deliveryDetail} Par em cooldown até ${untilBr}${
          outboundAckBroken
            ? " (outbound ERROR — reconecte QR da origem)"
            : sawOrigemOnly
              ? " (só origem — sem reenvio de variantes)"
              : ""
        }; seguindo para outros pares.`,
      );
      aquecedorCycleRuntime().lastEvoError = {
        status: lastSendStatus,
        body: deliveryDetail.slice(0, 500),
        instance: chosen.instancia_destino,
        numeroLen: numeroUsado.length,
      };
      console.warn("[Aquecedor] entrega não confirmada:", aquecedorCycleRuntime().lastEvoError);
      return;
    }
    aquecedorCycleRuntime().lastEvoError = null;

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "ENVIADO",
        sent_at: new Date().toISOString(),
        numero_destino: numeroUsado,
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
      ownerEmail,
    });
    await recordAquecedorInstanceDailySend(chosen.instancia_origem);
    await recordDirectedSend({
      ownerEmail,
      fromInst:
        aquecedorChipKeyFromNumber(
          connected.find((c) => c.instancia === chosen.instancia_origem)?.numero || "",
        ) || chosen.instancia_origem,
      toInst:
        aquecedorChipKeyFromNumber(
          connected.find((c) => c.instancia === chosen.instancia_destino)?.numero ||
            chosen.numero_whatsapp ||
            "",
        ) || chosen.instancia_destino,
      at: new Date().toISOString(),
    });
    if (picked.pickMeta) {
      await recordPairSelection({
        ownerEmail,
        record: buildSelectionRecord(picked.pickMeta),
      });
    }

    const nextPick = await pickAquecedorCombinationAsync(
      supabase,
      connected,
      combinations,
      proximo,
      ownerEmail,
    );
    await ensureAquecedorPendingMessage(
      nextPick ? buildAquecedorPairContext(nextPick.chosen, connected) : null,
    );

    setAquecedorOwnerCicloGlobal(motor, proximo);
    void persistAquecedorOwnerSnapshot(ownerEmail, {
      cicloGlobal: proximo,
      workerId: getAquecedorWorkerId(),
      workerHeartbeatAt: new Date().toISOString(),
    });

    const waitMin = config.waitMinSeconds;
    const waitMax = config.waitMaxSeconds;
    const waitSeconds =
      Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
    aquecedorCycleRuntime().nextAllowedAt = new Date(Date.now() + waitSeconds * 1000).toISOString();
    aquecedorCycleRuntime().lastResult = `Envio ${chosen.instancia_origem} → ${chosen.instancia_destino} realizado${
      picked.pickMeta?.reason ? ` [${picked.pickMeta.reason}]` : ""
    }. Próximo ciclo em ~${waitSeconds}s.${
      preparingCount > 0
        ? ` ${preparingCount} instância(s) em preparação (6h): ${motor.connectedSummary.preparingNames.join(", ")}.`
        : ""
    }`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro no ciclo do aquecedor:", error);
    aquecedorCycleRuntime().lastResult = `Erro no ciclo do aquecedor: ${msg.slice(0, 200)}`;
  } finally {
    runtime.isProcessing = false;
    if (shouldProcessLeadOwnerMotor(motor)) {
      void persistAquecedorOwnerSnapshot(ownerEmail, {
        running: true,
        workerId: getAquecedorWorkerId(),
        workerHeartbeatAt: new Date().toISOString(),
      });
    }
    if (aquecedorCycleMotor?.ownerEmail === ownerEmail) {
      aquecedorCycleMotor = null;
    }
  }
}

let indexHtmlTemplate: string | null = null;
let indexHtmlTemplateMtimeMs = 0;
function isTsNodeDevServer(): boolean {
  return /\.ts$/i.test(String(process.argv[1] || ""));
}
function resolveIndexHtmlPath(): string {
  const rootHtml = path.join(rootPath, "index.html");
  const distHtml = path.join(distPath, "index.html");
  if ((RUNTIME_MODE === "development" || isTsNodeDevServer()) && existsSync(rootHtml)) {
    return rootHtml;
  }
  return distHtml;
}
function loadIndexHtmlTemplate(): string {
  const htmlPath = resolveIndexHtmlPath();
  if (RUNTIME_MODE === "development" || isTsNodeDevServer()) {
    return readFileSync(htmlPath, "utf8");
  }
  const mtimeMs = statSync(htmlPath).mtimeMs;
  if (!indexHtmlTemplate || mtimeMs !== indexHtmlTemplateMtimeMs) {
    indexHtmlTemplate = readFileSync(htmlPath, "utf8");
    indexHtmlTemplateMtimeMs = mtimeMs;
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
  const uiProfile = resolveUiProfile();
  const html = injectRuntimeIntoIndexHtml(loadIndexHtmlTemplate(), {
    basePath: BASE_PATH,
    uiProfile,
    featureFlags: getWabaFeatureFlagsForClient(),
    deployResilienceEnabled: resolveDeployResilienceForClient(),
  });
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Waba-Shell-Cache-Key", resolveShellCacheKey(uiProfile, BASE_PATH));
  res.type("html").send(html);
}

const staticNoIndex = { index: false as const };

app.get("/sw-deploy-resilience.js", (_req, res) => {
  const swPath = path.join(distPath, "sw-deploy-resilience.js");
  if (!existsSync(swPath)) {
    return res.status(404).type("text/plain").send("Service worker não encontrado.");
  }
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache");
  return res.type("application/javascript").sendFile(swPath);
});

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

const sendBetsLandingPage = (res: express.Response) => {
  const betsPath = path.join(rootPath, "public-pages", "bets.html");
  if (!existsSync(betsPath)) {
    return res.status(404).type("html").send("<p>Landing Bet Waba indisponível.</p>");
  }
  const html = injectRuntimeIntoIndexHtml(readFileSync(betsPath, "utf8"), {
    basePath: BASE_PATH,
    uiProfile: "production",
  });
  return res.type("html").send(html);
};

app.get("/cadastro", (_req, res) => sendVendasPage(res));

app.get("/vendas", (_req, res) => sendVendasPage(res));

app.get("/bets", (_req, res) => sendBetsLandingPage(res));

const sendPublicLegalPage = (res: express.Response, fileName: string) => {
  const filePath = path.join(rootPath, "public-pages", fileName);
  if (!existsSync(filePath)) {
    return res.status(404).type("html").send("<p>Página indisponível.</p>");
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.type("html").send(readFileSync(filePath, "utf8"));
};

app.get(["/termos", "/termos/"], (_req, res) => sendPublicLegalPage(res, "termos.html"));
app.get(["/exclusao-de-dados", "/exclusao-de-dados/", "/exclusao", "/exclusao/"], (_req, res) =>
  sendPublicLegalPage(res, "exclusao-de-dados.html"),
);

if (BASE_PATH) {
  // Após stripBasePathMiddleware, assets ficam em req.url relativo à raiz.
  app.use((req, res, next) => {
    if (!requestUnderBasePath(req)) return next();
    return express.static(distPath, staticNoIndex)(req, res, next);
  });
} else {
  app.use(express.static(distPath, staticNoIndex));
}

// Cache curto em memória para GET /dados (reduz hits repetidos ao Supabase).
const DADOS_RESPONSE_CACHE_TTL_MS = 45_000;
type DadosResponsePayload = {
  log: string;
  count: number;
  totalCount: number | null;
  countsBySender: Record<string, number> | null;
};
const EMPTY_DADOS_RESPONSE: DadosResponsePayload = {
  log: "",
  count: 0,
  totalCount: 0,
  countsBySender: {},
};
const dadosResponseCache = new Map<
  string,
  { expiresAt: number; payload: DadosResponsePayload }
>();

function buildDadosResponseCacheKey(
  ownerEmail: string,
  scopeFingerprint: string,
  rangeStart: string | null,
  rangeEnd: string | null,
): string {
  const owner = String(ownerEmail || "guest").trim().toLowerCase();
  const range = rangeStart && rangeEnd ? `range:${rangeStart}:${rangeEnd}` : "default";
  return `${owner}:${scopeFingerprint}:${range}`;
}

function readDadosResponseCache(key: string): DadosResponsePayload | null {
  const entry = dadosResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    dadosResponseCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeDadosResponseCache(key: string, payload: DadosResponsePayload) {
  dadosResponseCache.set(key, {
    expiresAt: Date.now() + DADOS_RESPONSE_CACHE_TTL_MS,
    payload,
  });
}

// Dados direto do banco (view logs_envios_br já com fuso tratado)
app.get("/dados", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = auth.email?.trim().toLowerCase() || "";
    const authConfigured = isWabaAuthConfigured();
    if (authConfigured && !ownerEmail) {
      return res.status(401).json({ error: "Faça login para consultar o dashboard." });
    }

    const scope =
      authConfigured && ownerEmail
        ? await resolveAquecedorDashboardScope(ownerEmail)
        : { globalScope: true, instanceNames: [], filterValues: [] };
    const scopeFingerprint = buildDadosScopeFingerprint(scope);

    const rangeStart =
      typeof req.query.rangeStart === "string" ? req.query.rangeStart : null;
    const rangeEnd =
      typeof req.query.rangeEnd === "string" ? req.query.rangeEnd : null;

    const cacheKey = buildDadosResponseCacheKey(
      ownerEmail,
      scopeFingerprint,
      rangeStart,
      rangeEnd,
    );
    const cachedPayload = readDadosResponseCache(cacheKey);
    if (cachedPayload) {
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Waba-Dados-Cache", "hit");
      return res.json(cachedPayload);
    }

    if (!scope.globalScope && !scope.filterValues.length) {
      writeDadosResponseCache(cacheKey, EMPTY_DADOS_RESPONSE);
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Waba-Dados-Cache", "empty-scope");
      return res.json(EMPTY_DADOS_RESPONSE);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const applyDadosInstanceScope = <T extends { in: (column: string, values: string[]) => T }>(
      query: T,
    ): T => {
      if (scope.globalScope || !scope.filterValues.length) return query;
      return query.in("instancia_origem", scope.filterValues);
    };

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
      const { count, error: countError } = await applyDadosInstanceScope(
        supabase
          .from("logs_envios_br")
          .select("id", { count: "exact", head: true })
          .gte("data_envio_br", startTs)
          .lt("data_envio_br", endTs),
      );

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

          const { data: senderRows, error: senderErr } = await applyDadosInstanceScope(
            supabase
              .from("logs_envios_br")
              .select("instancia_origem")
              .gte("data_envio_br", startTs)
              .lt("data_envio_br", endTs)
              .order("data_envio_br", { ascending: false })
              .range(offset, offset + pageSize - 1),
          );

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
      query = applyDadosInstanceScope(
        query.gte("data_envio_br", startTs).lt("data_envio_br", endTs).limit(5000),
      );
    } else {
      query = applyDadosInstanceScope(query.limit(2000));
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

    const payload: DadosResponsePayload = {
      log: texto,
      count: rows.length,
      totalCount,
      countsBySender,
    };
    writeDadosResponseCache(cacheKey, payload);
    res.setHeader("Cache-Control", "private, max-age=30");
    res.setHeader("X-Waba-Dados-Cache", "miss");
    return res.json(payload);
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
      console.error("Erro Sistema WABA - Drax:", evoList.status, evoList.detail);
      const fallback = await buildFallbackInstancesForAuth(auth, evolutionError);
      if (fallback.items.length > 0) {
        console.warn(
          `[instancias] Sistema WABA - Drax indisponível — retornando ${fallback.items.length} instância(s) do cache/dono (${auth.email || "guest"}).`,
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

      const number =
        extractPhoneFromEvoListItem(inst)?.phone || extractInstanceNumber(inst);

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

    const visibleBaseItems = await filterDeletedInstancesFromItems(baseItems, (row) =>
      String(row?.name || ""),
    );
    const liveBaseItems = await enrichInstanceItemsWithLiveConnection(
      visibleBaseItems as Array<Record<string, unknown>>,
    );
    let items = liveBaseItems;
    if (EVO_LIVE_PROFILE_SYNC) {
      items = await Promise.all(
        liveBaseItems.map(async (row: any) => {
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

    const allNames = liveBaseItems.map((row) => String(row?.name || "").trim()).filter(Boolean);
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
    ativas = items.filter((row) => String(row?.connectionStatus || "").toLowerCase() === "open")
      .length;
    desconectadas = items.length - ativas;

    void saveEvoInstancesCache(
      liveBaseItems.map((row) => ({ ...row })) as Array<Record<string, unknown>>,
    );

    const enrichedItems = await attachAquecedorMessageStatsToInstanceItems(
      items as Array<Record<string, unknown>>,
      auth.email || "",
    );
    ativas = enrichedItems.filter((row) =>
      String(row?.connectionStatus || "").toLowerCase() === "open",
    ).length;
    desconectadas = enrichedItems.length - ativas;

    return res.json({
      total: enrichedItems.length,
      ativas,
      desconectadas,
      items: enrichedItems,
    });
  } catch (error) {
    console.error("Erro ao consultar Sistema WABA - Drax:", error);
    return res
      .status(500)
      .json({ error: "Erro ao consultar o sistema WABA - Drax" });
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
    const filteredEntries = Array.from(usageMap.entries()).filter(([instanceName]) =>
      allowedLower.has(String(instanceName).toLowerCase()),
    );
    for (const [instanceName, cfg] of filteredEntries) {
      if (cfg.useAquecedor !== false) {
        await registerAquecedorInstancePreparing(instanceName);
      }
    }
    const lifecycleMap = await getAquecedorLifecycleStatusMap();
    const waRestrictionMap = await getWhatsappConnectingRestrictionMap();
    const warmthMap = await getAquecedorWarmthMapForInstances(
      filteredEntries.map(([instanceName]) => instanceName),
      getSupabaseClient()
    );
    const items = await Promise.all(
      filteredEntries.map(async ([instanceName, cfg]) => {
        const lifecycle =
          lifecycleMap[instanceName.toLowerCase()] ??
          (await getAquecedorLifecycleStatusForInstance(instanceName));
        const warmth = warmthMap[instanceName.toLowerCase()];
        const waRestriction = waRestrictionMap[instanceName.toLowerCase()];
        return {
          instanceName,
          ...cfg,
          aquecedorPhase: lifecycle?.phase ?? null,
          aquecedorStatusLabel: lifecycle?.statusLabel ?? null,
          aquecedorRestrictedUntil: lifecycle?.restrictedUntil ?? null,
          aquecedorPromoteAt: lifecycle?.promoteAt ?? null,
          waRestrictionUntil: waRestriction?.restrictedUntil ?? null,
          waRestrictionDetectedAt: waRestriction?.detectedAt ?? null,
          waRestrictionActive: waRestriction?.active === true,
          warmthLevel: warmth?.level ?? 0,
          warmthLabel: warmth?.label ?? "Não aquecido",
        };
      }),
    );
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar configuração de uso das instâncias." });
  }
});

/**
 * Integração Soma CRM — lista instâncias do aquecedor do owner configurado
 * (padrão: mozart.pmo@gmail.com). Auth: header X-Soma-Waba-Key = SOMA_WABA_INTEGRATION_KEY.
 */
app.get("/integrations/soma/aquecedor-instances", async (req, res) => {
  try {
    const expected = String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
    if (!expected) {
      return res.status(503).json({
        ok: false,
        error: "SOMA_WABA_INTEGRATION_KEY não configurada no WABA.",
      });
    }
    const provided = String(req.headers["x-soma-waba-key"] || "").trim();
    if (!provided || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Não autorizado." });
    }

    const ownerEmail = String(
      process.env.SOMA_WABA_OWNER_EMAIL || "mozart.pmo@gmail.com",
    )
      .trim()
      .toLowerCase();
    if (!ownerEmail.includes("@")) {
      return res.status(500).json({ ok: false, error: "SOMA_WABA_OWNER_EMAIL inválido." });
    }

    const auth = { email: ownerEmail, role: "subscriber" as const };
    const snapshot = await buildInstancesSnapshotForAuth(auth);
    const aquecedorNames = await listAquecedorScopedInstanceNames(ownerEmail);
    const aquecedorSet = new Set(aquecedorNames.map((n) => n.toLowerCase()));
    const warmthMap = await getAquecedorWarmthMapForInstances(
      aquecedorNames,
      getSupabaseClient(),
    );

    const items = (snapshot.items || [])
      .filter((row: any) => aquecedorSet.has(String(row?.name || "").toLowerCase()))
      .map((row: any) => {
        const instanceName = String(row?.name || "").trim();
        const warmth = warmthMap[instanceName.toLowerCase()];
        return {
          instanceName,
          number: String(row?.number || "").trim(),
          whatsappName: String(row?.displayName || row?.whatsappNameOverride || instanceName).trim(),
          instanceAlias: String(row?.instanceAlias || "").trim(),
          contacts: Number(row?.contacts) || 0,
          messages: Number(row?.messages) || 0,
          profilePicUrl: String(row?.profilePicUrl || "").trim(),
          avatarVersion: String(row?.avatarVersion || "").trim(),
          connectionStatus: String(row?.connectionStatus || "unknown"),
          warmthLevel: warmth?.level ?? 0,
          warmthLabel: warmth?.label ?? "Não aquecido",
        };
      });

    return res.status(200).json({
      ok: true,
      ownerEmail,
      total: items.length,
      cacheUpdatedAt: snapshot.cacheUpdatedAt || "",
      items,
    });
  } catch (error) {
    console.error("GET /integrations/soma/aquecedor-instances", error);
    return res.status(500).json({
      ok: false,
      error: "Falha ao listar instâncias do aquecedor para o Soma.",
    });
  }
});

/**
 * Integração Soma CRM — cria campanha API Alternativa no owner configurado
 * (padrão mozart.pmo@gmail.com). Auth: X-Soma-Waba-Key.
 * Body JSON: name, plannedSendCount, config fields, optional numbers[].
 */
app.post("/integrations/soma/alternativa-campaigns", async (req, res) => {
  try {
    const expected = String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
    if (!expected) {
      return res.status(503).json({
        ok: false,
        error: "SOMA_WABA_INTEGRATION_KEY não configurada no WABA.",
      });
    }
    const provided = String(req.headers["x-soma-waba-key"] || "").trim();
    if (!provided || provided !== expected) {
      return res.status(401).json({ ok: false, error: "Não autorizado." });
    }

    const ownerEmail = String(
      process.env.SOMA_WABA_OWNER_EMAIL || "mozart.pmo@gmail.com",
    )
      .trim()
      .toLowerCase();
    if (!ownerEmail.includes("@")) {
      return res.status(500).json({ ok: false, error: "SOMA_WABA_OWNER_EMAIL inválido." });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = String(body.name || "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: "Nome da campanha é obrigatório." });
    }

    const plannedSendCount = Math.max(0, Math.floor(Number(body.plannedSendCount) || 0));
    const numbersRaw = Array.isArray(body.numbers) ? body.numbers : [];
    const bucket = numbersRaw
      .map((n: unknown) => normalizeCampaignPhone(String(n || "")))
      .filter((n: string) => n.length >= 12);
    const extracted = deduplicateCampaignDestinationPhones(bucket);
    let numbers = extracted.phones;

    const configSnapshot = parseDisparosConfig({
      delayMinSeconds: body.delayMinSeconds,
      delayMaxSeconds: body.delayMaxSeconds,
      startHour: body.startHour,
      endHour: body.endHour,
      messageMode: body.messageMode === "fixed" ? "fixed" : "ai",
      aiBriefing: body.aiBriefing,
      aiTone: body.aiTone,
      aiCta: body.aiCta,
      fixedMessage: body.fixedMessage,
      linkDestinationMode: body.linkDestinationMode === "url" ? "url" : "whatsapp",
      whatsappTargetNumber: body.whatsappTargetNumber,
      responseUrl: body.responseUrl,
      shortenerProvider: "waba",
      selectedDisparadorInstances: Array.isArray(body.selectedDisparadorInstances)
        ? body.selectedDisparadorInstances
        : [],
    });

    const campaignInstances = (configSnapshot.selectedDisparadorInstances || [])
      .map((n) => String(n || "").trim())
      .filter(Boolean);
    if (!campaignInstances.length) {
      return res.status(400).json({
        ok: false,
        error: "Selecione ao menos uma instância conectada para o disparo.",
      });
    }

    const previousSelected = (await loadDisparosConfigFromDb()).selectedDisparadorInstances || [];
    queueSyncProxyBrasilForCampaignSelection({
      selectedInstanceNames: campaignInstances,
      previouslySelectedInstanceNames: previousSelected,
      callEvoAction,
      evoApiBase: EVO_API_BASE,
      prepareDeps: getProxyBrasilCampaignPrepareDeps(),
    });
    // Liga Proxy Brasil nas selecionadas; se a sessão cair, a campanha pede QR com Proxy Campanha.

    if (plannedSendCount > 0 && numbers.length > plannedSendCount) {
      numbers = numbers.slice(0, plannedSendCount);
    }

    if (await shouldApplyAlternativaDispatchProfile(ownerEmail)) {
      try {
        await assertAlternativaDispatchReady(ownerEmail);
      } catch (err: any) {
        return res.status(400).json({
          ok: false,
          error: err?.message || "Requisitos da API Alternativa não atendidos.",
        });
      }
      Object.assign(configSnapshot, applyAlternativaDispatchProfile(configSnapshot));
    }

    const now = new Date().toISOString();
    const campaignId = crypto.randomUUID();
    const totalNumbers = numbers.length > 0 ? numbers.length : plannedSendCount;
    const campaign: DisparosCampaign = {
      id: campaignId,
      name,
      createdAt: now,
      status: "paused",
      totalNumbers,
      sentCount: 0,
      ownerEmail,
      pauseReason:
        "Aguardando ativação. Clique em Ativar campanha para iniciar os disparos.",
      configSnapshot,
    };
    const leads: DisparosCampaignLead[] = numbers.map((phone) => ({
      id: crypto.randomUUID(),
      campaignId,
      phone,
      status: "pending" as const,
      createdAt: now,
      sentAt: null,
    }));

    disparosCampaignsMemory.unshift(campaign);
    if (leads.length) disparosCampaignLeadsMemory.unshift(...leads);

    const supabase = getSupabaseClient();
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
        if (leads.length) {
          await (supabase.from("disparos_campaign_leads" as any) as any).insert(
            leads.map((lead) => ({
              id: lead.id,
              campaign_id: lead.campaignId,
              phone: lead.phone,
              status: lead.status,
              created_at: lead.createdAt,
              sent_at: lead.sentAt,
            })),
          );
        }
      } catch (dbErr) {
        console.error("[Soma] Falha ao gravar campanha no Supabase:", dbErr);
      }
    }

    queuePersistDisparosLocalState();

    return res.status(200).json({
      ok: true,
      id: campaignId,
      campaign: { id: campaignId, name, status: "paused", totalNumbers },
      message:
        numbers.length > 0
          ? "Campanha criada no WABA (pausada). Ative no painel API Alternativa para enviar."
          : "Campanha criada no WABA (pausada) sem leads ainda. Os números do público do funil podem ser sincronizados na execução.",
      ownerEmail,
      leadsCount: numbers.length,
      plannedSendCount: totalNumbers,
    });
  } catch (error) {
    console.error("POST /integrations/soma/alternativa-campaigns", error);
    return res.status(500).json({
      ok: false,
      error: "Falha ao criar campanha Alternativa para o Soma.",
    });
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
    const usageMapBefore = await loadInstanceUsageMap();
    await persistInstanceUsage(sanitized);
    for (const row of sanitized) {
      if (row.useAquecedor !== false) {
        const prev = getInstanceUsageFromMap(usageMapBefore, row.instanceName);
        if (!prev) {
          await registerAquecedorInstancePreparing(row.instanceName, new Date().toISOString(), {
            forceNewIntegration: true,
          });
        } else if (prev.useAquecedor === false) {
          await registerAquecedorInstancePreparing(row.instanceName);
        }
      }
    }
    return res.json({ ok: true, message: "Configuração de uso das instâncias salva.", items: sanitized });
  } catch {
    return res.status(500).json({ error: "Erro ao salvar configuração de uso das instâncias." });
  }
});

app.post("/webhooks/evolution", (req, res) => {
  res.status(202).json({ ok: true });
  setImmediate(() => {
    try {
      handleEvolutionWebhookPayload(req.body);
      handleInboundValidationWebhook(req.body);
    } catch (error) {
      console.error("POST /webhooks/evolution", error);
    }
  });
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

app.get("/instancias/:name/status-conexao", async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, name)) return;

    const live = await fetchEvoInstanceConnectionState(name, { fresh: true });
    if (live.ok) {
      let instanceNumber = "";
      if (live.open) {
        instanceNumber = await resolveEvoInstancePhone(name);
        if (!instanceNumber) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data } = await (supabase
              .from("controle_instancia" as any)
              .select("numero_whatsapp")
              .eq("instancia", name)
              .maybeSingle() as any);
            instanceNumber = normalizeEvoWhatsAppNumber(
              String((data as { numero_whatsapp?: string } | null)?.numero_whatsapp || "").trim()
            );
          }
        }
      }
      return res.json({
        ok: true,
        name,
        connectionStatus: live.state,
        open: live.open,
        connecting: isEvoConnectionInProgress(live.state),
        instanceNumber: instanceNumber || null,
        source: "connectionState",
      });
    }

    const evoList = await fetchEvoInstancesList();
    if (evoList.ok) {
      const needle = name.toLowerCase();
      const match = evoList.instances.find((inst: Record<string, unknown>) => {
        const key = String(
          inst?.instanceName ?? inst?.name ?? inst?.instance ?? "",
        )
          .trim()
          .toLowerCase();
        return key === needle;
      });
      if (match) {
        const state = String(match.connectionStatus ?? match.status ?? "unknown")
          .trim()
          .toLowerCase();
        const phoneRow = extractPhoneFromEvoListItem(match);
        let instanceNumber = phoneRow?.phone || "";
        if (!instanceNumber && state.includes("open")) {
          instanceNumber = await resolveEvoInstancePhone(name);
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
      error: "Não foi possível consultar o status da instância no sistema WABA - Drax.",
    });
  } catch (error) {
    console.error("GET /instancias/:name/status-conexao", error);
    return res.status(500).json({ error: "Erro ao consultar status da instância." });
  }
});

app.post("/instancias/:name/validacao-inbound", async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (await rejectForeignInstance(req, res, name)) return;
    const instanceNumberHint = String(req.body?.number || req.body?.instanceNumberHint || "").trim();
    const forceRestart = Boolean(req.body?.forceRestart);
    const started = await startInboundValidation({
      instanceName: name,
      instanceNumberHint,
      forceRestart,
    });
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

app.get("/instancias/validacao-inbound/:validationId", async (req, res) => {
  const validationId = String(req.params.validationId || "").trim();
  if (!validationId) {
    return res.status(400).json({ error: "validationId é obrigatório." });
  }
  try {
    // Poll da UI dispara busca CONFIRMAR (fast+deep) + envio da resposta.
    const status = await refreshInboundValidation(validationId, { deep: true });
    if (!status) {
      return res.status(404).json({ error: "Validação não encontrada ou expirada." });
    }
    return res.json({ ok: true, ...status });
  } catch (error: any) {
    console.error("GET /instancias/validacao-inbound/:validationId", error);
    const status = getInboundValidationStatus(validationId);
    if (!status) {
      return res.status(404).json({ error: "Validação não encontrada ou expirada." });
    }
    return res.json({ ok: true, ...status });
  }
});

app.post("/instancias/validacao-inbound/:validationId/confirmar-envio", async (req, res) => {
  try {
    const validationId = String(req.params.validationId || "").trim();
    if (!validationId) {
      return res.status(400).json({ ok: false, error: "validationId é obrigatório." });
    }
    const statusBefore = getInboundValidationStatus(validationId);
    if (!statusBefore) {
      return res.status(404).json({ ok: false, error: "Validação não encontrada ou expirada." });
    }
    if (await rejectForeignInstance(req, res, statusBefore.instanceName)) return;

    const result = await confirmUserSentInbound(validationId);
    return res.json({
      ok: result.ok,
      found: result.found,
      error: result.error,
      ...(result.status || {}),
    });
  } catch (error: any) {
    console.error("POST /instancias/validacao-inbound/:validationId/confirmar-envio", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao confirmar envio no sistema WABA - Drax.",
    });
  }
});

function buildTemplateUrl(template: string, instanceName: string) {
  if (!template) return "";
  return template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));
}

function normalizeWhatsAppNumber(num: string): string {
  return normalizeEvoWhatsAppNumber(num);
}

/**
 * Número para ENVIO em campanha: preferir 55+DDD+9+8 (13 dígitos).
 * `canonicalizeBrazilWhatsAppNumber` remove o 9º dígito (chave de dedupe) e,
 * se usado no envio, a mensagem pode ir para JID errado sem chegar no celular.
 */
function preferredBrazilWhatsAppSendNumber(raw: string): string {
  const variants = expandBrazilWhatsAppNumberVariants(String(raw || ""));
  const withNineIntl = variants.find(
    (v) => v.startsWith("55") && v.length === 13 && v.charAt(4) === "9",
  );
  if (withNineIntl) return withNineIntl;
  const withNineNational = variants.find(
    (v) => !v.startsWith("55") && v.length === 11 && v.charAt(2) === "9",
  );
  if (withNineNational) return `55${withNineNational}`;
  return normalizeEvoWhatsAppNumber(String(raw || ""));
}

function normalizeCampaignPhone(input: string): string {
  return preferredBrazilWhatsAppSendNumber(String(input || ""));
}

/** Uma linha de contato → um destino *dentro da mesma campanha*.
 * Telefone repetido em campanhas diferentes continua sendo enviado normalmente
 * (cada campanha tem sua própria fila de leads). */
function deduplicateCampaignDestinationPhones(
  digitCandidates: string[]
): { phones: string[]; removedDuplicates: number } {
  const seen = new Set<string>();
  const phones: string[] = [];
  let removedDuplicates = 0;
  for (const cand of digitCandidates) {
    const digits = normalizeCampaignPhone(String(cand || ""));
    if (digits.length < 12) continue;
    const dedupeKey = canonicalizeBrazilWhatsAppNumber(digits) || digits;
    if (seen.has(dedupeKey)) {
      removedDuplicates += 1;
      continue;
    }
    seen.add(dedupeKey);
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
  const row = extractPhoneFromEvoListItem(inst?.instance ? inst : { instance: inst });
  if (row?.phone) return row.phone;
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
      const row = extractPhoneFromEvoListItem(item);
      if (!row || !row.open || !row.instanceName) return null;
      return { instancia: row.instanceName, numero: row.phone || "" };
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

async function fetchEvoInstanceTagRows(opts?: {
  withLiveState?: boolean;
}): Promise<EvoInstanceTagRow[]> {
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
    const rows = buildEvoInstanceTagRowsFromList(list, whatsappMap, aliasesMap);
    if (opts?.withLiveState === false) return rows;
    // fetchInstances mente "open" com frequência; tags/saúde usam connectionState real.
    return enrichEvoInstanceTagRowsWithLiveState(rows);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Sobrescreve `connected` com /instance/connectionState (fonte de verdade). */
async function enrichEvoInstanceTagRowsWithLiveState(
  rows: EvoInstanceTagRow[]
): Promise<EvoInstanceTagRow[]> {
  if (!rows.length) return rows;
  const concurrency = 10;
  for (let i = 0; i < rows.length; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (row) => {
        try {
          const live = await fetchEvoInstanceLiveState(row.instanceKey);
          if (!String(live || "").trim()) return;
          row.connected = isEvoLiveStateOpen(live);
        } catch {
          /* probe falhou: não tratar como desconectado */
        }
      })
    );
  }
  return rows;
}

function selectedDisparadorNamesFromConfig(
  config: DisparosConfig | undefined | null,
): string[] {
  const raw = config?.selectedDisparadorInstances;
  return Array.isArray(raw)
    ? raw.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
}

function cloneEvoInstanceTagRow(row: EvoInstanceTagRow): EvoInstanceTagRow {
  return {
    ...row,
    nameKeys: new Set(row.nameKeys),
    digitKeys: new Set(row.digitKeys),
  };
}

function syntheticEvoInstanceTagRow(
  instanceKey: string,
  displayName: string,
  connected: boolean,
): EvoInstanceTagRow {
  const nameKeys = new Set<string>();
  addComparableNameKey(nameKeys, instanceKey);
  addComparableNameKey(nameKeys, displayName);
  return {
    instanceKey,
    displayName,
    connected,
    nameKeys,
    digitKeys: digitKeysFromStoredLabel(displayName),
  };
}

/**
 * Confirma se o chip da campanha ainda pode disparar.
 * EVO `open` não basta: 403 / outbound ERROR / tag Restrição / restricted_wait
 * deixam o chip vermelho e apto à troca 1:1.
 */
async function enrichSelectedCampaignInstancesLive(
  config: DisparosConfig | undefined | null,
  evoRows: EvoInstanceTagRow[],
  opts?: { withOutboundHealth?: boolean },
): Promise<EvoInstanceTagRow[]> {
  const selected = selectedDisparadorNamesFromConfig(config);
  const rows = evoRows.map(cloneEvoInstanceTagRow);
  if (!selected.length) return rows;

  const restrictionMap = await getWhatsappConnectingRestrictionMap();
  const lifecycleMap = await getAquecedorLifecycleStatusMap();

  for (const name of selected) {
    const resolved = resolveStoredNameToEvoTag(name, rows);
    const key = String(resolved.instanceKey || name).trim();
    const probeKeys = Array.from(
      new Set(
        [key, name, resolved.displayName]
          .map((n) => String(n || "").trim())
          .filter(Boolean),
      ),
    );
    let live = "";
    let statusReason: number | null = null;
    let probedKey = key;
    try {
      for (const probe of probeKeys) {
        const detail = await fetchEvoInstanceLiveDetail(probe, { fresh: true });
        live = detail.state;
        statusReason = detail.statusReason;
        if (String(live || "").trim() || isEvoWhatsAppRestrictedReason(statusReason)) {
          probedKey = probe;
          break;
        }
      }
    } catch {
      live = "";
      statusReason = null;
    }
    const restrictionActive = probeKeys.some(
      (n) => restrictionMap[n.toLowerCase()]?.active === true,
    );
    const lifecycleRestricted = probeKeys.some(
      (n) => lifecycleMap[n.toLowerCase()]?.phase === "restricted_wait",
    );
    if (isEvoWhatsAppRestrictedReason(statusReason)) {
      markCampaignInstanceBlocked(key, "statusReason-403");
      if (!restrictionActive) markCampaignChipUnsendable(key, "statusReason-403");
    }
    let outboundBroken = false;
    if (
      opts?.withOutboundHealth &&
      isEvoLiveStateOpen(live) &&
      !isEvoWhatsAppRestrictedReason(statusReason)
    ) {
      const health = await probeAquecedorInstanceOutboundHealth(key);
      outboundBroken = health === "broken";
      if (outboundBroken) {
        markCampaignInstanceBlocked(key, "outbound-error");
        if (!restrictionActive) markCampaignChipUnsendable(key, "outbound-error");
      }
    }
    if (restrictionActive) {
      markCampaignInstanceBlocked(key, "wa-restricao-explicita");
    } else if (lifecycleRestricted) {
      markCampaignInstanceBlocked(key, "restricted_wait");
    }
    const idx = rows.findIndex(
      (r) =>
        r.instanceKey.toLowerCase() === key.toLowerCase() ||
        r.instanceKey.toLowerCase() === probedKey.toLowerCase() ||
        r.nameKeys.has(name.toLowerCase()) ||
        r.nameKeys.has(key.toLowerCase()),
    );
    const fetchConnected = idx >= 0 ? rows[idx].connected === true : resolved.connected === true;
    const open = campaignChipConnectedForDispatch({
      liveState: live,
      statusReason,
      outboundBroken,
      blocked: isCampaignInstanceBlocked(key) || isCampaignInstanceBlocked(name),
      restricted: restrictionActive || lifecycleRestricted,
      fallbackConnected: fetchConnected,
    });
    if (idx >= 0) {
      rows[idx].connected = open;
      continue;
    }
    rows.push(syntheticEvoInstanceTagRow(key, resolved.displayName || name, open));
  }
  return rows;
}

function isOperatorHeldCampaignPause(reason?: string): boolean {
  const t = String(reason || "").toLowerCase();
  if (!t) return false;
  if (t.includes("pausada manualmente")) return true;
  if (t.includes("créditos") || t.includes("creditos")) return true;
  if (t.includes("envios interrompidos no servidor")) return true;
  return false;
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
): { displayName: string; connected: boolean; instanceKey: string } {
  const raw = String(storedName || "").trim();
  const rawLc = raw.toLowerCase();
  if (!raw) return { displayName: "", connected: false, instanceKey: "" };
  if (!rows.length) return { displayName: raw, connected: false, instanceKey: raw };

  for (const r of rows) {
    if (r.nameKeys.has(rawLc)) {
      return { displayName: r.displayName, connected: r.connected, instanceKey: r.instanceKey };
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
    return { displayName: r.displayName, connected: r.connected, instanceKey: r.instanceKey };
  }
  if (digitHits.length > 1) {
    const pick = pickBestDigitHitRow(raw, rawLc, digitHits);
    return {
      displayName: pick.displayName,
      connected: pick.connected,
      instanceKey: pick.instanceKey,
    };
  }

  return { displayName: raw, connected: false, instanceKey: raw };
}

function resolveSelectedNamesToEvoKeys(
  storedNames: string[],
  evoRows: EvoInstanceTagRow[]
): string[] {
  const keys = new Set<string>();
  for (const name of storedNames) {
    const n = String(name || "").trim();
    if (!n) continue;
    const r = resolveStoredNameToEvoTag(n, evoRows);
    keys.add(r.instanceKey || n);
  }
  return Array.from(keys);
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
        connected: prev.connected && r.connected,
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
  const minConnectedRequired = DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES;
  const shouldPauseByDisconnectedRatio =
    selectedCount > 0 &&
    disconnectedCount / selectedCount >= 0.5 &&
    connectedCount < minConnectedRequired;
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

/** Quantos números adicionar (com troca 1:1 dos offline) para sair do bloqueio. */
function computeCampaignInstancesToAdd(health: CampaignInstanceHealth): number {
  const disconnected = Math.max(0, Number(health.disconnectedCount) || 0);
  const connected = Math.max(0, Number(health.connectedCount) || 0);
  const selected = Math.max(0, Number(health.selectedCount) || 0);
  const minReq = Math.max(1, Number(health.minConnectedRequired) || 1);

  // Cada adição troca 1 offline (selected estável) até acabar a fila de offline.
  for (let k = 0; k <= disconnected; k += 1) {
    const nextConnected = connected + k;
    const nextDisconnected = disconnected - k;
    const ratioOk = selected === 0 || nextDisconnected / selected < 0.5;
    const minOk = nextConnected >= minReq;
    if (ratioOk && minOk) return k;
  }

  // Offline esgotados: ainda falta mínimo → só acrescenta.
  const afterSwapConnected = connected + disconnected;
  if (afterSwapConnected < minReq) {
    return disconnected + (minReq - afterSwapConnected);
  }
  return Math.max(disconnected, 0);
}

/** Nomes do snapshot que estão desconectados/bloqueados (vermelhos). */
function listDisconnectedStoredInstanceNames(
  selectedNames: string[],
  evoRows: EvoInstanceTagRow[],
): string[] {
  const out: string[] = [];
  for (const name of selectedNames) {
    const stored = String(name || "").trim();
    if (!stored) continue;
    const resolved = resolveStoredNameToEvoTag(stored, evoRows);
    if (resolved.connected !== true) out.push(stored);
  }
  return out;
}

/**
 * Ao acrescentar números, remove a mesma quantidade de bloqueados/offline da seleção
 * (troca 1:1) para a campanha não ficar parada pelo ratio ≥50%.
 */
function mergeCampaignInstancesReplacingBlocked(input: {
  prevSelected: string[];
  incoming: string[];
  evoRows: EvoInstanceTagRow[];
}): { selected: string[]; added: string[]; removedBlocked: string[] } {
  const prevSelected = input.prevSelected
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const incoming = input.incoming.map((n) => String(n || "").trim()).filter(Boolean);

  const prevKeySet = new Set(
    prevSelected.map((n) => {
      const r = resolveStoredNameToEvoTag(n, input.evoRows);
      return String(r.instanceKey || n).trim().toLowerCase();
    }),
  );

  const added: string[] = [];
  for (const name of incoming) {
    const r = resolveStoredNameToEvoTag(name, input.evoRows);
    const key = String(r.instanceKey || name).trim().toLowerCase();
    if (!key || prevKeySet.has(key)) continue;
    prevKeySet.add(key);
    added.push(name);
  }

  const disconnected = listDisconnectedStoredInstanceNames(prevSelected, input.evoRows);
  const removedBlocked = disconnected.slice(0, added.length);
  const removeSet = new Set(removedBlocked.map((n) => n.toLowerCase()));
  const kept = prevSelected.filter((n) => !removeSet.has(n.toLowerCase()));
  const selected = Array.from(new Set([...kept, ...added]));
  return { selected, added, removedBlocked };
}

function campaignOwnerAuth(ownerEmail?: string | null): WabaRequestAuth {
  const email = String(ownerEmail || "").trim().toLowerCase();
  return { email, role: email.includes("@") ? "subscriber" : "guest" };
}

async function persistCampaignSelectedInstances(
  campaign: DisparosCampaign,
  selected: string[],
): Promise<void> {
  campaign.configSnapshot = parseDisparosConfig({
    ...(campaign.configSnapshot || DISPAROS_DEFAULTS),
    selectedDisparadorInstances: selected,
  });
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await (supabase.from("disparos_campaigns" as any) as any)
        .update({ config_snapshot: campaign.configSnapshot })
        .eq("id", campaign.id);
    } catch {
      /* */
    }
  }
  queuePersistDisparosLocalState();
}

function evoRowIdentityKeys(row: EvoInstanceTagRow): Set<string> {
  const out = new Set<string>();
  const instanceKey = String(row.instanceKey || "").trim().toLowerCase();
  const displayName = String(row.displayName || "").trim().toLowerCase();
  if (instanceKey) out.add(instanceKey);
  if (displayName) out.add(displayName);
  for (const k of row.nameKeys || []) {
    const n = String(k || "").trim().toLowerCase();
    if (n) out.add(n);
  }
  for (const d of row.digitKeys || []) {
    const digits = String(d || "").trim();
    if (digits.length >= 8) out.add(`d:${digits}`);
  }
  return out;
}

function campaignSelectionIdentityKeys(
  selectedNames: string[],
  evoRows: EvoInstanceTagRow[],
): Set<string> {
  const out = new Set<string>();
  for (const raw of selectedNames) {
    const n = String(raw || "").trim();
    if (!n) continue;
    out.add(n.toLowerCase());
    const resolved = resolveStoredNameToEvoTag(n, evoRows);
    const key = String(resolved.instanceKey || n).trim().toLowerCase();
    const display = String(resolved.displayName || "").trim().toLowerCase();
    if (key) out.add(key);
    if (display) out.add(display);
    const row = evoRows.find((r) => String(r.instanceKey || "").trim().toLowerCase() === key);
    if (!row) continue;
    for (const id of evoRowIdentityKeys(row)) out.add(id);
  }
  return out;
}

function evoRowIsInIdentity(row: EvoInstanceTagRow, identity: Set<string>): boolean {
  for (const id of evoRowIdentityKeys(row)) {
    if (identity.has(id)) return true;
  }
  return false;
}

function listSpareEvoRowsNotInCampaign(
  exceptCampaignId: string | undefined,
  selectedNames: string[],
  evoRows: EvoInstanceTagRow[],
): EvoInstanceTagRow[] {
  const identity = campaignSelectionIdentityKeys(selectedNames, evoRows);
  const heldRaw = heldProxyBrasilNamesFromLiveCampaigns(exceptCampaignId);
  const heldIdentity = campaignSelectionIdentityKeys(heldRaw, evoRows);
  return evoRows.filter((row) => {
    const name = String(row.instanceKey || "").trim();
    if (!name) return false;
    if (evoRowIsInIdentity(row, identity)) return false;
    if (evoRowIsInIdentity(row, heldIdentity)) return false;
    return true;
  });
}

function listConnectedSpareEvoNames(
  exceptCampaignId: string | undefined,
  selectedNames: string[],
  evoRows: EvoInstanceTagRow[],
  maxToAdd = 20,
): string[] {
  const out: string[] = [];
  for (const row of listSpareEvoRowsNotInCampaign(exceptCampaignId, selectedNames, evoRows)) {
    const name = String(row.instanceKey || "").trim();
    if (isCampaignInstanceBlocked(name)) continue;
    const alias = String(row.displayName || "").trim();
    const hasAlias = Boolean(alias) && alias.toLowerCase() !== name.toLowerCase();
    if (row.connected !== true && !hasAlias) continue;
    out.push(name);
    if (out.length >= maxToAdd) break;
  }
  return out;
}

async function resolveLiveSpareEvoNames(
  exceptCampaignId: string | undefined,
  selectedNames: string[],
  evoRows: EvoInstanceTagRow[],
  maxToAdd = 20,
): Promise<string[]> {
  const heuristic = listConnectedSpareEvoNames(
    exceptCampaignId,
    selectedNames,
    evoRows,
    maxToAdd,
  );
  if (heuristic.length) return heuristic;
  const candidates = listSpareEvoRowsNotInCampaign(exceptCampaignId, selectedNames, evoRows);
  candidates.sort((a, b) => {
    const aName = String(a.instanceKey || "").trim();
    const bName = String(b.instanceKey || "").trim();
    const aAlias = String(a.displayName || "").trim().toLowerCase() !== aName.toLowerCase() ? 0 : 1;
    const bAlias = String(b.displayName || "").trim().toLowerCase() !== bName.toLowerCase() ? 0 : 1;
    if (aAlias !== bAlias) return aAlias - bAlias;
    if (Boolean(a.connected) === Boolean(b.connected)) return 0;
    return a.connected ? -1 : 1;
  });
  if (!candidates.length || maxToAdd <= 0) return [];
  const confirmed: string[] = [];
  const concurrency = 6;
  for (let i = 0; i < candidates.length && confirmed.length < maxToAdd; i += concurrency) {
    const chunk = candidates.slice(i, i + concurrency);
    const states = await Promise.all(
      chunk.map(async (row) => {
        const name = String(row.instanceKey || "").trim();
        const alias = String(row.displayName || "").trim();
        if (!name || isCampaignInstanceBlocked(name)) return { name, open: false };
        try {
          const detail = await fetchEvoInstanceLiveDetail(name, { fresh: true });
          let live = detail.state;
          let statusReason = detail.statusReason;
          if (
            !String(live || "").trim() &&
            !isEvoWhatsAppRestrictedReason(statusReason) &&
            alias &&
            alias.toLowerCase() !== name.toLowerCase()
          ) {
            const aliasDetail = await fetchEvoInstanceLiveDetail(alias, { fresh: true });
            live = aliasDetail.state;
            statusReason = aliasDetail.statusReason;
          }
          const open = campaignChipConnectedForDispatch({
            liveState: live,
            statusReason,
            blocked: false,
            fallbackConnected: row.connected === true,
          });
          return { name, open };
        } catch {
          return { name, open: row.connected === true };
        }
      }),
    );
    for (const item of states) {
      if (!item.open || !item.name) continue;
      confirmed.push(item.name);
      if (confirmed.length >= maxToAdd) break;
    }
  }
  return confirmed;
}

function appendIncomingCampaignInstances(
  prevSelected: string[],
  incoming: string[],
  evoRows: EvoInstanceTagRow[],
): { added: string[]; selected: string[] } {
  const selected = prevSelected.map((n) => String(n || "").trim()).filter(Boolean);
  const identity = campaignSelectionIdentityKeys(selected, evoRows);
  const added: string[] = [];
  for (const raw of incoming) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const resolved = resolveStoredNameToEvoTag(name, evoRows);
    const key = String(resolved.instanceKey || name).trim();
    if (!key) continue;
    const row = evoRows.find(
      (r) => String(r.instanceKey || "").trim().toLowerCase() === key.toLowerCase(),
    );
    if (row && evoRowIsInIdentity(row, identity)) continue;
    if (identity.has(key.toLowerCase()) || identity.has(name.toLowerCase())) continue;
    added.push(key);
    selected.push(key);
    identity.add(key.toLowerCase());
    identity.add(name.toLowerCase());
    if (row) {
      for (const id of evoRowIdentityKeys(row)) identity.add(id);
    }
  }
  return { added, selected };
}

async function persistIncomingCampaignInstances(
  campaign: DisparosCampaign,
  incoming: string[],
  evoRows: EvoInstanceTagRow[],
  opts?: { appendOnly?: boolean },
): Promise<{ added: string[]; removedBlocked: string[]; selected: string[] }> {
  const prevSelected = selectedInstanceNamesFromCampaign(campaign);
  for (const name of incoming) {
    try {
      await clearAquecedorHumanPause(name);
    } catch {
      /* não bloqueia a inclusão */
    }
    try {
      const usageMap = await loadInstanceUsageMap();
      const current = getInstanceUsageFromMap(usageMap, name);
      await persistInstanceUsage([
        {
          instanceName: name,
          useAquecedor: current?.useAquecedor !== false,
          useDisparador: true,
        },
      ]);
    } catch {
      /* não bloqueia a inclusão */
    }
  }
  const swapped =
    opts?.appendOnly === true
      ? { ...appendIncomingCampaignInstances(prevSelected, incoming, evoRows), removedBlocked: [] as string[] }
      : mergeCampaignInstancesReplacingBlocked({
          prevSelected,
          incoming,
          evoRows,
        });
  const nextSelected = swapped.added.length
    ? swapped.selected
    : Array.from(new Set([...prevSelected, ...incoming.map((n) => String(n || "").trim()).filter(Boolean)]));
  const added = swapped.added.length ? swapped.added : incoming.filter((n) => {
    const key = String(n || "").trim().toLowerCase();
    return key && !prevSelected.some((p) => p.toLowerCase() === key);
  });
  if (!added.length) {
    return { added: [], removedBlocked: swapped.removedBlocked, selected: prevSelected };
  }
  await persistCampaignSelectedInstances(campaign, nextSelected);
  queueProxyBrasilPrepareForCampaignInstances(added);
  if (swapped.removedBlocked.length) {
    queueDisableProxyBrasilForDisconnectedCampaignInstances(
      campaign,
      evoRows,
      swapped.removedBlocked,
    );
  }
  console.warn(
    `[Campanha] ${campaign.id}: entram ${added.join(", ")}${
      swapped.removedBlocked.length ? ` · saem ${swapped.removedBlocked.join(", ")}` : ""
    }.`,
  );
  return { added, removedBlocked: swapped.removedBlocked, selected: nextSelected };
}

async function applyCampaignDisconnectedSwap(
  campaign: DisparosCampaign,
  incoming: string[],
  evoRows: EvoInstanceTagRow[],
): Promise<{ added: string[]; removedBlocked: string[]; selected: string[] }> {
  const prevSelected = Array.isArray(campaign.configSnapshot?.selectedDisparadorInstances)
    ? campaign.configSnapshot.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  const swapped = mergeCampaignInstancesReplacingBlocked({
    prevSelected,
    incoming,
    evoRows,
  });
  if (!swapped.added.length) return swapped;
  await persistCampaignSelectedInstances(campaign, swapped.selected);
  if (swapped.added.length) {
    queueProxyBrasilPrepareForCampaignInstances(swapped.added);
  }
  if (swapped.removedBlocked.length) {
    queueDisableProxyBrasilForDisconnectedCampaignInstances(
      campaign,
      evoRows,
      swapped.removedBlocked,
    );
  }
  await reconcileProxyBrasilForLiveCampaign(campaign, swapped.removedBlocked, false, false);
  console.warn(
    `[Campanha] Troca de instâncias ${campaign.id}: saem ${swapped.removedBlocked.join(", ") || "—"} · entram ${swapped.added.join(", ")}`,
  );
  return swapped;
}

async function tryAutoSwapDisconnectedCampaignInstances(
  campaign: DisparosCampaign,
  evoRows: EvoInstanceTagRow[],
): Promise<{ swapped: boolean; spareCount: number }> {
  const health = getCampaignInstanceHealth(campaign.configSnapshot, evoRows);
  if (health.disconnectedCount <= 0) {
    return { swapped: false, spareCount: 0 };
  }
  const lastAt = campaignAutoSwapAtMs.get(campaign.id) || 0;
  if (Date.now() - lastAt < CAMPAIGN_AUTO_SWAP_COOLDOWN_MS) {
    return { swapped: false, spareCount: -1 };
  }
  const toAdd = Math.max(computeCampaignInstancesToAdd(health), health.disconnectedCount);
  const selectedNames = selectedDisparadorNamesFromConfig(campaign.configSnapshot);
  const heuristic = listConnectedSpareEvoNames(campaign.id, selectedNames, evoRows, toAdd);
  const incoming = heuristic.length
    ? heuristic
    : await resolveLiveSpareEvoNames(campaign.id, selectedNames, evoRows, toAdd);
  if (!incoming.length) {
    return { swapped: false, spareCount: 0 };
  }
  campaignAutoSwapAtMs.set(campaign.id, Date.now());
  const result = await applyCampaignDisconnectedSwap(campaign, incoming, evoRows);
  return { swapped: result.added.length > 0, spareCount: incoming.length };
}

/** Texto exibido na UI para status pausada — prioriza regra de saúde atual. */
function describeCampaignPauseDetail(
  instanceHealth?: CampaignInstanceHealth,
  options?: { sentCount?: number; storedReason?: string; disconnectedNames?: string[] }
): string {
  const health = instanceHealth;
  const parts: string[] = [];
  const offlineNames = (options?.disconnectedNames || [])
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const offlineSuffix = offlineNames.length ? " — offline: " + offlineNames.join(", ") : "";
  if (health?.needsMoreInstancesForMinimum === true) {
    parts.push(
      "apenas " +
        health.connectedCount +
        " de " +
        Math.max(health.selectedCount, health.connectedCount) +
        " números conectados (mínimo " +
        health.minConnectedRequired +
        "; faltam " +
        health.missingConnectedForMinimum +
        ")" +
        offlineSuffix
    );
  }
  if (health?.shouldPauseByDisconnectedRatio === true) {
    parts.push(
      health.disconnectedPercent +
        "% das instâncias selecionadas estão desconectadas (" +
        health.disconnectedCount +
        " de " +
        health.selectedCount +
        ")" +
        offlineSuffix
    );
  }
  if (parts.length) {
    return "Pausa automática por saúde: " + parts.join("; ") + ".";
  }
  const stored = String(options?.storedReason || "").trim();
  if (stored) return stored;
  if ((options?.sentCount ?? 0) <= 0) {
    return "Aguardando ativação. Clique em Ativar campanha para iniciar os disparos.";
  }
  // Sem motivo gravado: NÃO assumir clique em Pausar (pausas automáticas antigas perdiam o reason).
  return "Campanha pausada automaticamente. Verifique a conexão das instâncias e ative novamente.";
}

function pauseReasonFromInstanceHealth(
  health: CampaignInstanceHealth,
  disconnectedNames?: string[]
): string {
  return describeCampaignPauseDetail(health, { disconnectedNames });
}

function resolveUsageFromMap(
  usageMap: Map<string, InstanceUsageConfig>,
  instanceName: string
): InstanceUsageConfig | undefined {
  const key = String(instanceName || "").trim();
  if (!key) return undefined;
  const direct = usageMap.get(key);
  if (direct) return direct;
  const target = key.toLowerCase();
  for (const [mapKey, value] of usageMap.entries()) {
    if (mapKey.toLowerCase() === target) return value;
  }
  return undefined;
}

async function filterDisparadorInstancesReadyForAuth(
  auth: ReturnType<typeof resolveWabaRequestAuth>,
  names: string[]
): Promise<string[]> {
  const allowed = await wabaFazendaPoolService.filterDisparadorInstancesForAuth(auth, names);
  return filterInstancesLifecycleReady(allowed);
}

async function resolveAutoInstancesForCampaign(
  auth: ReturnType<typeof resolveWabaRequestAuth>,
  config: DisparosConfig | undefined | null,
  evoRows: EvoInstanceTagRow[],
  maxToAdd: number,
  exceptCampaignId?: string,
): Promise<string[]> {
  if (maxToAdd <= 0) return [];

  const prevSelected = new Set(
    (Array.isArray(config?.selectedDisparadorInstances) ? config.selectedDisparadorInstances : [])
      .map((n) => String(n || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const heldOther = new Set(
    heldProxyBrasilNamesFromLiveCampaigns(exceptCampaignId).map((n) => n.toLowerCase()),
  );

  const connectedByKey = new Map<string, EvoInstanceTagRow>();
  for (const row of evoRows) {
    const key = String(row.instanceKey || "").trim().toLowerCase();
    if (key && row.connected === true) {
      connectedByKey.set(key, row);
    }
  }

  const usageMap = await loadInstanceUsageMap();
  const activationRepository = new AlternativaNumberActivationRepository();
  const email = String(auth.email || "").trim().toLowerCase();
  const activations = email.includes("@") ? activationRepository.listForEmail(email) : [];
  const activationKeys = new Set(
    activations.map((row) => String(row.instanceName || "").trim().toLowerCase()).filter(Boolean)
  );

  const purchasedConnected: string[] = [];
  const aquecedorConnected: string[] = [];

  for (const row of activations) {
    const name = String(row.instanceName || "").trim();
    const key = name.toLowerCase();
    if (!name || prevSelected.has(key) || heldOther.has(key) || !connectedByKey.has(key)) continue;
    const usage = resolveUsageFromMap(usageMap, name);
    if (usage?.useDisparador === false) continue;
    purchasedConnected.push(name);
  }

  const ownedCandidates = await wabaInstanceOwnershipService.filterInstanceNamesForAuth(
    auth,
    Array.from(connectedByKey.values()).map((row) => row.instanceKey)
  );
  for (const name of ownedCandidates) {
    const key = String(name || "").trim().toLowerCase();
    if (!key || prevSelected.has(key) || heldOther.has(key) || activationKeys.has(key)) continue;
    const usage = resolveUsageFromMap(usageMap, name);
    if (usage?.useDisparador === false) continue;
    aquecedorConnected.push(String(name).trim());
  }

  const ordered = Array.from(new Set([...purchasedConnected, ...aquecedorConnected]));
  const allowed = await filterDisparadorInstancesReadyForAuth(auth, ordered);
  return allowed.slice(0, maxToAdd);
}

function describeEvoQrFailure(
  createStatus: number,
  qrStatus: number,
  createDetail: string,
  qrDetail: string,
): string {
  const detail = String(qrDetail || createDetail || "").trim();
  if (isIgnorableEvoQrFetchError(qrStatus, detail)) {
    return "Sistema WABA - Drax: use GET /instance/connect para QR. Tente «Atualizar QR» novamente.";
  }
  if (createStatus === 404 || qrStatus === 404 || /404 page not found/i.test(detail)) {
    return "Sistema WABA - Drax indisponível (404). Verifique EVO_API_URL e se o sistema WABA - Drax está no ar.";
  }
  if (createStatus === 0 || qrStatus === 0) {
    if (/self-signed certificate|DEPTH_ZERO_SELF_SIGNED_CERT/i.test(detail)) {
      return "Sistema WABA - Drax com certificado TLS inválido. Defina EVO_TLS_INSECURE=1 no ambiente de desenvolvimento.";
    }
    if (/timeout/i.test(detail)) {
      return "Sistema WABA - Drax demorou para gerar o QRCode (timeout). Tente «Atualizar QR» ou aumente EVO_HTTP_TIMEOUT_MS no servidor.";
    }
    return `Sistema WABA - Drax sem resposta (${detail || "erro de rede ou timeout"}). Verifique EVO_API_URL e se o sistema WABA - Drax está no ar.`;
  }
  if (isEvoConnectEmptyQrDetail(detail)) {
    return "O sistema WABA - Drax não retornou QRCode (count:0). A sessão pode estar iniciando — aguarde e use «Atualizar QR». Se persistir, reinicie o serviço no Easypanel no Easypanel.";
  }
  const summarized = summarizeEvolutionErrorDetail(detail, qrStatus || createStatus);
  if (summarized && summarized !== detail) return summarized;
  if (detail) return `Sistema WABA - Drax: ${detail}`;
  return "Dados salvos, mas falha ao gerar QRCode na EVO. Tente «Atualizar QR».";
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
    return "Sistema WABA - Drax com erro interno no banco (Prisma/integrationSession). Reinicie o serviço no Easypanel e confira o PostgreSQL da EVO.";
  }
  if (status === 500 || /internal server error/i.test(text)) {
    const first =
      text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) || text;
    if (first.length > 220) return `Sistema WABA - Drax erro 500: ${first.slice(0, 200)}…`;
    return `Sistema WABA - Drax erro 500: ${first}`;
  }
  if (text.length > 400) return `${text.slice(0, 380)}…`;
  return text;
}

function describeEvoInstancesFetchError(status: number, detail: string): string {
  const normalized = summarizeEvolutionErrorDetail(detail, status);
  if (status === 404 || /404 page not found/i.test(normalized)) {
    return "Sistema WABA - Drax indisponível (404). Verifique EVO_API_URL / Traefik no VPS ou use ambiente local no .env.v02.";
  }
  if (status === 0 && /self-signed certificate|DEPTH_ZERO_SELF_SIGNED_CERT/i.test(normalized)) {
    return "Sistema WABA - Drax com certificado TLS inválido. Defina EVO_TLS_INSECURE=1 no .env.v02.";
  }
  if (status === 0) {
    return `Sistema WABA - Drax sem resposta (${normalized || "erro de rede ou timeout"}).`;
  }
  return normalized || "Erro ao buscar dados no sistema WABA - Drax.";
}

async function callEvoAction(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, any>,
  options?: { timeoutMs?: number; retries?: number },
) {
  const result = await evoHttpRequestWithBaseFailover(url, method, {
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
      String(result.body || result.error || "Erro ao buscar instâncias no sistema WABA - Drax."),
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
  const keys = await resolveInstanceDeletionKeys(instanceName);
  if (!keys.length) return;
  const cache = await loadEvoInstancesCache();
  if (!cache?.items?.length) return;
  const blocked = new Set(keys.map((k) => k.toLowerCase()));
  const nextItems = cache.items.filter(
    (row) => !blocked.has(String(row?.name || "").trim().toLowerCase()),
  );
  if (nextItems.length === cache.items.length) return;
  await saveEvoInstancesCache(nextItems);
}

async function resolveInstanceDeletionKeys(instanceName: string): Promise<string[]> {
  const name = String(instanceName || "").trim();
  if (!name) return [];
  const keys = new Set<string>([name]);
  const aliasesMap = await loadInstanceAliasesMap();
  const alias = mapGetInsensitive(aliasesMap, name);
  if (alias) keys.add(alias);
  for (const [technical, technicalAlias] of aliasesMap.entries()) {
    const comparable = [technical, technicalAlias].map((v) => String(v || "").trim().toLowerCase());
    const nameLower = name.toLowerCase();
    if (comparable.includes(nameLower)) {
      keys.add(technical);
      if (technicalAlias) keys.add(technicalAlias);
    }
  }
  const candidates = await resolveEvoInstanceNameCandidates(name);
  for (const candidate of candidates) keys.add(candidate);
  try {
    const evoList = await fetchEvoInstancesList();
    if (evoList.ok) {
      for (const inst of evoList.instances) {
        const evoKey = resolveEvoInstanceKey(inst);
        if (!evoKey) continue;
        const evoLower = evoKey.toLowerCase();
        if ([...keys].some((k) => k.toLowerCase() === evoLower)) keys.add(evoKey);
      }
    }
  } catch {
    // lista EVO opcional
  }

  const queryDigits = String(name || "").replace(/\D/g, "");
  if (queryDigits.length >= 8) {
    for (const registeredKey of await wabaInstanceOwnershipService.listAllRegisteredInstanceNames()) {
      const keyDigits = String(registeredKey || "").replace(/\D/g, "");
      if (!keyDigits || keyDigits.length < 8) continue;
      const matched =
        brazilWhatsAppNumbersMatch(keyDigits, queryDigits) ||
        keyDigits === queryDigits ||
        keyDigits.endsWith(queryDigits.slice(-8)) ||
        queryDigits.endsWith(keyDigits.slice(-8));
      if (matched) keys.add(registeredKey);
    }
  }

  return Array.from(keys).filter(Boolean);
}

async function resolveInstanceNamesByPhone(phone: string): Promise<string[]> {
  const query = String(phone || "").replace(/\D/g, "");
  if (query.length < 8) return [];
  const names = new Set<string>();
  for (const variant of expandBrazilWhatsAppNumberVariants(query)) {
    names.add(variant);
  }

  const evoList = await fetchEvoInstancesList();
  if (evoList.ok) {
    for (const inst of evoList.instances) {
      const instanceName = resolveEvoInstanceKey(inst);
      const number =
        extractPhoneFromEvoListItem(inst)?.phone || extractInstanceNumber(inst);
      if (!instanceName || !number) continue;
      if (brazilWhatsAppNumbersMatch(number, query)) names.add(instanceName);
    }
  }

  for (const key of await wabaInstanceOwnershipService.listAllRegisteredInstanceNames()) {
    const keyDigits = String(key || "").replace(/\D/g, "");
    if (!keyDigits || keyDigits.length < 8) continue;
    if (brazilWhatsAppNumbersMatch(keyDigits, query) || key.toLowerCase().includes(query.slice(-8))) {
      names.add(key);
    }
  }

  return Array.from(names).filter(Boolean);
}

async function filterDeletedInstancesFromItems<T>(
  items: T[],
  readName: (item: T) => string,
): Promise<T[]> {
  const filtered: T[] = [];
  for (const item of items) {
    const name = String(readName(item) || "").trim();
    if (!name) continue;
    if (await wabaInstanceOwnershipService.isInstanceDeleted(name)) continue;
    filtered.push(item);
  }
  return filtered;
}

function canDeleteInstanceLocallyAfterEvoFailure(status: number, body: string): boolean {
  if (status === 0) return true;
  if (status === 404) return true;
  if (status >= 400 && status <= 599) return true;
  const normalized = String(body || "").toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("não encontr") ||
    normalized.includes("nao encontr") ||
    normalized.includes("does not exist") ||
    normalized.includes("instance not")
  );
}

function mapDeleteInsensitive(map: Map<string, string>, rawKey: string): boolean {
  const target = String(rawKey || "").trim().toLowerCase();
  if (!target) return false;
  let removed = false;
  for (const key of [...map.keys()]) {
    if (key.toLowerCase() === target) {
      map.delete(key);
      removed = true;
    }
  }
  return removed;
}

async function removeInstanceUsageConfig(instanceName: string): Promise<void> {
  const target = String(instanceName || "").trim().toLowerCase();
  if (!target) return;
  for (const key of [...instanceUsageMemory.keys()]) {
    if (key.toLowerCase() === target) instanceUsageMemory.delete(key);
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const usageMap = await loadInstanceUsageMap();
    const keysToDelete = [...usageMap.keys()].filter((key) => key.toLowerCase() === target);
    for (const key of keysToDelete) {
      await (supabase.from("instancias_uso_config" as any) as any)
        .delete()
        .eq("instance_name", key);
    }
  } catch {
    // fallback em memória
  }
}

async function purgeInstanceLocalState(instanceName: string): Promise<void> {
  const purgeKeys = await resolveInstanceDeletionKeys(instanceName);
  if (!purgeKeys.length) return;

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
  if (aliasesChanged) await persistInstanceAliasesMap(aliasesMap);

  const whatsappMap = await loadWhatsappProfileNamesMap();
  let whatsappChanged = false;
  for (const key of purgeKeys) {
    if (mapDeleteInsensitive(whatsappMap, key)) whatsappChanged = true;
  }
  if (whatsappChanged) await persistWhatsappProfileNamesMap(whatsappMap);

  for (const key of purgeKeys) {
    await removeInstanceUsageConfig(key);
    // NÃO apagar aquecedor-instance-lifecycle: exclusão/recriação da EVO deve
    // preservar activatedAt e nível de aquecimento (foguinhos) do mesmo nome.
    await wabaInstanceOwnershipService.removeOwner(key);
  }
  await wabaInstanceOwnershipService.markInstancesDeleted(purgeKeys);
  await removeInstanceFromEvoCache(instanceName);
}

function buildEvoDeleteCandidateUrls(instanceName: string): string[] {
  const enc = encodeURIComponent(String(instanceName || "").trim());
  const templateUrl = buildTemplateUrl(EVO_DELETE_URL_TEMPLATE, instanceName);
  return Array.from(
    new Set(
      [
        templateUrl,
        `${EVO_API_BASE}/instance/delete/${enc}`,
        `${EVO_API_BASE}/instance/deleteInstance/${enc}`,
      ].filter(Boolean),
    ),
  );
}

async function tryDeleteEvoInstance(instanceName: string): Promise<{
  ok: boolean;
  status: number;
  body: string;
  evoDeleted: boolean;
}> {
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

async function attachAquecedorMessageStatsToInstanceItems(
  items: Array<Record<string, unknown>>,
  ownerEmail: string,
): Promise<Array<Record<string, unknown>>> {
  const names = items.map((row) => String(row?.name || "").trim()).filter(Boolean);
  if (!names.length) return items;
  const numberByInstance = new Map<string, string>();
  for (const row of items) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    const number = String(row?.number || row?.numero || "").trim();
    if (number) numberByInstance.set(name, number);
  }
  const stats = await getAquecedorMessageStatsForInstances(names, {
    ownerEmail,
    supabase: getSupabaseClient(),
    numberByInstance,
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

async function enrichInstanceItemsWithLiveConnection(
  items: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  return Promise.all(
    items.map(async (row) => {
      const name = String(row?.name || "").trim();
      if (!name) return row;

      const liveState = await fetchEvoInstanceLiveState(name, { fresh: true });
      const next: Record<string, unknown> = { ...row };

      if (liveState) {
        next.connectionStatus = liveState;
        next.liveConnectionStatus = liveState;
        const restriction = await syncWhatsappConnectingRestriction(name, liveState);
        next.waRestrictionUntil = restriction?.restrictedUntil || null;
        next.waRestrictionDetectedAt = restriction?.detectedAt || null;
      } else {
        // Sem live: não manter "open" fantasma do cache (causa oscilação conectado/desconectado).
        const cached = String(row.connectionStatus || "").trim().toLowerCase();
        if (cached === "open" || cached.includes("open")) {
          next.connectionStatus = "unknown";
          next.liveConnectionStatus = "unknown";
        }
      }

      // Número: EVO costuma ter number=null e ownerJid preenchido (ex.: 1261 pós device_removed).
      const currentNumber = String(next.number || "").trim();
      if (!currentNumber) {
        const fromFields = extractInstanceNumber(next);
        if (fromFields) {
          next.number = fromFields.includes("@") ? fromFields.split("@")[0] : fromFields;
        } else {
          try {
            const resolved = await resolveEvoInstancePhone(name);
            if (resolved) next.number = resolved;
          } catch {
            /* opcional */
          }
        }
      }

      return next;
    }),
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
  const campaignNames = liveCampaignInstanceNamesForOwner(auth.email);
  const listedNames = Array.from(new Set([...ownedNames, ...campaignNames]));
  const cache = await loadEvoInstancesCache();
  const cacheByName = new Map<string, Record<string, unknown>>();
  for (const row of cache?.items || []) {
    const name = String(row?.name || "").trim();
    if (name) cacheByName.set(name.toLowerCase(), row);
  }

  const aliasesMap = await loadInstanceAliasesMap();
  const whatsappNamesMap = await loadWhatsappProfileNamesMap();

  const items = listedNames.map((instanceName) => {
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

  const liveItems = await enrichInstanceItemsWithLiveConnection(
    items as Array<Record<string, unknown>>,
  );

  const ativas = liveItems.filter((row) =>
    String(row?.connectionStatus || "").toLowerCase() === "open",
  ).length;

  const enrichedItems = await attachAquecedorMessageStatsToInstanceItems(
    liveItems,
    auth.email || "",
  );

  // Atualiza connectionStatus + number das instâncias do dono (não apaga o restante do cache).
  if (cache?.items?.length) {
    const liveByName = new Map(
      enrichedItems.map((row) => [
        String(row?.name || "").trim().toLowerCase(),
        {
          status: String(row?.connectionStatus || "").trim().toLowerCase(),
          number: String(row?.number || "").trim(),
        },
      ]),
    );
    let cacheDirty = false;
    const nextCacheItems = cache.items.map((row) => {
      const key = String(row?.name || "").trim().toLowerCase();
      const live = liveByName.get(key);
      if (!live || !key) return row;
      let changed = false;
      let next = row;
      if (
        live.status &&
        String(row?.connectionStatus || "").trim().toLowerCase() !== live.status
      ) {
        next = { ...next, connectionStatus: live.status };
        changed = true;
      }
      if (live.number && !String(row?.number || "").trim()) {
        next = { ...next, number: live.number };
        changed = true;
      }
      if (changed) cacheDirty = true;
      return next;
    });
    if (cacheDirty) {
      void saveEvoInstancesCache(nextCacheItems);
    }
  }

  return {
    total: enrichedItems.length,
    ativas,
    desconectadas: enrichedItems.length - ativas,
    items: enrichedItems,
    fromCache: true,
    cacheUpdatedAt: String(cache?.updatedAt || new Date().toISOString()),
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
  const timeoutMs = defaultEvoSendTextTimeoutMs();
  let last: Awaited<ReturnType<typeof callEvoAction>> | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await callEvoAction(url, "POST", body, { timeoutMs, retries: 2 });
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
    const detailStr = String(last.body || last.error || "");
    const isTransient = isEvoSendTransientError(detailStr, last.status);
    if (!isTransient || attempt >= maxAttempts) break;
    const waitMs = Math.floor(500 * Math.pow(2, attempt - 1) + Math.random() * 250);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  if (last && !last.ok) {
    const detailStr = String(last.body || last.error || "");
    const recovered = await recoverEvoSendTextAfterFailure({
      url,
      body,
      apiKey: EVO_API_KEY,
      timeoutMs,
      status: last.status,
      detail: detailStr,
    });
    const recoveredAccepted =
      recovered.ok && isEvoSendTextAccepted(recovered.json, recovered.body);
    if (recoveredAccepted) {
      return {
        ok: true,
        status: recovered.status,
        body: recovered.body,
        json: recovered.json as any,
        error: recovered.error,
      };
    }
    if (recovered.status && recovered.body) {
      last = {
        ok: false,
        status: recovered.status,
        body: recovered.body,
        json: recovered.json as any,
        error: recovered.error,
      };
    }
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

async function assertAquecedorInstancesOpenForSend(
  origem: string,
  destino: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [originState, destState] = await Promise.all([
    fetchEvoInstanceLiveState(origem),
    fetchEvoInstanceLiveState(destino),
  ]);
  if (!isEvoLiveStateOpen(originState)) {
    return {
      ok: false,
      reason: `${origem} não está open no sistema WABA - Drax (connectionState=${originState || "desconhecido"}). fetchInstances pode mostrar "open" incorretamente — reconecte o QR ou reinicie o sistema WABA - Drax.`,
    };
  }
  if (!isEvoLiveStateOpen(destState)) {
    return {
      ok: false,
      reason: `${destino} não está open no sistema WABA - Drax (connectionState=${destState || "desconhecido"}). Reconecte o WhatsApp do destino.`,
    };
  }
  return { ok: true };
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

function resolveAquecedorInstanceDigits(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const prefix = text.includes("@") ? text.split("@")[0] : text;
  return prefix.replace(/\D/g, "");
}

function toAquecedorRemoteJid(num: string): string {
  const digits = resolveAquecedorInstanceDigits(String(num || "").trim());
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function buildAquecedorRemoteJidCandidates(num: string): string[] {
  const rawDigits = resolveAquecedorInstanceDigits(num);
  if (!rawDigits) return [];
  const out = new Set<string>();
  const add = (digits: string) => {
    const d = String(digits || "").replace(/\D/g, "");
    if (d) out.add(`${d}@s.whatsapp.net`);
  };
  // Inclui variantes BR com/sem 9º dígito e com/sem DDI 55.
  for (const variant of expandBrazilWhatsAppNumberVariants(rawDigits)) {
    add(variant);
  }
  if (rawDigits.length === 10) {
    add(`1${rawDigits}`);
  }
  if (rawDigits.startsWith("1") && rawDigits.length >= 11) {
    add(rawDigits.slice(1));
  }
  const legacyBr = normalizeWhatsAppNumber(num);
  if (legacyBr) add(legacyBr);
  return Array.from(out);
}

async function resolveEvoInstanceNameCandidates(displayName: string): Promise<string[]> {
  const raw = String(displayName || "").trim();
  if (!raw) return [];
  const aliasesMap = await loadInstanceAliasesMap();
  const candidates = new Set<string>([raw]);
  for (const [technical, alias] of aliasesMap.entries()) {
    if (technical.toLowerCase() === raw.toLowerCase()) candidates.add(technical);
    if (alias.toLowerCase() === raw.toLowerCase()) candidates.add(technical);
  }
  return Array.from(candidates);
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

function evoChatTextsIncludeMarker(node: unknown, marker: string): boolean {
  return evoPayloadIncludesNeedle(node, [marker]);
}

function evoChatTextsIncludeNeedle(node: unknown, needles: string[]): boolean {
  return evoPayloadIncludesNeedle(node, needles);
}

async function probeAquecedorDeliveryViaFindMessages(
  instanceCandidates: string[],
  remoteJids: string[],
  needles: string[],
  minTimestampMs?: number,
  fromMe: boolean | null = null,
): Promise<boolean> {
  for (const instanceName of instanceCandidates) {
    const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(instanceName)}`;
    for (const remoteJid of remoteJids) {
      const bodies = buildAquecedorFindMessagesBodies(remoteJid, fromMe);
      for (const body of bodies) {
        const result = await callEvoAction(url, "POST", body, {
          timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 25000),
          retries: 1,
        });
        if (!result.ok) continue;
        if (
          evoPayloadIncludesNeedle(result.json, needles, {
            minTimestampMs,
            fromMe,
            requireTokenBoundary: true,
          })
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

async function probeAquecedorDeliveryViaFindChats(
  instanceCandidates: string[],
  needles: string[],
  minTimestampMs?: number,
): Promise<boolean> {
  for (const instanceName of instanceCandidates) {
    const urls = [
      `${EVO_API_BASE}/chat/findChats/${encodeURIComponent(instanceName)}`,
      `${EVO_API_BASE}/chat/findChats`,
    ];
    for (const url of urls) {
      const bodies: Array<Record<string, unknown>> = [{}, { limit: 40 }, { take: 40 }];
      for (const body of bodies) {
        const result = await callEvoAction(url, "POST", body, {
          timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 20000),
          retries: 1,
        });
        if (!result.ok) continue;
        if (
          evoPayloadIncludesNeedle(result.json, needles, {
            minTimestampMs,
            requireTokenBoundary: true,
          })
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

async function verifyAquecedorMessageDelivered(
  instanciaDestino: string,
  numeroOrigem: string,
  messageText: string,
  options?: {
    instanciaOrigem?: string;
    numeroDestino?: string;
    sendStartedAtMs?: number;
    maxAttempts?: number;
    /** Margem extra antes do envio ao filtrar timestamp (relógio EVO). */
    timestampGraceMs?: number;
    skipInitialDelay?: boolean;
    attemptIntervalMs?: number;
    relaxTimestampOnLastAttempt?: boolean;
    ackStatusHint?: EvoMessageAckStatus | string | null;
    messageId?: string;
  },
): Promise<{ ok: boolean; detail: string; sawOrigem: boolean; sawDestino: boolean }> {
  const destino = String(instanciaDestino || "").trim();
  const remoteJids = buildAquecedorRemoteJidCandidates(numeroOrigem);
  if (!destino) {
    return {
      ok: false,
      detail: "Parâmetros inválidos para conferir entrega no destinatário.",
      sawOrigem: false,
      sawDestino: false,
    };
  }

  const needleList = buildAquecedorDeliveryNeedles(messageText);
  if (!needleList.length) {
    return {
      ok: false,
      detail: "Sem marcador único para conferir entrega no WhatsApp.",
      sawOrigem: false,
      sawDestino: false,
    };
  }
  const timestampGraceMs = options?.timestampGraceMs ?? 5000;
  const minTimestampMs = (options?.sendStartedAtMs ?? Date.now()) - timestampGraceMs;
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 12);
  const attemptIntervalMs = Math.max(1000, options?.attemptIntervalMs ?? 3000);
  const skipInitialDelay = options?.skipInitialDelay === true;
  const relaxTimestampOnLastAttempt = options?.relaxTimestampOnLastAttempt === true;
  const destinoCandidates = await resolveEvoInstanceNameCandidates(destino);
  const origem = String(options?.instanciaOrigem || "").trim();
  const numeroDestino = resolveAquecedorInstanceDigits(String(options?.numeroDestino || ""));
  const origemCandidates = origem ? await resolveEvoInstanceNameCandidates(origem) : [];
  const destJids = numeroDestino ? buildAquecedorRemoteJidCandidates(numeroDestino) : [];
  let liveAck = options?.ackStatusHint ?? null;
  const messageId = String(options?.messageId || "").trim();

  if (isEvoAckFailure(liveAck)) {
    return decideAquecedorDeliveryConfirmation({
      sawOrigem: true,
      sawDestino: false,
      origem,
      destino,
      ackStatus: liveAck,
    });
  }

  // DELIVERY_ACK/READ já prova aparelho — evita falso negativo @lid no findMessages.
  if (isEvoAckDeviceDelivered(liveAck)) {
    return decideAquecedorDeliveryConfirmation({
      sawOrigem: true,
      sawDestino: false,
      origem,
      destino,
      ackStatus: liveAck,
    });
  }

  if (!skipInitialDelay) {
    await sleepMs(3000);
  }

  let sawDestino = false;
  let sawOrigem = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await sleepMs(attemptIntervalMs);
    const tsFilter =
      relaxTimestampOnLastAttempt && attempt === maxAttempts ? undefined : minTimestampMs;

    if (messageId && origem && !isEvoAckDeviceDelivered(liveAck) && !isEvoAckFailure(liveAck)) {
      const refreshed = await probeAquecedorSendAckStatus(origem, messageId, {
        maxAttempts: 1,
        intervalMs: 500,
      });
      liveAck = refreshed.status;
      if (isEvoAckFailure(liveAck) || isEvoAckDeviceDelivered(liveAck)) {
        return decideAquecedorDeliveryConfirmation({
          sawOrigem: sawOrigem || isEvoAckDeviceDelivered(liveAck),
          sawDestino,
          origem,
          destino,
          ackStatus: liveAck,
        });
      }
    }

    if (!sawDestino) {
      sawDestino = await probeAquecedorDeliveryViaFindMessages(
        destinoCandidates,
        remoteJids,
        needleList,
        tsFilter,
        false,
      );
      if (!sawDestino) {
        // @lid / indexação EVO: marker em mensagens recentes + findChats.lastMessage.
        sawDestino = await probeAquecedorDeliveryViaFindMessages(
          destinoCandidates,
          remoteJids.length ? remoteJids : [""],
          needleList,
          tsFilter,
          null,
        );
      }
      if (!sawDestino) {
        sawDestino = await probeAquecedorDeliveryViaFindChats(
          destinoCandidates,
          needleList,
          tsFilter,
        );
      }
    }
    if (!sawOrigem && origemCandidates.length && destJids.length) {
      sawOrigem = await probeAquecedorDeliveryViaFindMessages(
        origemCandidates,
        destJids,
        needleList,
        tsFilter,
        true,
      );
    }
    // Sucesso prático: tag no destino (chegou no WhatsApp). Não espera origem.
    if (sawDestino) {
      return decideAquecedorDeliveryConfirmation({
        sawOrigem,
        sawDestino,
        origem,
        destino,
        ackStatus: liveAck,
      });
    }
  }

  return decideAquecedorDeliveryConfirmation({
    sawOrigem,
    sawDestino,
    origem,
    destino,
    ackStatus: liveAck,
  });
}

function extractAquecedorSendMessageId(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const root = json as Record<string, unknown>;
  const key = root.key as Record<string, unknown> | undefined;
  const id = String(key?.id || root.id || "").trim();
  return id;
}

async function probeAquecedorSendAckStatus(
  instanceName: string,
  messageId: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<{ status: EvoMessageAckStatus }> {
  const name = String(instanceName || "").trim();
  const id = String(messageId || "").trim();
  if (!name || !id) return { status: "UNKNOWN" };
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 4);
  const intervalMs = Math.max(500, options?.intervalMs ?? 2000);
  let last: EvoMessageAckStatus = "UNKNOWN";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await sleepMs(intervalMs);
    const statusUrl = `${EVO_API_BASE}/chat/findStatusMessage/${encodeURIComponent(name)}`;
    const statusResult = await callEvoAction(
      statusUrl,
      "POST",
      { where: { id } },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 15000), retries: 1 },
    );
    if (statusResult.ok) {
      last = extractEvoMessageAckStatus(statusResult.json);
      if (isEvoAckFailure(last) || last === "SERVER_ACK" || last === "DELIVERY_ACK" || last === "READ") {
        return { status: last };
      }
    }
    const msgUrl = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(name)}`;
    const msgResult = await callEvoAction(
      msgUrl,
      "POST",
      { where: { key: { id } } },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 20000), retries: 1 },
    );
    if (msgResult.ok) {
      last = extractEvoMessageAckStatus(msgResult.json);
      if (isEvoAckFailure(last) || last === "SERVER_ACK" || last === "DELIVERY_ACK" || last === "READ") {
        return { status: last };
      }
    }
  }
  return { status: last };
}

async function probeAquecedorInstanceOutboundHealth(
  instanceName: string,
): Promise<"healthy" | "broken" | "unknown"> {
  const name = String(instanceName || "").trim();
  if (!name) return "unknown";
  const cached = getCachedAquecedorOutboundHealth(name);
  if (cached) return cached.class;

  const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(name)}`;
  const result = await callEvoAction(
    url,
    "POST",
    { where: { key: { fromMe: true } }, page: 1, offset: 20 },
    { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 20000), retries: 1 },
  );
  if (!result.ok) {
    rememberAquecedorOutboundHealth(name, "unknown");
    return "unknown";
  }
  const evaluated = evaluateOutboundSamplePayload(result.json);
  rememberAquecedorOutboundHealth(name, evaluated.class, {
    sampleSize: evaluated.sampleSize,
    errorCount: evaluated.errorCount,
  });
  return evaluated.class;
}

async function filterAquecedorConnectedByOutboundHealth(
  connected: Array<{ instancia: string; numero: string }>,
): Promise<Array<{ instancia: string; numero: string }>> {
  if (!connected.length) return connected;
  const kept: Array<{ instancia: string; numero: string }> = [];
  const dropped: string[] = [];
  for (const row of connected) {
    const health = await probeAquecedorInstanceOutboundHealth(row.instancia);
    if (health === "broken") {
      dropped.push(row.instancia);
      continue;
    }
    kept.push(row);
  }
  if (dropped.length) {
    console.warn(
      `[Aquecedor] excluídas do ciclo (outbound MessageUpdate=ERROR): ${dropped.join(", ")}. Reconecte o QR dessas instâncias na EVO.`,
    );
    aquecedorCycleRuntime().lastResult =
      `Instâncias com outbound quebrado (open mas MessageUpdate=ERROR) fora do ciclo: ${dropped.join(", ")}. Reconecte o QR na Evolution.`;
  }
  return kept;
}

function buildAquecedorSendNumberCandidates(raw: string): string[] {
  const seed = resolveAquecedorInstanceDigits(raw);
  if (!seed) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const variant of expandBrazilWhatsAppNumberVariants(seed)) {
    const digits = resolveAquecedorInstanceDigits(variant);
    if (digits.length < 10 || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  // Preferir DDI+9º dígito (mais longo) primeiro.
  out.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return out;
}

async function revertAquecedorPendingAfterFailedSend(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  pendingId: string | number,
  options?: { keepInstancia?: string | null },
): Promise<void> {
  // Mantém `instancia` quando informado — senão o ensure cria OUTRA linha PENDENTE
  // (duplicata Em Fila) porque a consulta filtra por instancia=origem.
  const keepInstancia = String(options?.keepInstancia || "").trim();
  const payload: Record<string, unknown> = {
    status: "PENDENTE",
    numero_destino: null,
    processing_at: null,
    sent_at: null,
  };
  if (keepInstancia) {
    payload.instancia = keepInstancia;
  } else {
    payload.instancia = null;
  }
  await (supabase.from("aquecedor" as any) as any).update(payload).eq("id", pendingId);
}

const META_GRAPH_BASE = String(process.env.META_GRAPH_BASE || "https://graph.facebook.com").replace(
  /\/+$/,
  ""
);
const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v22.0").trim();
const META_JS_SDK_GRAPH_VERSION = String(process.env.META_ES_JS_SDK_GRAPH_VERSION || "v26.0").trim();

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

const ALTERNATIVA_OPT_OUT_SEED =
  "😊 Se não quiser mais receber minhas mensagens, é só me avisar, tá bem?";

function buildDisparosAiPrompt(input: {
  briefing?: string;
  tone?: string;
  audience?: string;
  cta?: string;
  objective?: string;
  accessLink?: string;
  /** Alternativa: mensagem sem URL; CTA vira rótulo do botão. */
  ctaMode?: "link" | "button";
  uniqueSeed?: string;
}) {
  const briefing = String(input.briefing || "").trim();
  const tone = String(input.tone || "consultivo").trim();
  const audience = String(input.audience || "CORBAN").trim();
  const cta = String(input.cta || "Quero saber mais").trim();
  const objective = String(input.objective || "gerar mensagem de prospeccao via WhatsApp").trim();
  const accessLink = String(input.accessLink || "").trim();
  const buttonMode = input.ctaMode === "button";
  const uniqueSeed = String(input.uniqueSeed || "").trim();
  const rules = buttonMode
    ? [
        "Regras:",
        "- Responda APENAS um JSON valido, sem markdown e sem texto fora do JSON.",
        '- Formato: {"body":"...","buttonLabel":"...","optOut":"..."}',
        "- body: mensagem curta (maximo 280 caracteres), pronta para WhatsApp.",
        "- Nao inclua links, URLs, wa.me nem 'http' em nenhum campo.",
        "- Nao coloque a frase de opt-out dentro de body.",
        "- Nao use asteriscos nem negrito no body (nem na abertura, nem no inicio de frases/itens).",
        "- No body, quebras de linha reais (escape JSON \\n). Nunca deixe as duas letras barra-n visiveis na mensagem.",
        "- Se enumerar 1) 2) 3) (ou 1. 2. 3.), cada item na sua propria linha.",
        `- buttonLabel: texto curto que caiba inteiro no botao. Maximo 15 caracteres. Prefira: Quero saber mais, Me inscrever, Comprar agora. CTA base: "${cta.slice(0, 15)}". Sem emoji. Sem URL. Nao descreva o botao no body.`,
        `- optOut: uma unica linha, variacao natural de: "${ALTERNATIVA_OPT_OUT_SEED}". Sem markdown. Sem URL.`,
        "- Nao mencione 'clique no link'; incentive a acao do botao de forma natural em body.",
        ...(uniqueSeed ? [`- Gere uma variante unica para este envio (id ${uniqueSeed}).`] : []),
      ]
    : [
        "Regras:",
        "- Retorne apenas uma mensagem final pronta para envio.",
        "- Mensagem curta (maximo 280 caracteres).",
        "- Nao use aspas nem explicacoes extras.",
        "- Negrito no WhatsApp: use exatamente um par de asteriscos (*termo*), nunca dois (**termo**). So se o briefing pedir enfase. Nunca deixe a abertura/saudacao em negrito.",
        accessLink
          ? `- Inclua obrigatoriamente este link na mensagem: ${accessLink}`
          : "- Quando houver link de acesso, inclua-o na mensagem.",
        `CTA obrigatoria: ${cta}.`,
      ];
  return [
    "Voce e um copywriter especialista em vendas consultivas via WhatsApp.",
    `Objetivo: ${objective}.`,
    `Publico alvo: ${audience}.`,
    `Tom: ${tone}.`,
    ...(buttonMode ? [] : [`CTA obrigatoria: ${cta}.`]),
    ...rules,
    briefing ? `Contexto adicional:\n${briefing}` : "Contexto adicional: sem observacoes.",
  ].join("\n");
}

/** Rótulos permitidos no botão URL das campanhas Alternativa. */
const ALTERNATIVA_URL_BUTTON_LABELS = [
  "Quero saber mais",
  "Mais informações",
  "Solicitar agora",
  "Me inscrever",
  "Comprar agora",
] as const;

function normalizeAlternativaUrlButtonLabel(
  raw: string,
  fallback: string = ALTERNATIVA_URL_BUTTON_LABELS[0],
): string {
  const text = String(raw || "").trim();
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const aliases: Record<string, string> = {
    "me increver": "Me inscrever",
    "me inscrever": "Me inscrever",
    "mais informacoes": "Mais informações",
    "mais informações": "Mais informações",
  };
  const folded = fold(text);
  if (aliases[folded]) return aliases[folded];
  const exact = ALTERNATIVA_URL_BUTTON_LABELS.find((opt) => opt === text);
  if (exact) return exact;
  const loose = ALTERNATIVA_URL_BUTTON_LABELS.find((opt) => fold(opt) === folded);
  return loose || fallback;
}

/** Custom labels above this get replaced by the allowlist — WhatsApp pill cuts ~20-char text. */
const ALTERNATIVA_BUTTON_LABEL_MAX_CHARS = 15;

/** Limpa rótulo da IA para o mesmo payload nativo (sem URL, markdown, emoji, quebra de linha). */
function sanitizeUrlButtonDisplayText(raw: string): string {
  return String(raw || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[*_`]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rótulo do botão WhatsApp. Allowlist inteira; rótulo longo da IA cai no fallback (não fatia no meio). */
function normalizeButtonDisplayText(
  raw: string,
  fallback: string = ALTERNATIVA_URL_BUTTON_LABELS[0],
): string {
  const fromAllowlist = normalizeAlternativaUrlButtonLabel(raw, "");
  if (fromAllowlist) return fromAllowlist;
  const candidate = sanitizeUrlButtonDisplayText(raw);
  if (candidate && [...candidate].length <= ALTERNATIVA_BUTTON_LABEL_MAX_CHARS) {
    return candidate;
  }
  const fromFallback = normalizeAlternativaUrlButtonLabel(
    fallback,
    ALTERNATIVA_URL_BUTTON_LABELS[0],
  );
  return fromFallback || ALTERNATIVA_URL_BUTTON_LABELS[0];
}

function parseJsonObjectFromModelText(raw: string): Record<string, unknown> | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function wrapWhatsAppItalic(text: string): string {
  const inner = String(text || "")
    .replace(/[_*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!inner) return "";
  return `_${inner}_`;
}

function newDisparosAiUniqueSeed(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

/** Corpo + opt-out em itálico + rótulo do botão a partir da resposta JSON do GPT. */
function assembleAlternativaButtonOutbound(
  generatedText: string,
  userCta: string,
): { text: string; buttonLabel: string } {
  const fallbackLabel = normalizeButtonDisplayText(userCta);
  const parsed = parseJsonObjectFromModelText(generatedText);
  const bodyRaw = parsed
    ? String(parsed.body || parsed.text || parsed.message || "")
    : generatedText;
  const body =
    prepareOutboundWhatsAppText(bodyRaw, { stripUrls: true }) ||
    "Olá! Temos uma novidade para você.";
  const optRaw = parsed ? String(parsed.optOut || parsed.opt_out || "") : "";
  const optClean = prepareOutboundWhatsAppText(optRaw, { stripUrls: true });
  const optLine =
    wrapWhatsAppItalic(optClean) || wrapWhatsAppItalic(ALTERNATIVA_OPT_OUT_SEED);
  const labelRaw = parsed ? String(parsed.buttonLabel || parsed.button_label || "") : "";
  const buttonLabel = normalizeButtonDisplayText(labelRaw, fallbackLabel);
  return { text: `${body}\n\n${optLine}`.trim(), buttonLabel };
}

function stripUrlsFromMessageText(message: string): string {
  return String(message || "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/\bwa\.me\/[^\s)]+/gi, "")
    .replace(
      /^[ \t]*(mais informa[cç][oõ]es|acesse aqui|veja mais|saiba mais|clique aqui)\s*:?[ \t]*$/gim,
      "",
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * A IA às vezes deixa `\n` visível (duas letras) em vez de quebra de linha.
 * Itens 1) 2) 3) na mesma linha passam cada um para a linha de baixo.
 */
function formatWhatsAppVisibleLayout(message: string): string {
  let text = String(message || "");
  for (let i = 0; i < 3; i++) {
    const next = text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
    if (next === text) break;
    text = next;
  }
  const numberedParen = (text.match(/\d{1,2}\)\s/g) || []).length;
  if (numberedParen >= 2) {
    text = text.replace(/[ \t]+(?=\d{1,2}\)\s)/g, "\n");
  }
  const numberedDot = (text.match(/(?:^|\s)\d{1,2}\.\s/g) || []).length;
  if (numberedDot >= 2) {
    text = text.replace(/[ \t]+(?=\d{1,2}\.\s)/g, "\n");
  }
  return text.replace(/\n{3,}/g, "\n\n");
}

/**
 * WhatsApp formatação: negrito = *texto* (um par).
 * GPT/Markdown costuma emitir **texto** — converter antes do envio.
 * @see https://faq.whatsapp.com/539178204879377
 */
function normalizeWhatsAppFormatting(message: string): string {
  let text = String(message || "");
  // Colapsa **...** (e ****...****) em *...* sem atravessar quebras de linha.
  for (let i = 0; i < 6; i++) {
    const next = text.replace(/\*{2,}([^*\n]+?)\*{2,}/g, "*$1*");
    if (next === text) break;
    text = next;
  }
  return text;
}

function prepareOutboundWhatsAppText(
  message: string,
  opts?: { stripUrls?: boolean },
): string {
  let text = String(message || "");
  if (opts?.stripUrls) {
    text = stripUrlsFromMessageText(text) || text;
  }
  text = formatWhatsAppVisibleLayout(text);
  return normalizeWhatsAppFormatting(text).trim();
}

function ensureMessageContainsLink(message: string, link: string, cta: string) {
  const text = prepareOutboundWhatsAppText(String(message || "").trim());
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

function isGhostButtonsPayload(raw: unknown): boolean {
  try {
    const serialized = JSON.stringify(raw ?? "");
    if (!serialized.includes("viewOnceMessage")) return false;
    // Evolution 2.4 devolve interactive/cta_url mesmo com wrapper viewOnce — botão nativo visível.
    if (
      serialized.includes("nativeFlowMessage") ||
      serialized.includes("interactiveMessage") ||
      serialized.includes("cta_url")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Remove `*negrito*` do WhatsApp; itálico `_..._` permanece (opt-out). */
function stripWhatsAppBoldMarkers(message: string): string {
  return String(message || "").replace(/\*([^*\n]+)\*/g, "$1");
}

/**
 * Evolution 2.4 `buttonMessage` monta o corpo como `*${title}*\n\n${description}`.
 * Title com as primeiras palavras vira cabeçalho em negrito no WhatsApp.
 * Title vazio/ZWSP vira `**` na digitação. NBSP não forma palavra em negrito.
 * Texto visível vai inteiro em `description`. Botão nativo vem de `buttons`.
 */
function splitMessageForUrlButton(fullText: string): { title: string; description: string } {
  const text = stripWhatsAppBoldMarkers(String(fullText || "").trim()) || "Olá!";
  const maxBody = 1024;
  let description = text;
  if (description.length > maxBody) {
    description =
      description.slice(0, maxBody).replace(/\s+\S*$/, "").trim() || description.slice(0, maxBody);
  }
  return { title: "\u00A0", description };
}

async function sendEvoAlternativaUrlButtonMessage(input: {
  instanceName: string;
  number: string;
  buttonLabel: string;
  buttonUrl: string;
  messageText: string;
}): Promise<{ ok: boolean; status: number; body: string; json?: any }> {
  const instanceName = String(input.instanceName || "").trim();
  const number = String(input.number || "").replace(/\D/g, "");
  const fullText =
    prepareOutboundWhatsAppText(String(input.messageText || "").trim(), { stripUrls: true }) ||
    "Olá!";
  const buttonLabel = normalizeButtonDisplayText(input.buttonLabel);
  const buttonUrl = String(input.buttonUrl || "").trim();
  if (!instanceName || !number || !buttonUrl) {
    return { ok: false, status: 0, body: "Dados insuficientes para sendButtons." };
  }
  const { title, description } = splitMessageForUrlButton(fullText);
  const payload = {
    number,
    title,
    description,
    footer: "",
    buttons: [
      {
        type: "url" as const,
        displayText: buttonLabel,
        url: buttonUrl,
      },
    ],
  };
  const url = `${EVO_API_BASE}/message/sendButtons/${encodeURIComponent(instanceName)}`;
  const result = await callEvoAction(url, "POST", payload, {
    timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 30_000),
    retries: 0,
  });
  if (result.ok && isGhostButtonsPayload(result.json ?? result.body)) {
    return {
      ok: false,
      status: result.status,
      body: "Evolution retornou botões fantasma (viewOnce).",
      json: result.json,
    };
  }
  return {
    ok: result.ok,
    status: result.status,
    body: String(result.body || result.error || ""),
    json: result.json,
  };
}

async function generateShortUrlForDisparos(
  longUrl: string,
  publicBaseHints?: WabaPublicBaseRequestHints,
) {
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
        const candidateShort = await shortenUrlWithProvider(
          candidateUrl,
          provider,
          "",
          publicBaseHints,
        );
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
  customDomain = "",
  publicBaseHints?: WabaPublicBaseRequestHints,
) {
  const safeLongUrl = String(longUrl || "").trim();
  if (!safeLongUrl) {
    throw new Error("URL original é obrigatória.");
  }
  if (provider === "waba") {
    try {
      return await createWabaShortUrl(safeLongUrl, {
        tenantId: "disparador",
        publicBaseHints,
      });
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

  if (provider === "isgd") {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const endpoint = `https://is.gd/create.php?format=json&url=${encodeURIComponent(safeLongUrl)}`;
      const response = await fetch(endpoint, { method: "GET", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      const short = String(data?.shorturl || "").trim();
      if (response.ok && /^https?:\/\//i.test(short)) return short;
      const errText = String(data?.errormessage || data?.error || "").slice(0, 200);
      throw new Error(`is.gd HTTP ${response.status}${errText ? `: ${errText}` : ""}`);
    } catch (error: any) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("is.gd timeout");
      }
      throw new Error(String(error?.message || "Falha no encurtador is.gd."));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (provider === "tinyurl") {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const endpoint = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(safeLongUrl)}`;
      const response = await fetch(endpoint, { method: "GET", signal: controller.signal });
      const text = String(await response.text().catch(() => "")).trim();
      if (response.ok && /^https?:\/\//i.test(text)) return text;
      throw new Error(`TinyURL HTTP ${response.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
    } catch (error: any) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("TinyURL timeout");
      }
      throw new Error(String(error?.message || "Falha no encurtador TinyURL."));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Provedor de encurtador não suportado: ${provider}`);
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
  const normalizeCandidate = (value: any, keyHint = ""): string | null => {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith("data:image")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    // Preferir base64 puro; NÃO tratar o campo `code` (ex.: "2@…") como imagem.
    const key = String(keyHint || "").toLowerCase();
    if (key === "code" || key === "pairingcode" || key === "pairing_code") return null;
    if (raw.includes("@") || raw.includes(",")) return null;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.length >= 100) return raw;
    return null;
  };

  const visit = (node: any, depth = 0, keyHint = ""): string | null => {
    if (depth > 6 || node == null) return null;

    const normalizedDirect = normalizeCandidate(node, keyHint);
    if (normalizedDirect) return normalizedDirect;

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, depth + 1, keyHint);
        if (found) return found;
      }
      return null;
    }

    if (typeof node !== "object") return null;

    // base64 antes de code — evita capturar o payload Baileys "2@…" como QR imagem.
    const priorityKeys = [
      "response",
      "qrcode",
      "qrCode",
      "qr",
      "base64",
      "data",
      "code",
      "pairingCode",
      "pairingcode",
    ];

    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = visit((node as Record<string, any>)[key], depth + 1, key);
        if (found) return found;
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (!/(qr|qrcode|base64|code|pairing)/i.test(key)) continue;
      const found = visit(value, depth + 1, key);
      if (found) return found;
    }

    return null;
  };

  return visit(payload);
}

function tryExtractPairingCode(payload: unknown): string | null {
  const normalizePairing = (value: unknown, keyHint = ""): string | null => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const key = String(keyHint || "").toLowerCase();
    if (key === "code" && (raw.includes("@") || raw.includes(","))) return null;
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(raw)) return raw.toUpperCase();
    if (/^[A-Z0-9]{8}$/i.test(raw)) {
      return `${raw.slice(0, 4).toUpperCase()}-${raw.slice(4).toUpperCase()}`;
    }
    if (
      (key === "pairingcode" || key === "pairing_code" || key === "pairingCode") &&
      /^[A-Z0-9-]{6,12}$/i.test(raw)
    ) {
      return raw.toUpperCase();
    }
    return null;
  };

  const visit = (node: unknown, depth = 0, keyHint = ""): string | null => {
    if (depth > 6 || node == null) return null;
    if (typeof node === "string" || typeof node === "number") {
      return normalizePairing(node, keyHint);
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, depth + 1, keyHint);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    const priorityKeys = ["pairingCode", "pairingcode", "pairing_code", "code"];
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const found = visit(obj[key], depth + 1, key);
        if (found) return found;
      }
    }
    for (const [key, value] of Object.entries(obj)) {
      if (!/pairing|code/i.test(key)) continue;
      const found = visit(value, depth + 1, key);
      if (found) return found;
    }
    return null;
  };

  return visit(payload);
}

function isIgnorableEvoQrFetchError(status: number, detail: string): boolean {
  const text = String(detail || "").toLowerCase();
  if (status === 404 && text.includes("/instance/qrcode/")) return true;
  if (status === 404 && text.includes("cannot get /instance/qrcode")) return true;
  if (status === 404 && text.includes("cannot post /instance/connect")) return true;
  return false;
}

function isEvoConnectEmptyQrDetail(detail: string): boolean {
  const text = String(detail || "").trim();
  if (!text) return false;
  if (/^\s*\{\s*"count"\s*:\s*0\s*\}\s*$/i.test(text)) return true;
  if (!text.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (Number(parsed?.count) !== 0) return false;
    const keys = Object.keys(parsed);
    return keys.length <= 2 && keys.every((key) => key === "count" || key === "status");
  } catch {
    return /"count"\s*:\s*0/.test(text);
  }
}

function isEvoQrRecoverableFailure(detail: string, status: number): boolean {
  if (isEvoConnectEmptyQrDetail(detail)) return true;
  if (status >= 500 || /integrationSession|prisma/i.test(detail)) return true;
  return false;
}

function rememberEvoQrFetchError(
  current: { status: number; detail: string },
  status: number,
  detail: string,
): { status: number; detail: string } {
  const nextDetail = String(detail || "").slice(0, 400);
  if (isIgnorableEvoQrFetchError(status, nextDetail)) return current;
  if (isEvoConnectEmptyQrDetail(nextDetail)) {
    if (!current.detail || (current.status >= 200 && current.status < 300)) {
      return { status: status || 200, detail: nextDetail };
    }
    return current;
  }
  if (!current.detail) return { status, detail: nextDetail };
  if (current.status === 404 && status !== 404) return { status, detail: nextDetail };
  if (isEvoConnectEmptyQrDetail(current.detail) && status >= 400) {
    return { status, detail: nextDetail };
  }
  return { status, detail: nextDetail };
}

/** Evolution API v2: QR só via GET /instance/connect/{instance} (?number= opcional). */
function buildEvoConnectQrCandidates(
  instanceName: string,
  number: string,
): Array<{ url: string; method: "GET" }> {
  const enc = encodeURIComponent(instanceName);
  const connectBase = `${EVO_API_BASE}/instance/connect/${enc}`;
  const templateUrl = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
  const bases = Array.from(new Set([connectBase, templateUrl].filter(Boolean)));

  const candidates: Array<{ url: string; method: "GET" }> = [];
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

async function prepareEvoInstanceForQrConnect(instanceName: string): Promise<void> {
  const enc = encodeURIComponent(String(instanceName || "").trim());
  if (!enc) return;
  invalidateEvoLiveStateCache(instanceName);
  const steps: Array<{ url: string; method: "DELETE" | "POST" }> = [
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

async function fetchEvoInstanceConnectionState(
  instanceName: string,
  options?: { fresh?: boolean },
): Promise<{ ok: boolean; state: string; open: boolean }> {
  const enc = encodeURIComponent(String(instanceName || "").trim());
  if (!enc) return { ok: false, state: "", open: false };
  const state = await fetchEvoInstanceLiveState(instanceName, { fresh: options?.fresh === true });
  if (state) {
    return { ok: true, state, open: isEvoLiveStateOpen(state) };
  }
  const urls = [
    `${EVO_API_BASE}/instance/connectionState/${enc}`,
    `${EVO_API_BASE}/instance/connection-state/${enc}`,
  ];
  for (const url of urls) {
    const result = await callEvoAction(url, "GET", undefined, {
      timeoutMs: 8000,
      retries: 1,
    });
    if (!result.ok && result.status === 404) continue;
    const parsedState = pickEvoConnectionState(result.json);
    if (parsedState) {
      return { ok: true, state: parsedState, open: isEvoLiveStateOpen(parsedState) };
    }
  }
  return { ok: false, state: "", open: false };
}

async function resetEvoInstanceForQr(instanceName: string): Promise<void> {
  const enc = encodeURIComponent(String(instanceName || "").trim());
  if (!enc) return;
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

/**
 * Reconexão do mesmo WhatsApp: apaga clones EVO e a sessão antiga do nome canônico.
 * Mantém foguinhos (lifecycle) e totais de envio (logs_envios) do nome canônico.
 */
async function purgeOldEvoSessionsForReconnect(input: {
  canonicalName: string;
  phone?: string;
  resetCanonical?: boolean;
}): Promise<{
  duplicatesDeleted: string[];
  canonicalReset: boolean;
  phone: string;
  hadPriorSessions: boolean;
}> {
  const canonicalName = String(input.canonicalName || "").trim();
  const duplicatesDeleted: string[] = [];
  if (!canonicalName) {
    return { duplicatesDeleted, canonicalReset: false, phone: "", hadPriorSessions: false };
  }

  const listed = await fetchEvoInstancesList();
  const instances = listed.ok ? listed.instances : [];
  let phone = normalizeEvoWhatsAppNumber(String(input.phone || ""));
  if (!phone) {
    const self = instances
      .map((item) => extractPhoneFromEvoListItem(item))
      .find((row) => row?.instanceName.toLowerCase() === canonicalName.toLowerCase());
    phone = self?.phone ? normalizeEvoWhatsAppNumber(self.phone) : "";
  }

  const hits = phone ? collectEvoInstancesSharingPhone(instances, phone) : [];
  const canonicalExists = instances.some((item) => {
    const row = extractPhoneFromEvoListItem(item);
    return row?.instanceName.toLowerCase() === canonicalName.toLowerCase();
  });
  const hadPriorSessions = hits.length > 0 || canonicalExists;
  const { duplicates } = splitCanonicalAndDuplicateNames(hits, canonicalName);

  for (const extra of duplicates) {
    console.warn(
      `[Reconnect] ${canonicalName}: apagando clone EVO ${extra} (mesmo número ${phone || "?"}).`,
    );
    await tryDeleteEvoInstance(extra);
    await purgeInstanceLocalState(extra);
    await removeAquecedorInstanceLifecycle(extra);
    await clearWhatsappConnectingRestriction(extra);
    duplicatesDeleted.push(extra);
  }

  let canonicalReset = false;
  if (input.resetCanonical !== false) {
    await clearWhatsappConnectingRestriction(canonicalName);
    invalidateEvoLiveStateCache(canonicalName);
    await resetEvoInstanceForQr(canonicalName);
    canonicalReset = true;
  }

  return { duplicatesDeleted, canonicalReset, phone, hadPriorSessions };
}

/** Soft-reset só na Evolution (mesmo nome). Não apaga lifecycle/ownership no WABA. */
async function softResetDisconnectedEvoInstanceForQr(
  instanceName: string,
  opts?: { campaignProxy?: boolean; force?: boolean; phone?: string },
): Promise<{ duplicatesDeleted: string[] }> {
  const name = String(instanceName || "").trim();
  if (!name) return { duplicatesDeleted: [] };
  const campaignProxy = opts?.campaignProxy === true;
  const purged = await purgeOldEvoSessionsForReconnect({
    canonicalName: name,
    phone: opts?.phone,
    resetCanonical: false,
  });
  try {
    if (campaignProxy) {
      await applyProxyBrasilToEvoInstance(name, callEvoAction, EVO_API_BASE);
    } else {
      await disableProxyBrasilOnEvoInstance(name, callEvoAction, EVO_API_BASE);
    }
  } catch {
    /* best-effort */
  }
  const live = await fetchEvoInstanceConnectionState(name, { fresh: true });
  if (live.open && !opts?.force && !campaignProxy) {
    return { duplicatesDeleted: purged.duplicatesDeleted };
  }
  console.warn(
    campaignProxy
      ? `[QR] ${name}: soft-reset EVO com Proxy Campanha (logout+delete+recreate) — parear via proxy.`
      : `[QR] ${name}: soft-reset EVO (logout+delete+recreate) — sessão desconectada/corrompida; WABA preservado.`,
  );
  await resetEvoInstanceForQr(name);
  if (campaignProxy) {
    try {
      await applyProxyBrasilToEvoInstance(name, callEvoAction, EVO_API_BASE);
    } catch {
      /* best-effort */
    }
  }
  return { duplicatesDeleted: purged.duplicatesDeleted };
}

type EvoQrFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  /** Logout/restart na EVO antes do connect (instância já existente desconectada). */
  prepareSession?: boolean;
  /** Rodadas extras lentas (após reset/recovery). */
  extended?: boolean;
};

type QrRegisterJobRecord = {
  status: "pending" | "done" | "error";
  createdAt: number;
  updatedAt: number;
  message?: string;
  qrCode?: string;
  pairingCode?: string | null;
  warning?: string | null;
  error?: string;
  detail?: string;
  evoCreateStatus?: number;
  evoQrStatus?: number;
};

const qrRegisterJobs = new Map<string, QrRegisterJobRecord>();

type QrRegisterRecentFailure = {
  at: string;
  name: string;
  source: "job" | "http";
  error: string;
  detail?: string;
  evoCreateStatus?: number;
  evoQrStatus?: number;
};

const qrRegisterRecentFailures: QrRegisterRecentFailure[] = [];

function rememberQrRegisterFailure(entry: Omit<QrRegisterRecentFailure, "at">): void {
  qrRegisterRecentFailures.unshift({
    ...entry,
    at: new Date().toISOString(),
  });
  if (qrRegisterRecentFailures.length > 20) qrRegisterRecentFailures.length = 20;
}

function pruneQrRegisterJobs(): void {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, job] of qrRegisterJobs) {
    if (job.updatedAt < cutoff) qrRegisterJobs.delete(id);
  }
}

type RegistrarQrcodeInput = {
  name: string;
  token: string;
  number: string;
  ownerEmail: string;
  ownershipAlreadyClaimed?: boolean;
  /** Parear já com Proxy Brasil (envio de campanha). */
  campaignProxy?: boolean;
};

type RegistrarQrcodeSuccess = {
  ok: true;
  message: string;
  qrCode: string;
  pairingCode?: string | null;
  warning?: string | null;
  providerResponse?: unknown;
};

type RegistrarQrcodeFailure = {
  ok: false;
  httpStatus: number;
  error: string;
  detail?: string;
  evoCreateStatus?: number;
  evoQrStatus?: number;
};

async function runRegistrarQrcode(
  input: RegistrarQrcodeInput,
): Promise<RegistrarQrcodeSuccess | RegistrarQrcodeFailure> {
  const name = String(input.name || "").trim();
  const number = String(input.number || "").trim();
  const token = String(input.token || "").trim();
  const ownerEmail = String(input.ownerEmail || "").trim().toLowerCase();

  if (!input.ownershipAlreadyClaimed && isWabaAuthConfigured()) {
    if (!ownerEmail.includes("@")) {
      return { ok: false, httpStatus: 401, error: "Faça login para registrar uma instância." };
    }
    const reserve = await wabaInstanceOwnershipService.claimOnRegister(name, ownerEmail);
    if (!reserve.ok) {
      return { ok: false, httpStatus: 409, error: reserve.error };
    }
    void ensureAquecedorInstanceRegistered(name);
  }

  const reconnectPurge = await purgeOldEvoSessionsForReconnect({
    canonicalName: name,
    phone: number,
    resetCanonical: false,
  });
  const keepWarmthOnReconnect = reconnectPurge.hadPriorSessions === true;
  const rememberLifecycleAfterQr = async (createdNew: boolean) => {
    await noteAquecedorInstanceReconnected(name);
    if (!createdNew) return;
    if (keepWarmthOnReconnect) {
      await ensureAquecedorInstanceRegistered(name);
      return;
    }
    await ensureAquecedorInstanceRegistered(name, { forceNewIntegration: true });
  };

  // Proxy ligado impede pareamento WhatsApp — exceto Proxy Campanha ou chip já na campanha.
  const campaignProxy = input.campaignProxy === true;
  const inLiveCampaign = heldProxyBrasilInstanceNames(
    disparosCampaignsMemory.map((c) => ({
      status: c.status,
      selectedInstanceNames: Array.isArray(c.configSnapshot?.selectedDisparadorInstances)
        ? c.configSnapshot.selectedDisparadorInstances
        : [],
    })),
  ).some((n) => n.toLowerCase() === name.toLowerCase());
  const keepCampaignProxy = campaignProxy || inLiveCampaign;
  try {
    if (keepCampaignProxy) {
      await applyProxyBrasilToEvoInstance(name, callEvoAction, EVO_API_BASE);
    } else {
      await disableProxyBrasilOnEvoInstance(name, callEvoAction, EVO_API_BASE);
    }
  } catch (err) {
    console.warn(
      `[QR] ${name}: falha ao ${keepCampaignProxy ? "aplicar" : "desligar"} proxy antes do QR:`,
      err,
    );
  }

  const liveBefore = await fetchEvoInstanceConnectionState(name, { fresh: true });
  if (liveBefore.open && !campaignProxy) {
    return {
      ok: false,
      httpStatus: 409,
      error: "Esta instância já está conectada no sistema WABA - Drax.",
    };
  }
  if (liveBefore.open && campaignProxy) {
    await softResetDisconnectedEvoInstanceForQr(name, {
      campaignProxy: true,
      force: true,
      phone: number,
    });
  }

  const createPayload: Record<string, unknown> = {
    instanceName: name,
    name,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  };
  if (number) createPayload.number = number;

  const createUrls = [
    EVO_CREATE_INSTANCE_URL,
    `${EVO_API_BASE}/instance/create`,
    `${EVO_API_BASE}/instance/create/${encodeURIComponent(name)}`,
  ].filter(Boolean);

  let createOk = false;
  let lastCreateStatus = 0;
  let lastCreateDetail = "";
  let qrFromCreate: string | null = null;
  let pairingFromCreate: string | null = null;
  let instanceWasNew = false;

  async function tryCreateOnce(): Promise<void> {
    for (const createUrl of createUrls) {
      const createResult = await callEvoAction(createUrl, "POST", createPayload, {
        timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 30000),
        retries: 2,
      });
      lastCreateStatus = createResult.status;
      lastCreateDetail = String(createResult.body || createResult.error || "").slice(0, 400);
      if (createResult.ok) {
        createOk = true;
        instanceWasNew = true;
        qrFromCreate =
          tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
        pairingFromCreate =
          tryExtractPairingCode(createResult.json) || tryExtractPairingCode(createResult.body);
        return;
      }
      if (createResult.status === 409) {
        createOk = true;
        qrFromCreate =
          tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
        pairingFromCreate =
          tryExtractPairingCode(createResult.json) || tryExtractPairingCode(createResult.body);
        return;
      }
    }
  }

  await tryCreateOnce();

  // Instância já existia (409) e está desconectada: limpa sessão Baileys na EVO e recria o mesmo nome.
  // Não remove ownership/lifecycle/aquecimento no WABA.
  if (createOk && !instanceWasNew && !qrFromCreate && !pairingFromCreate) {
    await softResetDisconnectedEvoInstanceForQr(name, { campaignProxy, phone: number });
    createOk = false;
    lastCreateStatus = 0;
    lastCreateDetail = "";
    qrFromCreate = null;
    pairingFromCreate = null;
    instanceWasNew = false;
    await tryCreateOnce();
  } else if (!createOk && liveBefore.ok) {
    await softResetDisconnectedEvoInstanceForQr(name, { campaignProxy, phone: number });
    await tryCreateOnce();
  }

  // Proxy Brasil: no Aquecedor normal fica off; no «Proxy Campanha» permanece on.
  let createWarning: string | null = null;
  if (!createOk) {
    createWarning = `Não foi possível salvar/atualizar a instância (status ${lastCreateStatus}). Tentando gerar QRCode da instância existente.`;
  } else if (campaignProxy) {
    try {
      await applyProxyBrasilToEvoInstance(name, callEvoAction, EVO_API_BASE);
    } catch {
      /* */
    }
  }

  // Com número, o fluxo Device Cloud precisa do pairingCode — não retornar só com imagem QR.
  if ((qrFromCreate || pairingFromCreate) && (pairingFromCreate || !number)) {
    await rememberLifecycleAfterQr(instanceWasNew);
    return {
      ok: true,
      message: createWarning
        ? "QRCode gerado com sucesso para a instância existente."
        : "Dados salvos e QRCode gerado com sucesso.",
      warning: createWarning,
      qrCode: qrFromCreate || "",
      pairingCode: pairingFromCreate,
    };
  }

  // Doc EVO: GET /instance/connect já devolve QR em close/connecting.
  // logout+restart antes costuma travar/timeout e derruba sessão connecting válida.
  // https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect
  let qrFetch = await fetchInstanceQrCodeFromEvo(name, number, {
    timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 45000),
    retries: 2,
    prepareSession: false,
  });
  if (!qrFetch.ok && (!instanceWasNew || !createOk)) {
    console.warn(
      `[QR] ${name}: connect direto falhou (HTTP ${qrFetch.lastQrStatus}); tentando logout+restart.`,
    );
    qrFetch = await fetchInstanceQrCodeFromEvo(name, number, {
      timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 60000),
      retries: 3,
      prepareSession: true,
    });
  }
  if (qrFetch.ok) {
    await rememberLifecycleAfterQr(instanceWasNew);
    return {
      ok: true,
      message: createWarning
        ? "QRCode gerado com sucesso para a instância existente."
        : "Dados salvos e QRCode gerado com sucesso.",
      warning: createWarning,
      qrCode: qrFetch.qrCode || "",
      pairingCode: qrFetch.pairingCode || null,
      providerResponse: qrFetch.providerResponse,
    };
  }

  if (isEvoQrRecoverableFailure(qrFetch.lastQrDetail, qrFetch.lastQrStatus)) {
    await resetEvoInstanceForQr(name);
    let retryCreateOk = false;
    let retryCreateStatus = 0;
    let retryCreateDetail = "";
    let retryQrFromCreate: string | null = null;
    let retryPairingFromCreate: string | null = null;
    for (const createUrl of createUrls) {
      const createResult = await callEvoAction(createUrl, "POST", createPayload, {
        timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 30000),
        retries: 2,
      });
      retryCreateStatus = createResult.status;
      retryCreateDetail = String(createResult.body || createResult.error || "").slice(0, 400);
      if (createResult.ok || createResult.status === 409) {
        retryCreateOk = true;
        retryQrFromCreate =
          tryExtractQrCode(createResult.json) || tryExtractQrCode(createResult.body);
        retryPairingFromCreate =
          tryExtractPairingCode(createResult.json) || tryExtractPairingCode(createResult.body);
        break;
      }
    }
    if (retryQrFromCreate || retryPairingFromCreate) {
      await rememberLifecycleAfterQr(true);
      return {
        ok: true,
        message: "Instância recriada no sistema WABA - Drax e QRCode gerado com sucesso.",
        warning: createWarning,
        qrCode: retryQrFromCreate || "",
        pairingCode: retryPairingFromCreate,
      };
    }
    if (retryCreateOk) {
      const qrRetry = await fetchInstanceQrCodeFromEvo(name, number, {
        timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 90000),
        retries: 4,
        prepareSession: false,
        extended: true,
      });
      if (qrRetry.ok) {
        await rememberLifecycleAfterQr(true);
        return {
          ok: true,
          message: "Instância recriada no sistema WABA - Drax e QRCode gerado com sucesso.",
          warning: createWarning,
          qrCode: qrRetry.qrCode || "",
          pairingCode: qrRetry.pairingCode || null,
          providerResponse: qrRetry.providerResponse,
        };
      }
      lastCreateStatus = retryCreateStatus || lastCreateStatus;
      lastCreateDetail = qrRetry.lastQrDetail || retryCreateDetail || lastCreateDetail;
      return {
        ok: false,
        httpStatus: 502,
        error: describeEvoQrFailure(
          lastCreateStatus,
          qrRetry.lastQrStatus,
          lastCreateDetail,
          qrRetry.lastQrDetail,
        ),
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

async function fetchInstanceQrCodeFromEvo(
  instanceName: string,
  number = "",
  options: EvoQrFetchOptions = {},
): Promise<
  | { ok: true; qrCode: string; pairingCode?: string | null; providerResponse: unknown }
  | { ok: false; lastQrStatus: number; lastQrDetail: string }
> {
  const timeoutMs = options.timeoutMs ?? defaultEvoHttpTimeoutMs();
  const retries = options.retries ?? 3;
  // prepareSession só sob demanda explícita (após falha do connect direto).
  if (options.prepareSession === true) {
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
      } else {
        await sleepMs(roundDelaysMs[round]);
      }
    }
    for (const candidate of connectCandidates) {
      const result = await callEvoAction(candidate.url, candidate.method, undefined, {
        timeoutMs,
        retries,
      });
      lastError = rememberEvoQrFetchError(
        lastError,
        result.status,
        String(result.body || result.error || ""),
      );

      if (!result.ok) continue;

      const qrCode = tryExtractQrCode(result.json) || tryExtractQrCode(result.body);
      const pairingCode =
        tryExtractPairingCode(result.json) || tryExtractPairingCode(result.body);
      if (qrCode || pairingCode) {
        const normalized = qrCode
          ? qrCode.startsWith("data:image") || qrCode.startsWith("http")
            ? qrCode
            : `data:image/png;base64,${qrCode.replace(/\s+/g, "")}`
          : "";
        return {
          ok: true,
          qrCode: normalized,
          pairingCode: pairingCode || null,
          providerResponse: result.json ?? null,
        };
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
    const campaignProxy =
      String(req.query.campaignProxy || "").trim() === "1" ||
      req.body?.campaignProxy === true ||
      String(req.body?.campaignProxy || "").trim() === "1";

    // Reconexão: Aquecedor normal tira proxy; Proxy Campanha mantém/liga proxy e força re-pareamento.
    await softResetDisconnectedEvoInstanceForQr(instanceName, {
      campaignProxy,
      force: campaignProxy,
      phone: number,
    });
    // Recria o mesmo nome se o soft-reset apagou na EVO.
    await callEvoAction(
      `${EVO_API_BASE}/instance/create`,
      "POST",
      {
        instanceName,
        name: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        ...(number ? { number } : {}),
      },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 30000), retries: 2 },
    );
    if (campaignProxy) {
      try {
        await applyProxyBrasilToEvoInstance(instanceName, callEvoAction, EVO_API_BASE);
      } catch {
        /* */
      }
    }

    let qrFetch = await fetchInstanceQrCodeFromEvo(instanceName, number, {
      prepareSession: false,
    });
    if (!qrFetch.ok) {
      qrFetch = await fetchInstanceQrCodeFromEvo(instanceName, number, {
        prepareSession: true,
        timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 60000),
        retries: 3,
      });
    }
    if (!qrFetch.ok) {
      return res.status(502).json({
        error: describeEvoQrFailure(0, qrFetch.lastQrStatus, "", qrFetch.lastQrDetail),
        evoQrStatus: qrFetch.lastQrStatus,
        detail: qrFetch.lastQrDetail,
      });
    }
    return res.json({
      ok: true,
      message: campaignProxy
        ? "QRCode solicitado com Proxy Campanha. Escaneie para parear já com proxy."
        : "QRCode solicitado com sucesso.",
      qrCode: qrFetch.qrCode,
      campaignProxy,
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

    const ownerEmail = String(auth.email || "").trim().toLowerCase();
    if (isWabaAuthConfigured()) {
      if (!ownerEmail.includes("@")) {
        return res.status(401).json({ error: "Faça login para registrar uma instância." });
      }
      let reserve: { ok: true } | { ok: false; error: string };
      try {
        reserve = await wabaInstanceOwnershipService.claimOnRegister(name, ownerEmail);
      } catch (claimError) {
        const detail =
          claimError instanceof Error
            ? claimError.stack || claimError.message
            : String(claimError);
        rememberQrRegisterFailure({
          name,
          source: "http",
          error: "Falha ao reservar nome da instância no armazenamento local.",
          detail: detail.slice(0, 800),
        });
        return res.status(500).json({
          error: "Falha ao reservar nome da instância no armazenamento local.",
          detail: detail.slice(0, 800),
        });
      }
      if (!reserve.ok) {
        return res.status(409).json({ error: reserve.error });
      }
      void ensureAquecedorInstanceRegistered(name);
    }

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

        const existsWithSameName = list.some((item: any) => {
          const inst = item?.instance ?? item;
          const existingName = String(
            inst?.name ?? inst?.instanceName ?? inst?.instance ?? "",
          ).trim();
          return existingName.toLowerCase() === name.toLowerCase();
        });

        if (existsWithSameName) {
          const liveState = await fetchEvoInstanceLiveState(name, { fresh: true });
          if (isEvoLiveStateOpen(liveState)) {
            return res.status(409).json({
              error:
                "Esta instância já está conectada no sistema WABA - Drax. Se precisar de novo QR, desconecte antes ou aguarde o status atualizar.",
            });
          }
        }
      }
    } catch {
      /* verificação opcional */
    }

    pruneQrRegisterJobs();
    const jobId = crypto.randomUUID();
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
          campaignProxy:
            req.body?.campaignProxy === true ||
            String(req.body?.campaignProxy || "").trim() === "1",
        });
        const updatedAt = Date.now();
        if (result.ok) {
          qrRegisterJobs.set(jobId, {
            status: "done",
            createdAt: now,
            updatedAt,
            message: result.message,
            qrCode: result.qrCode,
            pairingCode: result.pairingCode ?? null,
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
        rememberQrRegisterFailure({
          name,
          source: "job",
          error: String(result.error || "Erro ao gerar QRCode da instância."),
          detail: result.detail,
          evoCreateStatus: result.evoCreateStatus,
          evoQrStatus: result.evoQrStatus,
        });
      } catch (error) {
        const raw =
          error instanceof Error
            ? error.stack || error.message
            : String(error);
        const summarized = summarizeEvolutionErrorDetail(
          error instanceof Error ? error.message : String(error),
          0,
        );
        const errorMsg =
          summarized && summarized.trim()
            ? summarized.trim().slice(0, 280)
            : "Erro ao gerar QRCode da instância.";
        qrRegisterJobs.set(jobId, {
          status: "error",
          createdAt: now,
          updatedAt: Date.now(),
          error: errorMsg,
          detail: String(raw || "").slice(0, 800),
        });
        rememberQrRegisterFailure({
          name,
          source: "job",
          error: errorMsg,
          detail: String(raw || "").slice(0, 800),
        });
        console.error("[QR] registrar-qrcode job falhou:", name, error);
      }
    })();
    return;
  } catch (error) {
    console.error("Erro ao registrar instância e gerar QRCode:", error);
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    rememberQrRegisterFailure({
      name: String(req.body?.name || "").trim() || "(sem-nome)",
      source: "http",
      error: "Erro ao gerar QRCode da instância.",
      detail: detail.slice(0, 800),
    });
    return res.status(500).json({
      error: "Erro ao gerar QRCode da instância.",
      detail: detail.slice(0, 800),
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

type InstanceDeletionResult =
  | {
      ok: true;
      message: string;
      degraded: boolean;
      evoStatus?: number;
      evoDetail?: string;
    }
  | { ok: false; status: number; error: string };

async function performInstanceDeletion(instanceName: string): Promise<InstanceDeletionResult> {
  const name = String(instanceName || "").trim();
  if (!name) {
    return { ok: false, status: 400, error: "Nome da instância é obrigatório." };
  }
  if (!buildEvoDeleteCandidateUrls(name).length) {
    return {
      ok: false,
      status: 501,
      error: "Ação deletar não configurada. Defina EVO_DELETE_URL_TEMPLATE no backend.",
    };
  }

  const evoResult = await tryDeleteEvoInstance(name);
  await purgeInstanceLocalState(name);

  const message = evoResult.evoDeleted
    ? "Instância deletada com sucesso."
    : evoResult.status === 404
      ? "Instância removida do painel (não encontrada no sistema WABA - Drax)."
      : "Instância removida do painel. Se ainda existir no sistema WABA - Drax, remova manualmente no servidor EVO.";

  return {
    ok: true,
    message,
    degraded: !evoResult.evoDeleted,
    evoStatus: evoResult.status || undefined,
    evoDetail: evoResult.evoDeleted
      ? undefined
      : summarizeEvolutionErrorDetail(evoResult.body, evoResult.status),
  };
}

app.delete("/instancias/:name", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const result = await performInstanceDeletion(instanceName);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      ok: true,
      message: result.message,
      degraded: result.degraded,
      evoStatus: result.evoStatus,
      evoDetail: result.evoDetail,
    });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    return res.status(500).json({ error: "Erro ao deletar instância." });
  }
});

app.post("/instancias/:name/reconnect-purge", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;
    const number = String(req.body?.number || req.query.number || "").trim();
    const purged = await purgeOldEvoSessionsForReconnect({
      canonicalName: instanceName,
      phone: number,
      resetCanonical: true,
    });
    await callEvoAction(
      `${EVO_API_BASE}/instance/create`,
      "POST",
      {
        instanceName,
        name: instanceName,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS",
        ...(number ? { number } : {}),
      },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 30000), retries: 2 },
    );
    await ensureAquecedorInstanceRegistered(instanceName);
    return res.json({
      ok: true,
      message:
        "Sessão antiga e clones do número foram apagados na Evolution. Foguinhos e totais de envio foram mantidos.",
      duplicatesDeleted: purged.duplicatesDeleted,
      canonicalReset: purged.canonicalReset,
      phone: purged.phone || number || null,
      preserved: { warmth: true, messagesSent: true },
    });
  } catch (error) {
    console.error("Erro no reconnect-purge:", error);
    return res.status(500).json({ error: "Erro ao limpar sessão antiga da instância." });
  }
});

app.delete("/admin/instances/:name", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    if (auth.role !== "master" && !isWabaMasterEmail(auth.email)) {
      return res.status(403).json({ error: "Somente usuário master pode excluir instâncias pelo admin." });
    }
    const instanceName = String(req.params.name || "").trim();
    const result = await performInstanceDeletion(instanceName);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      ok: true,
      message: result.message,
      degraded: result.degraded,
      evoStatus: result.evoStatus,
      evoDetail: result.evoDetail,
      deletedBy: auth.email,
    });
  } catch (error) {
    console.error("Erro ao deletar instância (admin):", error);
    return res.status(500).json({ error: "Erro ao deletar instância." });
  }
});

/** Status público (sem senha) da config Proxy Brasil no processo. */
app.get("/proxy-brasil/status", (_req, res) => {
  return res.json(proxyBrasilPublicSummary(loadProxyBrasilConfig()));
});

/**
 * Tira a instância da pausa humana (restricted_wait → active).
 * Master: qualquer instância. Não mexe em proxy nem na Evolution.
 */
app.post("/instancias/:name/liberar-pausa-humana", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const cleared = await clearAquecedorHumanPause(instanceName);
    if (!cleared.ok) {
      return res.status(400).json({ error: "Não foi possível liberar a pausa humana." });
    }
    const usageMap = await loadInstanceUsageMap();
    const current = getInstanceUsageFromMap(usageMap, instanceName);
    await persistInstanceUsage([
      {
        instanceName,
        useAquecedor: current?.useAquecedor !== false,
        useDisparador: true,
      },
    ]);
    await clearWhatsappConnectingRestriction(instanceName);
    return res.json({
      ok: true,
      message: "Pausa humana liberada. Instância conectada permanece disponível para disparo.",
      instanceName: cleared.instanceName,
      key: cleared.key,
      phase: cleared.phase,
      wasRestricted: cleared.wasRestricted,
      useDisparador: true,
    });
  } catch (error) {
    console.error("Erro ao liberar pausa humana:", error);
    return res.status(500).json({ error: "Erro ao liberar pausa humana." });
  }
});

/**
 * Aplica Proxy Brasil na instância Evolution (teste / número já existente).
 * Master: qualquer instância. Assinante: só a própria.
 */
app.post("/instancias/:name/proxy-brasil", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    if (await rejectForeignInstance(req, res, instanceName)) return;

    const force = req.body?.force === true || req.body?.force === "1";
    const result = await applyProxyBrasilToEvoInstance(
      instanceName,
      callEvoAction,
      EVO_API_BASE,
      { force },
    );
    if (result.skipped) {
      return res.status(400).json({
        ok: false,
        error: result.reason || "Proxy Brasil não configurado.",
        proxy: proxyBrasilPublicSummary(loadProxyBrasilConfig()),
      });
    }
    if (!result.ok) {
      return res.status(502).json({
        ok: false,
        error: result.reason || "Falha ao aplicar proxy na Evolution.",
        evoStatus: result.status,
        evoDetail: result.body,
        host: result.host,
        port: result.port,
      });
    }
    return res.json({
      ok: true,
      message: `Proxy Brasil aplicado em ${instanceName}. Reconecte o QR se a sessão cair.`,
      host: result.host,
      port: result.port,
      evoStatus: result.status,
    });
  } catch (error) {
    console.error("[ProxyBrasil] apply:", error);
    return res.status(500).json({ error: "Erro ao aplicar Proxy Brasil." });
  }
});

app.post("/admin/instances/:name/proxy-brasil", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    if (auth.role !== "master" && !isWabaMasterEmail(auth.email)) {
      return res.status(403).json({ error: "Somente master pode aplicar proxy pelo admin." });
    }
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }
    const result = await applyProxyBrasilToEvoInstance(
      instanceName,
      callEvoAction,
      EVO_API_BASE,
      { force: true },
    );
    if (!result.ok) {
      return res.status(result.skipped ? 400 : 502).json({
        ok: false,
        error: result.reason || "Falha ao aplicar proxy.",
        evoStatus: result.status,
        evoDetail: result.body,
      });
    }
    return res.json({
      ok: true,
      message: `Proxy Brasil aplicado em ${instanceName}.`,
      host: result.host,
      port: result.port,
      appliedBy: auth.email,
    });
  } catch (error) {
    console.error("[ProxyBrasil] admin apply:", error);
    return res.status(500).json({ error: "Erro ao aplicar Proxy Brasil." });
  }
});

app.post("/admin/instances/delete-by-phone", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    if (auth.role !== "master" && !isWabaMasterEmail(auth.email)) {
      return res.status(403).json({ error: "Somente usuário master pode excluir instâncias pelo admin." });
    }
    const phone = String(req.body?.phone || "").trim();
    const fromEmail = String(req.body?.fromEmail || "")
      .trim()
      .toLowerCase();
    if (!phone) {
      return res.status(400).json({ error: "Informe phone." });
    }

    const instanceNames = await resolveInstanceNamesByPhone(phone);
    if (!instanceNames.length) {
      return res.status(404).json({ error: "Nenhuma instância encontrada para esse número." });
    }

    const deleted: Array<{ instanceName: string; message: string; degraded: boolean }> = [];
    const skipped: Array<{ instanceName: string; reason: string; ownerEmail?: string }> = [];

    for (const instanceName of instanceNames) {
      if (fromEmail.includes("@")) {
        const owner = await wabaInstanceOwnershipService.resolveOwnerEmailForCandidates(
          await resolveInstanceDeletionKeys(instanceName),
        );
        if (owner && owner !== fromEmail) {
          skipped.push({
            instanceName,
            reason: "Instância pertence a outro usuário.",
            ownerEmail: owner,
          });
          continue;
        }
      }
      const result = await performInstanceDeletion(instanceName);
      if (!result.ok) {
        skipped.push({ instanceName, reason: result.error });
        continue;
      }
      deleted.push({
        instanceName,
        message: result.message,
        degraded: result.degraded,
      });
    }

    if (!deleted.length) {
      return res.status(409).json({
        error: "Nenhuma instância foi excluída.",
        skipped,
      });
    }

    return res.json({ ok: true, deleted, skipped });
  } catch (error) {
    console.error("Erro ao excluir instância por telefone (admin):", error);
    return res.status(500).json({ error: "Erro ao excluir instância." });
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
          return (
            existingName &&
            existingName.toLowerCase() === newName.toLowerCase() &&
            existingName.toLowerCase() !== oldName.toLowerCase()
          );
        });
        if (conflict) {
          const liveState = await fetchEvoInstanceLiveState(newName, { fresh: true });
          if (isEvoLiveStateOpen(liveState)) {
            return res.status(409).json({
              error:
                "Já existe uma instância ativa/conectada com este nome. Informe outro nome.",
            });
          }
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

app.get("/aquecedor/status", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    if (!ownerEmail) {
      return res.status(401).json({ error: "Sessão sem e-mail válido para consultar o Aquecedor." });
    }
    await reloadAquecedorOwnerMotorsFromDisk();
    const motor = getAquecedorOwnerMotor(ownerEmail);
    // Contador de instâncias: refresca se nunca houve ciclo neste boot (summary.at=0)
    // ou se o resumo persistido está velho (>2 min). Evita "instâncias: …" na UI.
    const summaryAgeMs = motor.connectedSummary.at > 0 ? Date.now() - motor.connectedSummary.at : Number.POSITIVE_INFINITY;
    if (motor.desired === true && summaryAgeMs > 120_000) {
      try {
        const resolved = await resolveAquecedorConnectedForOwner(ownerEmail);
        const connectedActive = await filterAquecedorCycleConnected(resolved.connected);
        updateAquecedorOwnerConnectedSummary(ownerEmail, connectedActive, resolved.connected);
        void persistAquecedorOwnerSnapshot(ownerEmail);
      } catch (refreshErr) {
        console.warn(
          "[Aquecedor] falha ao refrescar contagem de instâncias no status:",
          refreshErr instanceof Error ? refreshErr.message : refreshErr,
        );
      }
    }
    const config = await loadAquecedorEffectiveConfig();
    const nowSp = nowInSaoPaulo();
    const windowOpen = isAquecedorWindowOpen(config, nowSp);
    const nextWindowOpenAt = windowOpen ? null : nextAquecedorWindowOpenAt(config, nowSp);
    const live = buildLiveAquecedorOwnerStatusPayload(ownerEmail);
    // Não expor nextAllowedAt no passado (ex.: 16:02 preso) — UI mostra "imediato".
    const nextMs = live.nextAllowedAt ? new Date(String(live.nextAllowedAt)).getTime() : NaN;
    if (Number.isFinite(nextMs) && nextMs <= Date.now()) {
      live.nextAllowedAt = null;
      if (motor.runtime.nextAllowedAt) {
        motor.runtime.nextAllowedAt = null;
        void persistAquecedorOwnerSnapshot(ownerEmail, { nextAllowedAt: null });
      }
    }
    return res.json({
      ...live,
      windowOpen,
      nextWindowOpenAt: nextWindowOpenAt ? nextWindowOpenAt.toISOString() : null,
      nextWindowOpenBr: nextWindowOpenAt ? formatDateBr(nextWindowOpenAt.toISOString()) : null,
    });
  } catch (error) {
    console.error("[Aquecedor] erro em GET /aquecedor/status:", error);
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    return res.json({
      ...(ownerEmail ? buildLiveAquecedorOwnerStatusPayload(ownerEmail) : {}),
      statusReadError: true,
      statusReadMessage: "Falha ao ler estado persistido; exibindo último snapshot conhecido.",
    });
  }
});

app.get("/aquecedor/network-health", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    if (!ownerEmail) {
      return res.status(401).json({ error: "Sessão sem e-mail válido." });
    }
    // Exclusivo Mozart — nunca expor matriz/saldo da rede a outros usuários.
    if (ownerEmail !== "mozart.pmo@gmail.com") {
      return res.status(403).json({
        ok: false,
        error: "Saúde da rede disponível apenas para o administrador do sistema.",
      });
    }
    const supabase = getSupabaseClient();
    const resolved = await resolveAquecedorConnectedForOwner(ownerEmail);
    const connectedActive = await filterAquecedorCycleConnected(resolved.connected);
    const connected = connectedActive.length >= 2 ? connectedActive : resolved.connected;
    if (supabase && connected.length >= 2) {
      await ensureAquecedorOwnerConversationGraph(ownerEmail, supabase, connected);
    } else if (connected.length >= 2) {
      const chipIndex = buildAquecedorChipIndex(connected);
      await ensureCompletePairGraph(ownerEmail, chipIndex.chips);
    }
    const graph = await getOwnerConversationGraph(ownerEmail);
    const chipIndex = buildAquecedorChipIndex(connected);
    const report = buildNetworkHealthReport(ownerEmail, graph, {
      instanceNames: chipIndex.chips,
    });
    // Labels amigáveis: chip → nome atual da instância (quando houver).
    if (report.relationshipMatrix?.labels?.length) {
      report.relationshipMatrix.labels = report.relationshipMatrix.labels.map(
        (chip) => chipIndex.chipToInstance.get(chip) || chip,
      );
    }
    for (const phone of report.phones || []) {
      const label = chipIndex.chipToInstance.get(String(phone.phone || ""));
      if (label) (phone as { phone: string }).phone = label;
    }
    return res.json({ ok: true, ...report });
  } catch (error) {
    console.error("[Aquecedor] GET /aquecedor/network-health", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao montar saúde da rede.",
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
    const scopedTechnicalNames = await listAquecedorScopedInstanceNames(ownerEmail);

    if (scopedTechnicalNames.length === 0) {
      const ownerMotor = ownerEmail ? getAquecedorOwnerMotor(ownerEmail) : null;
      const ownerMotorRunning = ownerMotor?.runtime.running === true || ownerMotor?.desired === true;
      let hint = "";
      if (ownerMotorRunning) {
        hint = "Motor ativo, mas sem instâncias vinculadas. Cadastre ou conecte instâncias para ver envios.";
      }
      return res.json({
        items: [],
        motorRunning: ownerMotor?.runtime.running === true,
        pendingCount: 0,
        ownerEmail: ownerEmail || null,
        hint,
      });
    }

    const filterQueueByOwner = scopedTechnicalNames.length > 0;

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
      const rowOwner = String(row.ownerEmail || "").trim().toLowerCase();
      if (rowOwner && rowOwner !== ownerEmail) continue;
      // Com Supabase, envios concluídos vêm só de logs_envios (evita linha duplicada no painel).
      if (supabase && row.status === "Envio com Sucesso") continue;
      pushItem(row.instanciaOrigem, row.instanciaDestino, row.dataEnvio, row.status);
    }

    let pendingCount = 0;
    if (supabase) {
      const numToInst = await buildControleInstanciaNumToNameMap(supabase);

      const processandoQuery = filterQueueByOwner
        ? supabase
            .from("aquecedor" as any)
            .select("instancia, numero_destino, scheduled_at, processing_at")
            .eq("status", "PROCESSANDO")
            .in("instancia", scopedTechnicalNames)
            .order("processing_at", { ascending: false })
            .limit(5)
        : supabase
            .from("aquecedor" as any)
            .select("instancia, numero_destino, scheduled_at, processing_at")
            .eq("status", "PROCESSANDO")
            .order("processing_at", { ascending: false })
            .limit(5);
      const { data: processandoData } = (await processandoQuery) as any;

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
            .from("aquecedor" as any)
            .select("id", { count: "exact", head: true })
            .eq("status", "PENDENTE")
            .in("instancia", scopedTechnicalNames)
        : supabase
            .from("aquecedor" as any)
            .select("id", { count: "exact", head: true })
            .eq("status", "PENDENTE");
      const { count: pendingTotal } = (await pendingCountQuery) as { count: number | null };
      pendingCount = typeof pendingTotal === "number" ? pendingTotal : 0;

      // Histórico primeiro: listagem não pode depender de EVO/pick (ver LOG-2026-06-19).
      // PENDENTE legado com numero_destino null entrava em resolveAquecedorConnectedForOwner
      // + outbound-health + pick e derrubava o endpoint inteiro com 500.
      const logsQuery = filterQueueByOwner
        ? supabase
            .from("logs_envios_br" as any)
            .select("instancia_origem, instancia_destino, data_envio_br")
            .in("instancia_origem", scopedTechnicalNames)
            .order("data_envio_br", { ascending: false })
            .limit(limit)
        : supabase
            .from("logs_envios_br" as any)
            .select("instancia_origem, instancia_destino, data_envio_br")
            .order("data_envio_br", { ascending: false })
            .limit(limit);
      const { data: logsData, error } = (await logsQuery) as any;

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

      try {
        const pendingDataQuery = filterQueueByOwner
          ? supabase
              .from("aquecedor" as any)
              .select("scheduled_at, instancia, numero_destino")
              .eq("status", "PENDENTE")
              .in("instancia", scopedTechnicalNames)
              .not("instancia", "is", null)
              .order("scheduled_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : supabase
              .from("aquecedor" as any)
              .select("scheduled_at, instancia, numero_destino")
              .eq("status", "PENDENTE")
              .not("instancia", "is", null)
              .order("scheduled_at", { ascending: false })
              .limit(1)
              .maybeSingle();
        const { data: pendingData } = (await pendingDataQuery) as any;

        if (pendingData) {
          const origem = String(pendingData?.instancia || "").trim();
          let destino = "—";
          const dataEnvio = String(pendingData?.scheduled_at || "").trim() || null;
          const numDest = normalizeWhatsAppNumber(
            String(pendingData?.numero_destino || "").trim(),
          );
          if (numDest) {
            destino = numToInst.get(numDest) || numDest;
          }
          // Sem EVO/pick na listagem: destino fica "—" até o motor gravar numero_destino.
          pushItem(origem || "—", destino, dataEnvio, "Em Fila");
        }
      } catch (pendingErr) {
        console.warn(
          "[aquecedor/envios] falha ao montar preview PENDENTE (histórico já retornado):",
          pendingErr instanceof Error ? pendingErr.message : pendingErr,
        );
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
    const ownerMotor = ownerEmail ? getAquecedorOwnerMotor(ownerEmail) : null;
    const ownerMotorRunning = ownerMotor?.runtime.running === true || ownerMotor?.desired === true;
    if (!sliced.length && ownerMotorRunning) {
      hint =
        pendingCount > 0
          ? "Motor ativo com mensagens na fila. O próximo envio aparecerá aqui."
          : "Motor ativo, mas sem mensagens na fila. Aguarde o próximo ciclo ou reinicie o aquecedor.";
    }

    return res.json({
      items: sliced,
      motorRunning: ownerMotor?.runtime.running === true,
      pendingCount,
      ownerEmail: ownerEmail || null,
      hint,
    });
  } catch (error) {
    console.error("Erro inesperado ao listar envios do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao listar envios do aquecedor." });
  }
});

app.get("/aquecedor/command-logs", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = auth.email?.trim().toLowerCase() || "";
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(120, Math.floor(rawLimit)))
      : 30;
    const items = (await readAquecedorCommandLog()).filter((row) => {
      const rowOwner = String(row.ownerEmail || "").trim().toLowerCase();
      return !ownerEmail || rowOwner === ownerEmail;
    });
    return res.json({ items: items.slice(0, limit) });
  } catch (error) {
    console.error("Erro inesperado ao listar logs de comando do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao listar logs de comando." });
  }
});

app.post("/aquecedor/command-logs", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    const message = String((req.body as { message?: unknown })?.message ?? "").trim();
    if (!message) {
      return res.status(400).json({ error: "Informe a mensagem do log." });
    }
    await appendAquecedorCommandLog(message, auth.email);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Erro inesperado ao gravar log de comando do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao gravar log de comando." });
  }
});

app.post("/aquecedor/start", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  if (!ENABLE_AQUECEDOR_PROCESSING) {
    return res.status(409).json({
      ok: false,
      message:
        "Aquecedor desativado neste processo. Defina ENABLE_AQUECEDOR_PROCESSING=true ou use o runtime de produção.",
      runtime: {
        mode: RUNTIME_MODE,
        backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
        aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
      },
    });
  }
  const auth = resolveWabaRequestAuth(req);
  const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
  if (!ownerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
  }
  await persistAquecedorOwnerIntent(ownerEmail, true);
  const motor = getAquecedorOwnerMotor(ownerEmail);
  // Limpa nextAllowedAt velho (ex.: 16:02 no passado) para o status não mentir.
  const nextMs = motor.runtime.nextAllowedAt
    ? new Date(motor.runtime.nextAllowedAt).getTime()
    : NaN;
  if (!Number.isFinite(nextMs) || nextMs <= Date.now()) {
    motor.runtime.nextAllowedAt = null;
  }
  motor.runtime.lastResult = "Aquecedor iniciado.";
  startAquecedorRuntimeLocal(ownerEmail);
  void persistAquecedorOwnerSnapshot(ownerEmail, {
    running: true,
    nextAllowedAt: motor.runtime.nextAllowedAt,
    lastResult: motor.runtime.lastResult,
  });
  void appendAquecedorCommandLog("Aquecedor iniciado.", ownerEmail);
  return res.json({
    ok: true,
    message: "Aquecedor iniciado.",
    status: {
      ...buildLiveAquecedorOwnerStatusPayload(ownerEmail),
      running: true,
      desiredRunning: true,
      nextAllowedAt: motor.runtime.nextAllowedAt,
      lastResult: motor.runtime.lastResult,
    },
    desiredRunning: true,
  });
});

app.post("/aquecedor/stop", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  const auth = resolveWabaRequestAuth(req);
  const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
  if (!ownerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para parar o Aquecedor." });
  }
  await stopAquecedorRuntimeForOwner(ownerEmail);
  void appendAquecedorCommandLog("Aquecedor parado.", ownerEmail);
  await reloadAquecedorOwnerMotorsFromDisk();
  const motor = getAquecedorOwnerMotor(ownerEmail);
  return res.json({
    ok: true,
    message: "Aquecedor parado.",
    status: {
      ...buildLiveAquecedorOwnerStatusPayload(ownerEmail),
      running: false,
      desiredRunning: false,
      isProcessing: false,
      lastResult: motor.runtime.lastResult || "Aquecedor parado.",
    },
    desiredRunning: false,
  });
});

app.post("/aquecedor/run-once", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  if (!ENABLE_AQUECEDOR_PROCESSING) {
    return res.status(409).json({
      ok: false,
      error:
        "Aquecedor desativado neste processo. Defina ENABLE_AQUECEDOR_PROCESSING=true ou use o runtime de produção.",
      runtime: {
        mode: RUNTIME_MODE,
        backgroundProcessing: ENABLE_BACKGROUND_PROCESSING,
        aquecedorProcessing: ENABLE_AQUECEDOR_PROCESSING,
      },
    });
  }
  const auth = resolveWabaRequestAuth(req);
  const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
  if (!ownerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para vincular o Aquecedor." });
  }
  await runAquecedorCycle(ownerEmail, true);
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const desiredRunning = motor.desired === true;
  // Envio teste não pode desligar o motor: se estava desejado ligado, retoma o timer.
  if (desiredRunning && ENABLE_AQUECEDOR_PROCESSING) {
    startAquecedorRuntimeLocal(ownerEmail);
  } else {
    stopAquecedorOwnerMotorLocal(ownerEmail);
  }
  const status = buildLiveAquecedorOwnerStatusPayload(ownerEmail);
  const lastResult = String(motor.runtime.lastResult || "").trim();
  const ok =
    /enviado com sucesso|realizado/i.test(lastResult) &&
    !/abortado|falhou|não está open|connectionState/i.test(lastResult);
  void appendAquecedorCommandLog(
    lastResult ? `Envio teste: ${lastResult}` : "Envio teste executado.",
    ownerEmail,
  );
  return res.json({
    ok,
    message: lastResult || "Ciclo de teste executado.",
    status: {
      ...status,
      running: desiredRunning ? true : false,
      desiredRunning,
      isProcessing: false,
      lastResult: lastResult || status.lastResult,
    },
  });
});

app.post("/aquecedor/criar-mensagem-teste", async (req, res) => {
  if (rejectAquecedorWithoutEntitlement(req, res)) return;
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    if (!ownerEmail) {
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
    await runAquecedorCycle(ownerEmail, true);
    const motor = getAquecedorOwnerMotor(ownerEmail);
    return res.json({
      ok: true,
      message: "Mensagem de teste criada e ciclo executado.",
      id: data?.id,
      item,
      status: motor.runtime,
    });
  } catch (error) {
    console.error("Erro ao criar mensagem de teste:", error);
    return res.status(500).json({ error: "Erro ao criar mensagem de teste." });
  }
});

app.get("/aquecedor/fila-localizar", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    const motor = ownerEmail ? getAquecedorOwnerMotor(ownerEmail) : null;
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase não configurado." });
    }
    await releaseStuckAquecedorQueueRows(supabase);
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
      motorRodando: motor?.runtime.running === true,
      proximoPermitido: motor?.runtime.nextAllowedAt ?? null,
      ultimoResultado: motor?.runtime.lastResult ?? null,
      lastEvoError: motor?.runtime.lastEvoError ?? null,
    });
  } catch (error) {
    console.error("Erro ao localizar fila:", error);
    return res.status(500).json({ error: "Erro ao localizar fila." });
  }
});

app.get("/aquecedor/diagnostico", async (req, res) => {
  const auth = resolveWabaRequestAuth(req);
  const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
  if (!ownerEmail) {
    return res.status(401).json({ error: "Sessão sem e-mail válido para diagnóstico do Aquecedor." });
  }
  await reloadAquecedorOwnerMotorsFromDisk();
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const persistedStatus = buildAquecedorOwnerStatusPayload(ownerEmail);
  const diag: Record<string, any> = {
    runtime: {
      ...motor.runtime,
      ...persistedStatus,
      localRunning: motor.runtime.running,
      persistedRunning: persistedStatus.running,
      ownerEmail,
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
                pickAquecedorCombinationAsync(
                  supabase,
                  connected,
                  comboRows,
                  cicloGlobal,
                  ownerEmail,
                ),
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
    const instAnalysis = await analyzeAquecedorInstances(ownerEmail);
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
function rejectUnlessMetaOficialLab(req: express.Request, res: express.Response): boolean {
  const gate = authorizeMetaOficialLabAccess(resolveWabaRequestAuth(req));
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return true;
  }
  return false;
}

app.post("/meta-oficial/tokens/app-access", parseJsonDefault, async (req, res) => {
  try {
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    graphVersion: META_JS_SDK_GRAPH_VERSION,
  });
});

/** Config pública do Tech Provider. Sem secrets. Fonte: META_CONFIG_ID || META_ES_CONFIG_ID. */
app.get("/integrations/meta/whatsapp/config", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  const appId = String(process.env.META_APP_ID || "").trim();
  const configId = String(process.env.META_CONFIG_ID || process.env.META_ES_CONFIG_ID || "").trim();
  res.json({
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    graphVersion: META_JS_SDK_GRAPH_VERSION,
    callbackPath: "/integrations/meta/whatsapp/callback",
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    if (rejectUnlessMetaOficialLab(req, res)) return;
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
    const selectedDisparadorInstances = await filterDisparadorInstancesReadyForAuth(
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
    if (allowPartialSave) {
      // Salvamento por seção: não apagar campos críticos se o form veio vazio.
      const rawSelected = rawConfig?.selectedDisparadorInstances;
      if (!Array.isArray(rawSelected) || rawSelected.length === 0) {
        mergedConfig.selectedDisparadorInstances = currentConfig.selectedDisparadorInstances;
      }
      if (
        !String(rawConfig?.whatsappTargetNumber || "").trim() &&
        String(currentConfig.whatsappTargetNumber || "").trim()
      ) {
        mergedConfig.whatsappTargetNumber = currentConfig.whatsappTargetNumber;
      }
      if (
        !String(rawConfig?.responseUrl || "").trim() &&
        String(currentConfig.responseUrl || "").trim()
      ) {
        mergedConfig.responseUrl = currentConfig.responseUrl;
      }
      if (
        !String(rawConfig?.aiBriefing || "").trim() &&
        String(currentConfig.aiBriefing || "").trim()
      ) {
        mergedConfig.aiBriefing = currentConfig.aiBriefing;
      }
      if (
        Array.isArray(currentConfig.workingDays) &&
        currentConfig.workingDays.length > 0 &&
        (!Array.isArray(rawConfig?.workingDays) || rawConfig.workingDays.length === 0)
      ) {
        mergedConfig.workingDays = currentConfig.workingDays;
      }
    }
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
      selectedDisparadorInstances: await filterDisparadorInstancesReadyForAuth(
        auth,
        config.selectedDisparadorInstances
      ),
    };
    await saveDisparosConfigToDb(config);
    // Proxy Brasil NÃO aplica aqui (troca de seleção no wizard).
    // Só no «Gerar Campanha» / add instances — ver queueSyncProxyBrasilForCampaignSelection.
    return res.json({ ok: true, message: "Configuração do Disparador salva.", config });
  } catch (error: any) {
    console.error("[disparos/config] save error:", error);
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
    const selectedCount = Array.isArray(config.selectedDisparadorInstances)
      ? config.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean).length
      : 0;
    const instanceCount = Math.max(summary.activatedCount, selectedCount);
    const estimate = estimateAlternativaCampaignDuration({
      plannedSendCount,
      activatedInstanceCount: instanceCount,
      workingDaysPerWeek,
      startHour: config.startHour,
      endHour: config.endHour,
      workingDayKeys: Array.isArray(config.workingDays) ? config.workingDays : undefined,
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

app.post(
  "/disparos/messenger-images",
  (req, res, next) => {
    uploadMessengerImage.single("image")(req, res, (err) => {
      if (err) {
        const limitErr = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
        return res.status(400).json({
          error: limitErr
            ? "Imagem acima de 5 MB."
            : (err as Error).message || "Falha no upload da imagem.",
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "Selecione um arquivo de imagem." });
      }
      const slot = Math.floor(Number(req.body?.slot ?? req.query?.slot));
      const saved = saveCampaignMessengerImage({
        buffer: file.buffer,
        fileName: file.originalname || "imagem.jpg",
        mimeType: file.mimetype || "image/jpeg",
        slot,
      });
      return res.json({ ok: true, image: saved });
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || "Não foi possível salvar a imagem 1080×1080.",
      });
    }
  },
);

/** Público para a Evolution baixar mídia (fallback URL; preferimos base64). */
app.get("/disparos/messenger-images/:id/file", (req, res) => {
  const file = resolveCampaignMessengerImageFile(String(req.params.id || ""));
  if (!file) return res.status(404).json({ error: "Imagem não encontrada." });
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.sendFile(file.absolutePath);
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
    const responseUrlRaw = normalizeDisparosResponseUrl(String(fullConfig.responseUrl || ""));
    const responseUrlMascarada = responseUrlRaw
      ? (() => {
          try {
            const u = new URL(responseUrlRaw);
            return `${u.protocol}//${u.host}/…`;
          } catch {
            return "definida";
          }
        })()
      : "não definida";

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
        linkDestinationMode: fullConfig.linkDestinationMode,
        whatsappAlvoMascarado,
        responseUrlMascarada,
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
      const pending = leads.filter((l) => l.status === "pending" || l.status === "sending").length;
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
    const publicBaseHints = publicBaseHintsFromExpressRequest(req);
    if (!/^https?:\/\//i.test(longUrl)) {
      return res.status(400).json({ error: "longUrl deve ser uma URL válida." });
    }

    let shortUrl = "";
    let finalLongUrl = longUrl;
    let providerUsed: DisparosConfig["shortenerProvider"] | null = null;
    const maxAttempts = 5;
    const providers = getAutoShortenerProviderOrder();
    const providerErrors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const candidateUrl =
        attempt === 1 ? longUrl : appendAntiRepeatParam(longUrl, attempt);
      for (const provider of providers) {
        try {
          const candidateShort = await shortenUrlWithProvider(
            candidateUrl,
            provider,
            domain,
            publicBaseHints,
          );
          shortUrl = candidateShort;
          finalLongUrl = candidateUrl;
          providerUsed = provider;
          break;
        } catch (error: any) {
          const msg = String(error?.message || "erro").slice(0, 180);
          providerErrors.push(`${provider}: ${msg}`);
          console.warn(`[disparos/shorten] provider=${provider} falhou:`, msg);
        }
      }
      if (shortUrl) break;
    }

    if (!shortUrl) {
      const detail = providerErrors.slice(0, 6).join(" | ") || "nenhum provedor disponível";
      console.error("[disparos/shorten] todos os provedores falharam:", detail);
      return res.status(502).json({
        error: `Não foi possível gerar link curto. ${detail}`,
        providersTried: providers,
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
    console.error("[disparos/shorten]", error);
    return res.status(502).json({ error: error?.message || "Falha ao encurtar URL." });
  }
});

app.post("/disparos/gerar-mensagem-ai", async (req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const publicBaseHints = publicBaseHintsFromExpressRequest(req);
    const customBriefing = String(req.body?.briefing || "").trim();
    const briefing = customBriefing || String(config.aiBriefing || "").trim();
    const tone = String(req.body?.tone || config.aiTone || "consultivo").trim();
    const audience = String(req.body?.audience || config.aiAudience || "CORBAN").trim();
    const buttonMode =
      String(req.body?.ctaMode || "").toLowerCase() === "button" ||
      req.body?.buttonMode === true;
    const cta = String(
      req.body?.cta || config.aiCta || (buttonMode ? "Quero saber mais" : "Responda no link abaixo"),
    ).trim();
    const buttonLabel = normalizeButtonDisplayText(cta);
    const objective = String(req.body?.objective || "gerar mensagem de prospeccao").trim();
    const linkMode =
      String(req.body?.linkDestinationMode || config.linkDestinationMode || "whatsapp").toLowerCase() ===
      "url"
        ? "url"
        : "whatsapp";
    const previewConfig: DisparosConfig = {
      ...config,
      linkDestinationMode: linkMode,
      whatsappTargetNumber: normalizeWhatsAppNumber(
        String(req.body?.whatsappTargetNumber || config.whatsappTargetNumber || "")
      ),
      responseUrl: normalizeDisparosResponseUrl(
        String(req.body?.responseUrl || config.responseUrl || "")
      ),
    };
    const linkDestinationError = validateDisparosLinkDestination(previewConfig);
    if (linkDestinationError) {
      return res.status(400).json({
        error:
          linkMode === "url"
            ? "URL de resposta não configurada na seção Encurtador de URL."
            : "Número alvo não configurado na seção Encurtador de URL.",
      });
    }
    let shortUrl = "";
    let shortenerProvider = "";
    let shortenerWarning = "";
    try {
      const shortened = await generateUniqueShortUrlForDisparosConfig(
        previewConfig,
        publicBaseHints,
      );
      shortUrl = shortened.shortUrl;
      shortenerProvider = String(config.shortenerProvider || "");
    } catch (shortErr: any) {
      console.warn(
        "[gerar-mensagem-ai] encurtador indisponível, usando URL longa:",
        shortErr?.message || shortErr,
      );
      try {
        const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        shortUrl = buildDisparosDestinationLongUrl(previewConfig, nonce);
      } catch {
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
      cta: buttonMode ? buttonLabel : cta,
      objective,
      accessLink: buttonMode ? undefined : shortUrl,
      ctaMode: buttonMode ? "button" : "link",
      uniqueSeed: buttonMode ? newDisparosAiUniqueSeed() : undefined,
    });
    const generated = await callOpenAiGenerateMessage({
      prompt,
      model: String(req.body?.model || OPENAI_MODEL),
      maxOutputTokens: Number(req.body?.maxOutputTokens || (buttonMode ? 400 : 220)),
    });
    const assembled = buttonMode
      ? assembleAlternativaButtonOutbound(generated.text, buttonLabel)
      : null;
    const finalMessage = assembled
      ? assembled.text
      : ensureMessageContainsLink(generated.text, shortUrl, cta);
    return res.json({
      ok: true,
      message: finalMessage,
      model: generated.model,
      latencyMs: generated.latencyMs,
      shortUrl,
      shortenerProvider,
      ctaMode: buttonMode ? "button" : "link",
      buttonLabel: buttonMode ? assembled?.buttonLabel || buttonLabel : undefined,
      buttonUrl: buttonMode ? shortUrl : undefined,
      ...(shortenerWarning ? { shortenerWarning } : {}),
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
  return res.status(410).json({
    error: "Base de mensagens por planilha foi descontinuada. Use o Mensageiro com IA.",
  });
});

app.post("/disparos/templates/import", async (_req, res) => {
  return res.status(410).json({
    error: "Importação de mensagens por planilha foi descontinuada. Use o Mensageiro com IA.",
  });
});

async function hydrateCampaignFromDbIfNeeded(
  campaignId: string,
  options: {
    skipQueueLocalPersist?: boolean;
    /** Sem message_text/short_url — rápido o bastante para Ativar no 1º clique. */
    lightLeads?: boolean;
    /** Só cabeçalho+config; leads sobem depois (use com cuidado se for marcar running). */
    skipLeads?: boolean;
  } = {}
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
    if (!options.skipLeads) {
      try {
        let lr: any[] | null = null;
        if (options.lightLeads) {
          const light = await (supabase
            .from("disparos_campaign_leads" as any)
            .select("id, campaign_id, phone, status, created_at, sent_at")
            .eq("campaign_id", campaignId)
            .limit(100000)) as any;
          if (!light.error && Array.isArray(light.data)) lr = light.data;
        } else {
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
        }
        if (Array.isArray(lr)) leadRows = lr;
      } catch (e) {
        console.error("[Campanha] Falha ao ler leads no hydrate:", campaignId, e);
      }
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
        const memTerminal = new Map<
          string,
          { status: DisparosCampaignLead["status"]; sentAt: string | null; shortUrl?: string; messageText?: string }
        >();
        for (const ml of disparosCampaignLeadsMemory) {
          if (ml.campaignId !== campaignId) continue;
          if (ml.status === "sent" || ml.status === "failed") {
            memTerminal.set(ml.id, {
              status: ml.status,
              sentAt: ml.sentAt,
              shortUrl: ml.shortUrl,
              messageText: ml.messageText,
            });
          }
        }
        removeLeadsForCampaignFromMemory(campaignId);
        for (const lr of leadRows) {
          const idLead = String(lr?.id || crypto.randomUUID());
          const st = String(lr?.status || "pending").toLowerCase();
          let leadStatus: DisparosCampaignLead["status"] =
            st === "sent" ? "sent" : st === "failed" ? "failed" : "pending";
          let sentAt = lr?.sent_at ? String(lr.sent_at) : null;
          let shortUrl = typeof lr?.short_url === "string" ? String(lr.short_url) : undefined;
          let messageText =
            typeof lr?.message_text === "string" ? String(lr.message_text) : undefined;
          // Nunca rebaixar sent/failed da memória para pending do DB (persist falho → reenvio).
          const terminal = memTerminal.get(idLead);
          if (terminal && leadStatus === "pending") {
            leadStatus = terminal.status;
            sentAt = terminal.sentAt;
            shortUrl = terminal.shortUrl ?? shortUrl;
            messageText = terminal.messageText ?? messageText;
          }
          disparosCampaignLeadsMemory.push({
            id: idLead,
            campaignId: String(lr?.campaign_id || campaignId),
            phone: String(lr?.phone || ""),
            status: leadStatus,
            shortUrl,
            messageText,
            createdAt: String(lr?.created_at || new Date().toISOString()),
            sentAt,
          });
        }
        const sentN = disparosCampaignLeadsMemory.filter(
          (l) => l.campaignId === campaignId && l.status === "sent",
        ).length;
        if (sentN > existing.sentCount) existing.sentCount = sentN;
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
  config: DisparosConfig,
  opts?: { skipHumanPaused?: boolean; campaignId?: string; preferInstanceName?: string },
): Promise<{ instancia: string; numero: string } | null> {
  const selectedList =
    Array.isArray(config.selectedDisparadorInstances)
      ? config.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
  if (!selectedList.length) return null;

  let list: any[] = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(EVO_INSTANCES_URL, {
        headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      if (response.ok) {
        const raw = await response.json();
        list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.response)
            ? raw.response
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    list = [];
  }

  const connected = list.length ? buildConnectedFromEvoResponse(list) : [];
  const byName = new Map(
    connected.map((item) => [String(item.instancia || "").trim().toLowerCase(), item]),
  );
  const aliasesMap = await loadInstanceAliasesMap();
  const whatsappMap = await loadWhatsappProfileNamesMap();
  const evoRows = list.length
    ? buildEvoInstanceTagRowsFromList(list, whatsappMap, aliasesMap)
    : await fetchEvoInstanceTagRows({ withLiveState: false });
  const identityRows = evoRows.map((r) => ({
    instanceKey: r.instanceKey,
    displayName: r.displayName,
    nameKeys: Array.from(r.nameKeys),
    digitKeys: Array.from(r.digitKeys),
  }));
  const usageMap = await loadInstanceUsageMap();
  const restrictionMap = await getWhatsappConnectingRestrictionMap();
  const eligible: Array<{ instancia: string; numero: string }> = [];
  const campaignKey = String(opts?.campaignId || "").trim() || "__global_rr__";
  const canonicalSelected: string[] = [];

  for (const name of selectedList) {
    const evoName =
      resolveCampaignStoredNameToEvoKey(name, identityRows) ||
      resolveSelectedDisparadorToEvoName(name, connected) ||
      name;
    canonicalSelected.push(evoName);
    const usage = resolveUsageFromMap(usageMap, evoName) || resolveUsageFromMap(usageMap, name);
    if (usage && usage.useDisparador === false) continue;
    if (isCampaignInstanceBlocked(evoName) || isCampaignInstanceBlocked(name)) continue;
    const restrictionActive =
      restrictionMap[evoName.toLowerCase()]?.active === true ||
      restrictionMap[name.toLowerCase()]?.active === true;
    if (restrictionActive) continue;
    if (opts?.skipHumanPaused) {
      const life =
        (await getAquecedorLifecycleStatusForInstance(evoName)) ||
        (await getAquecedorLifecycleStatusForInstance(name));
      if (life?.phase === "restricted_wait") continue;
    }
    if (campaignKey !== "__global_rr__" && isCampaignInstanceInCooldown(campaignKey, evoName)) {
      continue;
    }
    let live = "";
    let statusReason: number | null = null;
    for (const probe of uniqueProbeNamesForLiveState(evoName, name)) {
      const detail = await fetchEvoInstanceLiveDetail(probe, { fresh: true });
      live = detail.state;
      statusReason = detail.statusReason;
      if (isEvoLiveStateOpen(live) && !isEvoWhatsAppRestrictedReason(statusReason)) break;
    }
    if (!isEvoLiveStateOpen(live)) continue;
    if (
      !campaignChipConnectedForDispatch({
        liveState: live,
        statusReason,
        blocked: isCampaignInstanceBlocked(evoName) || isCampaignInstanceBlocked(name),
        outboundBroken: getCachedAquecedorOutboundHealth(evoName)?.class === "broken",
        restricted: restrictionActive,
      })
    ) {
      continue;
    }
    if (loadProxyBrasilConfig()?.enabled) {
      const proxyFind = await fetchEvoProxyFindEnabled(evoName, callEvoAction, EVO_API_BASE, {
        timeoutMs: 6_000,
        retries: 0,
      });
      const cachedOn = getConfirmedProxyFind(evoName) === true;
      const maySend = instanceMaySendWithProxyBrasil({
        proxyConfigEnabled: true,
        selectedInLiveCampaign: true,
        connection: "open",
        proxyFindEnabled: cachedOn ? true : proxyFind,
        sessionAlreadyOpen: true,
      });
      if (!maySend.allowed) continue;
    }
    const fromList = byName.get(evoName.toLowerCase()) || byName.get(name.toLowerCase());
    let numero = String(fromList?.numero || "").trim();
    if (!numero) {
      try {
        numero = String((await resolveEvoInstancePhone(evoName)) || "").trim();
      } catch {
        numero = "";
      }
    }
    eligible.push({
      instancia: fromList?.instancia || evoName,
      numero,
    });
  }

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
  const prefer = String(opts?.preferInstanceName || "").trim().toLowerCase();
  if (prefer) {
    return pool.find((item) => item.instancia.toLowerCase() === prefer) || null;
  }
  const sendCounts: Record<string, number> = {};
  for (const item of pool) {
    sendCounts[item.instancia.toLowerCase()] = getCampaignInstanceSendCount(campaignKey, item.instancia);
  }
  const picked = pickBalancedEligibleCampaignInstance({
    selectedNames: canonicalSelected,
    eligibleNames: pool.map((item) => item.instancia),
    sendCounts,
    cursor: campaignDisparadorRoundRobin.get(campaignKey) ?? 0,
  });
  if (!picked.instanceName) return null;
  campaignDisparadorRoundRobin.set(campaignKey, picked.nextCursor);
  return (
    pool.find((item) => item.instancia.toLowerCase() === picked.instanceName!.toLowerCase()) || null
  );
}

const EVO_SAVE_CONTACT_TIMEOUT_MS = 2000;

const EVO_CONTACT_FIRST_NAMES = [
  "Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olivia", "Pedro",
  "Rafael", "Sofia", "Thiago", "Vanessa", "William", "Yasmin",
] as const;

const EVO_CONTACT_LAST_NAMES = [
  "Almeida", "Barbosa", "Cardoso", "Dias", "Fernandes", "Gomes", "Lima", "Mendes",
  "Nogueira", "Oliveira", "Pereira", "Ribeiro", "Rocha", "Santos", "Silva", "Souza",
  "Teixeira", "Vieira",
] as const;

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function generateRandomEvoContactName(): string {
  const first = pickRandomItem(EVO_CONTACT_FIRST_NAMES);
  const last = pickRandomItem(EVO_CONTACT_LAST_NAMES);
  let last2 = pickRandomItem(EVO_CONTACT_LAST_NAMES);
  if (last2 === last) {
    last2 = EVO_CONTACT_LAST_NAMES[(EVO_CONTACT_LAST_NAMES.indexOf(last) + 7) % EVO_CONTACT_LAST_NAMES.length]!;
  }
  return Math.random() < 0.6 ? `${first} ${last} ${last2}` : `${first} ${last}`;
}

/** Grava o lead na agenda da instância EVO. Não lança; timeout curto. */
async function saveEvoLeadContactInBackground(
  instanceName: string,
  phone: string,
): Promise<void> {
  const instance = String(instanceName || "").trim();
  const number = String(phone || "").replace(/\D/g, "");
  if (!instance || number.length < 10) return;
  const name = generateRandomEvoContactName();
  const payload = { number, name, saveOnDevice: true };
  const urls = [
    `${EVO_API_BASE}/contact/save/${encodeURIComponent(instance)}`,
    `${EVO_API_BASE}/chat/saveContact/${encodeURIComponent(instance)}`,
  ];
  for (const url of urls) {
    try {
      const result = await callEvoAction(url, "POST", payload, {
        timeoutMs: EVO_SAVE_CONTACT_TIMEOUT_MS,
        retries: 0,
      });
      if (result.ok) return;
      if (result.status !== 404 && result.status !== 405) {
        console.warn(
          `[Campanha Alternativa] contact/save ${instance} HTTP ${result.status}`,
        );
        return;
      }
    } catch (err: any) {
      console.warn(
        `[Campanha Alternativa] contact/save ${instance}:`,
        String(err?.message || err).slice(0, 160),
      );
      return;
    }
  }
}

/** Dispara o save em paralelo: o envio não espera nem atrasa. */
function queueEvoLeadContactSave(instanceName: string, phone: string): void {
  void saveEvoLeadContactInBackground(instanceName, phone).catch((err) => {
    console.warn(
      "[Campanha Alternativa] contact/save background:",
      String(err?.message || err).slice(0, 160),
    );
  });
}

async function sendEvoComposingPresenceBeforeText(
  instanceName: string,
  number: string,
  typingDelayMs: number,
): Promise<void> {
  const delay = Math.max(1200, Math.min(12000, Math.floor(typingDelayMs)));
  const body = {
    number,
    options: {
      delay: Math.min(delay, 8000),
      presence: "composing",
      number,
    },
  };
  const urls = [
    `${EVO_API_BASE}/chat/sendPresence/${encodeURIComponent(instanceName)}`,
    `${EVO_API_BASE}/message/sendPresence/${encodeURIComponent(instanceName)}`,
  ];
  let sent = false;
  for (const url of urls) {
    try {
      const result = await callEvoAction(url, "POST", body, {
        timeoutMs: 12_000,
        retries: 1,
      });
      if (result.ok) {
        sent = true;
        break;
      }
    } catch {
      /* tenta próximo path */
    }
  }
  if (!sent) {
    console.warn(
      `[Campanha Alternativa] sendPresence falhou em ${instanceName}; aplicando só delay humano (${delay}ms).`,
    );
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function composeOutboundMessageForConfig(
  config: DisparosConfig,
  opts?: { buttonMode?: boolean },
): Promise<{ text: string; shortUrl: string | null; buttonLabel?: string }> {
  const buttonMode = opts?.buttonMode === true;
  const userCta = String(config.aiCta || "Quero saber mais");
  const buttonLabel = normalizeButtonDisplayText(userCta);

  const { shortUrl } = await generateUniqueShortUrlForDisparosConfig(config);
  const briefing = String(config.aiBriefing || "");
  const prompt = buildDisparosAiPrompt({
    briefing,
    tone: String(config.aiTone || "consultivo"),
    audience: String(config.aiAudience || "CORBAN"),
    cta: userCta,
    objective: "gerar mensagem de prospeccao via WhatsApp",
    accessLink: buttonMode ? undefined : shortUrl,
    ctaMode: buttonMode ? "button" : "link",
    uniqueSeed: buttonMode ? newDisparosAiUniqueSeed() : undefined,
  });
  const generated = await callOpenAiGenerateMessage({
    prompt,
    model: OPENAI_MODEL,
    maxOutputTokens: buttonMode ? 400 : 220,
  });
  if (buttonMode) {
    const assembled = assembleAlternativaButtonOutbound(generated.text, userCta);
    return { text: assembled.text, shortUrl, buttonLabel: assembled.buttonLabel };
  }
  return {
    text: ensureMessageContainsLink(generated.text, shortUrl, userCta),
    shortUrl,
    buttonLabel,
  };
}

async function persistLeadSentAndCampaignCount(
  campaignId: string,
  leadId: string,
  nextSentCount: number,
  payload?: { shortUrl?: string | null; messageText?: string | null }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    queuePersistDisparosLocalState();
    return true;
  }
  try {
    const sentAt = new Date().toISOString();
    const shortUrl = String(payload?.shortUrl || "").trim();
    const messageText = String(payload?.messageText || "").trim();
    let leadPersisted = false;
    try {
      const full = await (supabase.from("disparos_campaign_leads" as any) as any)
        .update({
          status: "sent",
          sent_at: sentAt,
          short_url: shortUrl || null,
          message_text: messageText || null,
        })
        .eq("id", leadId)
        .select("id");
      if (!full?.error) leadPersisted = true;
      else {
        console.warn(
          "[Campanha] persist lead sent (full) falhou:",
          leadId,
          full.error?.message || full.error,
        );
      }
    } catch (err: any) {
      console.warn("[Campanha] persist lead sent (full) exceção:", leadId, err?.message || err);
    }
    if (!leadPersisted) {
      const legacy = await (supabase.from("disparos_campaign_leads" as any) as any)
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", leadId)
        .select("id");
      if (!legacy?.error) leadPersisted = true;
      else {
        console.error(
          "[Campanha] persist lead sent (legacy) falhou — risco de reenvio:",
          leadId,
          legacy.error?.message || legacy.error,
        );
      }
    }
    if (!leadPersisted) {
      queuePersistDisparosLocalState();
      return false;
    }
    const campUp = await (supabase.from("disparos_campaigns" as any) as any)
      .update({ sent_count: nextSentCount })
      .eq("id", campaignId);
    if (campUp?.error) {
      console.warn(
        "[Campanha] persist sent_count falhou:",
        campaignId,
        campUp.error?.message || campUp.error,
      );
    }
    queuePersistDisparosLocalState();
    return true;
  } catch (err: any) {
    console.error("[Campanha] persistLeadSentAndCampaignCount:", err?.message || err);
    queuePersistDisparosLocalState();
    return false;
  }
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

function getProxyBrasilCampaignPrepareDeps() {
  return {
    apiKey: EVO_API_KEY,
    restartInstanceLight: restartEvoInstanceLight,
    waitForOpenLenient: waitForEvoInstanceLiveOpenLenient,
    fetchLiveState: fetchEvoInstanceLiveState,
    isLiveStateOpen: isEvoLiveStateOpen,
  };
}

function queueProxyBrasilPrepareForCampaignInstances(instanceNames: string[]) {
  queueApplyProxyBrasilToInstances(
    instanceNames,
    callEvoAction,
    EVO_API_BASE,
    getProxyBrasilCampaignPrepareDeps(),
  );
}

/** Desliga Proxy Brasil só nos nomes explícitos que saíram da campanha — nunca nos que ficaram. */
function queueDisableProxyBrasilForDisconnectedCampaignInstances(
  _campaign: { configSnapshot?: DisparosConfig | null },
  _evoRows: EvoInstanceTagRow[],
  explicitInstanceNames?: string[]
): void {
  if (!loadProxyBrasilConfig()?.enabled) return;
  const names = new Set<string>();
  for (const raw of explicitInstanceNames || []) {
    const n = String(raw || "").trim();
    if (n) names.add(n);
  }
  if (!names.size) return;
  console.warn(
    "[Campanha] Desligando Proxy Brasil em instância(ões) que saíram da seleção:",
    Array.from(names).join(", ")
  );
  queueDisableProxyBrasilOnInstances(Array.from(names), callEvoAction, EVO_API_BASE);
}

async function prepareProxyBrasilForCampaignInstancesNow(instanceNames: string[]) {
  return prepareProxyBrasilSessionsForCampaign(instanceNames, {
    callEvoAction,
    evoApiBase: EVO_API_BASE,
    ...getProxyBrasilCampaignPrepareDeps(),
  });
}

function selectedInstanceNamesFromCampaign(campaign: { configSnapshot?: DisparosConfig | null }): string[] {
  const raw = campaign?.configSnapshot?.selectedDisparadorInstances;
  return Array.isArray(raw) ? raw.map((n) => String(n || "").trim()).filter(Boolean) : [];
}

function liveCampaignInstanceNamesForOwner(ownerEmail: string): string[] {
  const email = String(ownerEmail || "").trim().toLowerCase();
  if (!email.includes("@")) return [];
  const names = new Set<string>();
  for (const campaign of disparosCampaignsMemory) {
    if (String(campaign.ownerEmail || "").trim().toLowerCase() !== email) continue;
    const st = String(campaign.status || "").trim().toLowerCase();
    if (st !== "running" && st !== "paused") continue;
    for (const n of selectedInstanceNamesFromCampaign(campaign)) names.add(n);
  }
  return Array.from(names);
}

function instanceNameHeldByUnfinishedCampaign(instanceName: string): boolean {
  const target = String(instanceName || "").trim().toLowerCase();
  if (!target) return false;
  const held = namesHeldByUnfinishedCampaigns(
    disparosCampaignsMemory.map((c) => ({
      id: c.id,
      status: c.status,
      selectedInstanceNames: selectedInstanceNamesFromCampaign(c),
    })),
  );
  return held.some((n) => String(n || "").trim().toLowerCase() === target);
}

async function releaseHumanPauseForSelectedCampaignInstances(campaign: {
  configSnapshot?: DisparosConfig | null;
}): Promise<void> {
  const names = selectedInstanceNamesFromCampaign(campaign);
  if (!names.length) return;
  const restrictionMap = await getWhatsappConnectingRestrictionMap();
  const usageMap = await loadInstanceUsageMap();
  const usagePatches: Array<{
    instanceName: string;
    useAquecedor: boolean;
    useDisparador: boolean;
  }> = [];
  for (const name of names) {
    if (isCampaignInstanceBlocked(name)) continue;
    if (restrictionMap[name.toLowerCase()]?.active === true) continue;
    const life = await getAquecedorLifecycleStatusForInstance(name);
    if (life?.phase === "restricted_wait") continue;
    const current = getInstanceUsageFromMap(usageMap, name);
    if (current?.useDisparador === false) {
      usagePatches.push({
        instanceName: name,
        useAquecedor: current.useAquecedor !== false,
        useDisparador: true,
      });
    }
  }
  if (usagePatches.length) await persistInstanceUsage(usagePatches);
}

function heldProxyBrasilNamesFromLiveCampaigns(exceptCampaignId?: string): string[] {
  return namesHeldByUnfinishedCampaigns(
    disparosCampaignsMemory.map((c) => ({
      id: c.id,
      status: c.status,
      selectedInstanceNames: selectedInstanceNamesFromCampaign(c),
    })),
    exceptCampaignId,
  );
}

async function reconcileProxyBrasilForLiveCampaign(
  campaign: { configSnapshot?: DisparosConfig | null },
  extraReleaseInstanceNames?: string[],
  allowEnable = true,
  allowDisableHeld = true,
): Promise<void> {
  if (!loadProxyBrasilConfig()?.enabled) return;
  await reconcileProxyBrasilForCampaignInstances({
    selectedInstanceNames: selectedInstanceNamesFromCampaign(campaign),
    heldInstanceNames: heldProxyBrasilNamesFromLiveCampaigns(),
    extraReleaseInstanceNames,
    allowEnable,
    allowDisableHeld,
    callEvoAction,
    evoApiBase: EVO_API_BASE,
    prepareDeps: getProxyBrasilCampaignPrepareDeps(),
  });
}

function queueReleaseProxyBrasilAfterCampaignEnd(endedCampaign: {
  id: string;
  configSnapshot?: DisparosConfig | null;
}): void {
  if (!loadProxyBrasilConfig()?.enabled) return;
  const ending = selectedInstanceNamesFromCampaign(endedCampaign);
  if (!ending.length) return;
  const otherLive = disparosCampaignsMemory
    .filter(
      (c) =>
        c.id !== endedCampaign.id && campaignStatusHoldsProxyBrasil(String(c.status || "")),
    )
    .flatMap((c) => selectedInstanceNamesFromCampaign(c));
  const toDisable = instanceNamesToReleaseAfterCampaignEnd(ending, otherLive);
  if (!toDisable.length) return;
  queueDisableProxyBrasilOnInstances(toDisable, callEvoAction, EVO_API_BASE);
}

function scheduleCampaignProxyPrepareRetry(campaignId: string, waitMs = 15_000) {
  campaignNextAllowedSendAt.set(campaignId, Date.now() + Math.max(5_000, waitMs));
}

async function pauseCampaignDueToProxyPrepareFailure(
  campaignId: string,
  reason: string,
  options?: { instanceName?: string; disableProxy?: boolean }
): Promise<void> {
  const campaign = disparosCampaignsMemory.find((c) => c.id === campaignId);
  if (!campaign || campaign.status !== "running") return;
  campaign.status = "paused";
  const detail =
    String(reason || "").trim() ||
    "Pausa automática: falha de sessão/proxy na instância.";
  campaign.pauseReason = detail.startsWith("Pausa automática")
    ? detail
    : `Pausa automática: ${detail}`;
  console.warn(`[Campanha] ${campaignId} pausada (proxy/sessão): ${campaign.pauseReason}`);
  const offlineName = String(options?.instanceName || "").trim();
  const disableProxy = options?.disableProxy === true;
  if (disableProxy && offlineName) {
    queueDisableProxyBrasilForDisconnectedCampaignInstances(campaign, [], [offlineName]);
  } else if (disableProxy && loadProxyBrasilConfig()?.enabled) {
    try {
      const evoRows = await fetchEvoInstanceTagRows();
      queueDisableProxyBrasilForDisconnectedCampaignInstances(campaign, evoRows);
    } catch {
      /* */
    }
  }
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await (supabase.from("disparos_campaigns" as any) as any)
        .update({ status: "paused" })
        .eq("id", campaignId);
    } catch {
      /* */
    }
  }
  queuePersistDisparosLocalState();
}

function scheduleNextCampaignDispatchDelay(
  campaignId: string,
  config: DisparosConfig,
  instanceName?: string,
) {
  const minS = Math.max(10, Number(config.delayMinSeconds) || DISPAROS_DEFAULTS.delayMinSeconds);
  const maxS = Math.max(minS, Number(config.delayMaxSeconds) || DISPAROS_DEFAULTS.delayMaxSeconds);
  const waitSec = minS + Math.random() * (maxS - minS);
  const until = Date.now() + waitSec * 1000;
  const inst = String(instanceName || "").trim();
  if (inst) {
    campaignInstanceNextSendAt.set(campaignInstanceGateKey(campaignId, inst), until);
    return;
  }
  campaignNextAllowedSendAt.set(campaignId, Date.now() + Math.min(15_000, waitSec * 1000));
}

function extractCampaignSendMessageId(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const root = json as Record<string, unknown>;
  const key = root.key as Record<string, unknown> | undefined;
  return String(key?.id || root.id || "").trim();
}

function sleepCampaignMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function probeCampaignMessageAckStatus(
  instanceName: string,
  messageId: string,
  options?: { maxAttempts?: number; intervalMs?: number; requireDeviceDelivery?: boolean },
): Promise<{ status: EvoMessageAckStatus }> {
  const name = String(instanceName || "").trim();
  const id = String(messageId || "").trim();
  if (!name || !id) return { status: "UNKNOWN" };
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 8);
  const intervalMs = Math.max(500, options?.intervalMs ?? 2000);
  const requireDevice = options?.requireDeviceDelivery === true;
  let last: EvoMessageAckStatus = "UNKNOWN";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await sleepCampaignMs(intervalMs);
    const statusUrl = `${EVO_API_BASE}/chat/findStatusMessage/${encodeURIComponent(name)}`;
    const statusResult = await callEvoAction(
      statusUrl,
      "POST",
      { where: { id } },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 15000), retries: 1 },
    );
    if (statusResult.ok) {
      last = extractEvoMessageAckStatus(statusResult.json);
      if (isEvoAckFailure(last)) return { status: last };
      if (requireDevice) {
        if (isEvoAckDeviceDelivered(last)) return { status: last };
      } else if (last === "SERVER_ACK" || isEvoAckDeviceDelivered(last)) {
        return { status: last };
      }
    }
    const msgUrl = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(name)}`;
    const msgResult = await callEvoAction(
      msgUrl,
      "POST",
      { where: { key: { id } } },
      { timeoutMs: Math.min(defaultEvoHttpTimeoutMs(), 20000), retries: 1 },
    );
    if (msgResult.ok) {
      last = extractEvoMessageAckStatus(msgResult.json);
      if (isEvoAckFailure(last)) return { status: last };
      if (requireDevice) {
        if (isEvoAckDeviceDelivered(last)) return { status: last };
      } else if (last === "SERVER_ACK" || isEvoAckDeviceDelivered(last)) {
        return { status: last };
      }
    }
  }
  return { status: last };
}

function buildCampaignMessengerMediaPublicUrl(imageId: string): string {
  const base = resolveWabaPublicBaseUrl().replace(/\/+$/, "");
  const prefix = BASE_PATH ? BASE_PATH.replace(/\/+$/, "") : "";
  return `${base}${prefix}/disparos/messenger-images/${encodeURIComponent(imageId)}/file`;
}

async function sendCampaignMessengerImageToEvo(input: {
  instanceName: string;
  number: string;
  image: CampaignMessengerImageMeta;
}): Promise<{ ok: boolean; json: unknown; status: number; body: string }> {
  const mediaData = readCampaignMessengerImageBase64(input.image.id);
  if (!mediaData) {
    return { ok: false, json: null, status: 0, body: "Imagem do Mensageiro não encontrada no disco." };
  }
  const sendUrl = buildTemplateUrl(EVO_SEND_MEDIA_URL_TEMPLATE, input.instanceName);
  const baseBody: Record<string, unknown> = {
    number: input.number,
    mediatype: "image",
    mimetype: mediaData.mimeType || "image/jpeg",
    caption: "",
    fileName: mediaData.fileName || input.image.fileName || "campanha.jpg",
  };

  const canInline =
    mediaData.base64.length > 0 &&
    mediaData.base64.length <= CAMPAIGN_MEDIA_INLINE_BASE64_MAX_CHARS &&
    mediaData.sizeBytes <= 1.2 * 1024 * 1024;

  if (canInline) {
    const media = `data:${mediaData.mimeType};base64,${mediaData.base64.replace(/\s+/g, "")}`;
    const result = await callEvoAction(sendUrl, "POST", { ...baseBody, media }, {
      timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 60000),
      retries: 0,
    });
    if (result.ok) {
      return { ok: true, json: result.json, status: result.status, body: String(result.body || "") };
    }
    // Timeout (HTTP 0): a Evolution pode ter aceito mesmo assim — não mandar de novo via URL.
    if (result.status === 0) {
      const maybeId = extractCampaignSendMessageId(result.json);
      if (maybeId) {
        console.warn(
          "[Campanha] sendMedia base64 timeout mas messageId presente — trata como enviado (sem fallback URL):",
          maybeId,
        );
        return { ok: true, json: result.json, status: 0, body: String(result.body || "timeout") };
      }
      console.warn(
        "[Campanha] sendMedia base64 timeout/sem HTTP — não faz fallback URL (evita 2 imagens):",
        String(result.body || "").slice(0, 160),
      );
      return { ok: false, json: result.json, status: 0, body: String(result.body || "timeout") };
    }
    console.warn(
      "[Campanha] sendMedia base64 falhou; tentando URL:",
      result.status,
      String(result.body || "").slice(0, 160),
    );
  }

  const mediaUrl = buildCampaignMessengerMediaPublicUrl(input.image.id);
  const result = await callEvoAction(sendUrl, "POST", { ...baseBody, media: mediaUrl }, {
    timeoutMs: Math.max(defaultEvoHttpTimeoutMs(), 60000),
    retries: 0,
  });
  return {
    ok: result.ok,
    json: result.json,
    status: result.status,
    body: String(result.body || ""),
  };
}

async function processOneCampaignDispatch(campaignId: string): Promise<void> {
  const campaign = disparosCampaignsMemory.find((c) => c.id === campaignId);
  if (!campaign || campaign.status !== "running") return;

  const nextAt = campaignNextAllowedSendAt.get(campaignId) || 0;
  if (Date.now() < nextAt) return;

  if (campaignDispatchBusy.has(campaignId)) return;
  campaignDispatchBusy.add(campaignId);

  try {
    const ownerEmail = String(campaign.ownerEmail || "").trim().toLowerCase();
    const isAlternativaMotor =
      Boolean(ownerEmail) && (await shouldApplyAlternativaDispatchProfile(ownerEmail));
    const pacingConfig = campaignDispatchPacingConfig(
      campaign.configSnapshot,
      isAlternativaMotor,
    );
    if (isAlternativaMotor) {
      campaign.configSnapshot.delayMinSeconds = pacingConfig.delayMinSeconds;
      campaign.configSnapshot.delayMaxSeconds = pacingConfig.delayMaxSeconds;
    }

    const sentPhoneDigits = new Set(
      disparosCampaignLeadsMemory
        .filter((l) => l.campaignId === campaignId && l.status === "sent")
        .map((l) => String(normalizeWhatsAppNumber(l.phone) || "").replace(/\D/g, ""))
        .filter((d) => d.length >= 10),
    );
    const pendingLeads = disparosCampaignLeadsMemory.filter((l) => {
      if (l.campaignId !== campaignId || l.status !== "pending") return false;
      const digits = String(normalizeWhatsAppNumber(l.phone) || "").replace(/\D/g, "");
      if (digits.length >= 10 && sentPhoneDigits.has(digits)) {
        l.status = "sent";
        if (!l.sentAt) l.sentAt = new Date().toISOString();
        return false;
      }
      return true;
    });
    const lead =
      pendingLeads.find((l) => {
        const mid = String(l.mediaMessageId || "").trim();
        if (!mid) return false;
        const inst = String(l.mediaInstanceName || "").trim();
        if (!inst) return true;
        return !isCampaignInstanceInCooldown(campaignId, inst);
      }) ||
      pendingLeads.find((l) => !String(l.mediaMessageId || "").trim()) ||
      pendingLeads[0];
    if (!lead) {
      const stillSending = disparosCampaignLeadsMemory.some(
        (l) => l.campaignId === campaignId && l.status === "sending",
      );
      if (stillSending) return;
      const sentN = disparosCampaignLeadsMemory.filter(
        (l) => l.campaignId === campaignId && l.status === "sent",
      ).length;
      if (sentN > campaign.sentCount) campaign.sentCount = sentN;
      campaign.status = "finished";
      queueReleaseProxyBrasilAfterCampaignEnd(campaign);
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await (supabase.from("disparos_campaigns" as any) as any)
            .update({ status: "finished", sent_count: campaign.sentCount })
            .eq("id", campaignId);
        } catch {
          /* */
        }
      }
      queuePersistDisparosLocalState();
      return;
    }

    // Reserva imediata: evita tick paralelo reenviar o mesmo lead (IA/typing > 7s).
    lead.status = "sending";

    let outbound: { text: string; shortUrl: string | null; buttonLabel?: string };
    try {
      outbound = await composeOutboundMessageForConfig(campaign.configSnapshot, {
        buttonMode: isAlternativaMotor,
      });
    } catch (err) {
      console.error("[Campanha] Falha ao montar mensagem:", err);
      lead.status = "pending";
      return;
    }

    const instancePick = await pickDisparadorInstanceForConfig(campaign.configSnapshot, {
      skipHumanPaused: false,
      campaignId: campaign.id,
      preferInstanceName: lead.mediaMessageId ? lead.mediaInstanceName : undefined,
    });
    if (!instancePick) {
      console.error(
        isAlternativaMotor
          ? "[Campanha Alternativa] Nenhuma instância disponível (conectadas e com Disparador ativo)."
          : "[Campanha] Nenhuma instância disponível entre as selecionadas no snapshot da campanha (conectadas + com Disparador ativo)."
      );
      lead.status = "pending";
      return;
    }

    const proxyCfg = loadProxyBrasilConfig();
    if (proxyCfg?.enabled) {
      const proxyFind = await fetchEvoProxyFindEnabled(
        instancePick.instancia,
        callEvoAction,
        EVO_API_BASE,
        { timeoutMs: 6_000, retries: 0 },
      );
      const liveForReady = await fetchEvoInstanceLiveState(instancePick.instancia, { fresh: true });
      const maySend = instanceMaySendWithProxyBrasil({
        proxyConfigEnabled: true,
        selectedInLiveCampaign: true,
        connection: classifyProxyBrasilConnection(liveForReady),
        proxyFindEnabled: proxyFind,
        sessionAlreadyOpen: isEvoLiveStateOpen(liveForReady),
      });
      if (!maySend.allowed) {
        console.warn(
          `[Campanha] envio bloqueado sem Proxy Brasil (${maySend.reason}):`,
          instancePick.instancia,
        );
        if (maySend.reason === "not-open") {
          const conn = classifyProxyBrasilConnection(liveForReady);
          await pauseCampaignDueToProxyPrepareFailure(
            campaignId,
            `Instância ${instancePick.instancia} saiu de open (${liveForReady || "desconhecido"}). Reconecte no Aquecedor e ative de novo.`,
            { instanceName: instancePick.instancia, disableProxy: conn === "disconnected" },
          );
        }
        lead.status = "pending";
        return;
      }
    }

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instancePick.instancia);
    // Sempre preferir formato com 9º dígito no envio (leads antigos podem estar sem o 9).
    const numero = preferredBrazilWhatsAppSendNumber(lead.phone) || normalizeWhatsAppNumber(lead.phone);
    const digitsCheck = String(numero || "").replace(/\D/g, "");
    if (!isPlausibleBrWhatsappDestinationDigits(digitsCheck)) {
      await persistLeadFailed(lead, "invalid_phone");
      scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
      return;
    }
    const instanceLiveState = await fetchEvoInstanceLiveState(instancePick.instancia);
    if (!isEvoLiveStateOpen(instanceLiveState)) {
      console.error(
        "[Campanha] Instância não open no sistema WABA - Drax (connectionState):",
        instancePick.instancia,
        instanceLiveState || "desconhecido",
      );
      const conn = classifyProxyBrasilConnection(instanceLiveState);
      await pauseCampaignDueToProxyPrepareFailure(
        campaignId,
        `Instância ${instancePick.instancia} saiu de open durante o disparo (${instanceLiveState || "desconhecido"}). Reconecte no Aquecedor e ative de novo.`,
        { instanceName: instancePick.instancia, disableProxy: conn === "disconnected" },
      );
      lead.status = "pending";
      return;
    }

    const messengerImages = normalizeMessengerImagesConfig(campaign.configSnapshot.messengerImages);
    if (messengerImagesAreComplete(messengerImages)) {
      let mediaMessageId = String(lead.mediaMessageId || "").trim();
      let imageMetaSlot = 0;
      if (!mediaMessageId) {
        const imageIdx = pickNextMessengerImageIndex(
          campaignMessengerImageCursor,
          campaign.id,
          messengerImages.length,
        );
        const imageMeta = messengerImages[imageIdx];
        imageMetaSlot = imageMeta.slot + 1;
        const mediaSend = await sendCampaignMessengerImageToEvo({
          instanceName: instancePick.instancia,
          number: numero,
          image: imageMeta,
        });
        if (!mediaSend.ok) {
          console.error(
            "[Campanha] EVO sendMedia falhou:",
            mediaSend.status,
            String(mediaSend.body || "").slice(0, 200),
          );
          if (isEvoSenderBanHttp(mediaSend.status, String(mediaSend.body || ""))) {
            markCampaignChipUnsendable(instancePick.instancia, "sendMedia-403");
          }
          await persistLeadFailed(lead, classifyEvoSendFailure(mediaSend.status, mediaSend.body));
          scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
          return;
        }
        mediaMessageId = extractCampaignSendMessageId(mediaSend.json);
        if (!mediaMessageId) {
          console.error("[Campanha] sendMedia sem messageId — não envia texto sem ACK da imagem:", lead.phone);
          await persistLeadFailed(lead, "send_error");
          scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
          return;
        }
        lead.mediaMessageId = mediaMessageId;
        lead.mediaInstanceName = instancePick.instancia;
        queuePersistDisparosLocalState();
      }
      const mediaAck = await probeCampaignMessageAckStatus(instancePick.instancia, mediaMessageId, {
        maxAttempts: 5,
        intervalMs: 2000,
        requireDeviceDelivery: false,
      });
      console.info(
        `[Campanha] ACK imagem slot=${imageMetaSlot || "?"} ${instancePick.instancia} → ${lead.phone} msg=${mediaMessageId} status=${mediaAck.status}`,
      );
      if (isEvoAckFailure(mediaAck.status)) {
        console.error(
          "[Campanha] ACK da imagem = ERROR — texto não enviado:",
          mediaAck.status,
          lead.phone,
        );
        markCampaignChipUnsendable(instancePick.instancia, "campaign-media-ack-error");
        lead.mediaMessageId = undefined;
        lead.mediaInstanceName = undefined;
        await persistLeadFailed(lead, "send_error");
        scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
        return;
      }
      if (!isEvoAckDeviceDelivered(mediaAck.status)) {
        console.warn(
          "[Campanha] ACK imagem ainda não é DELIVERY_ACK; segue texto/botão (sendMedia HTTP ok):",
          mediaAck.status,
          lead.phone,
        );
      }
      await sleepCampaignMs(800);
    } else if (isAlternativaMotor) {
      console.warn(
        "[Campanha Alternativa] Sem 4 imagens 1080×1080 no snapshot — não envia texto sem imagem:",
        campaign.id,
      );
      lead.status = "pending";
      scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
      return;
    } else {
      console.warn(
        "[Campanha] Sem 4 imagens 1080×1080 no snapshot — enviando apenas texto:",
        campaign.id,
      );
    }

    const buttonLabel =
      outbound.buttonLabel ||
      normalizeButtonDisplayText(String(campaign.configSnapshot.aiCta || "Quero saber mais"));
    const buttonUrl = String(outbound.shortUrl || "").trim();
    let deliveredText = outbound.text;
    let usedUrlButton = false;
    let lastSendJson: unknown = null;

    const sendCampaignTextMessage = async (text: string): Promise<boolean> => {
      const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text }, linkPreview: false }
        : { number: numero, text, textMessage: { text }, linkPreview: false };
      const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
      if (!sendResult.ok) {
        console.error(
          "[Campanha] EVO send falhou:",
          sendResult.status,
          String(sendResult.body || "").slice(0, 200),
        );
        if (isEvoSenderBanHttp(sendResult.status, String(sendResult.body || ""))) {
          markCampaignChipUnsendable(instancePick.instancia, "sendText-403");
        }
        const failKind = classifyEvoSendFailure(sendResult.status, sendResult.body);
        await persistLeadFailed(lead, failKind);
        return false;
      }
      lastSendJson = sendResult.json;
      return true;
    };

    /** HTTP 201 da Evolution ≠ entrega. ERROR no MessageUpdate → não marcar sent. */
    const confirmCampaignSendAck = async (): Promise<EvoMessageAckStatus> => {
      const messageId = extractAquecedorSendMessageId(lastSendJson);
      if (!messageId) {
        console.warn(
          "[Campanha] Sem messageId no retorno EVO — não foi possível checar ACK:",
          lead.phone,
        );
        return "UNKNOWN";
      }
      const ackProbe = await probeAquecedorSendAckStatus(instancePick.instancia, messageId, {
        maxAttempts: 5,
        intervalMs: 2000,
      });
      console.info(
        `[Campanha] ACK ${instancePick.instancia} → ${lead.phone} msg=${messageId} status=${ackProbe.status}`,
      );
      return ackProbe.status;
    };

    if (isAlternativaMotor) {
      queueEvoLeadContactSave(instancePick.instancia, numero);
      const typingMs = computeAlternativaTypingDelayMs(outbound.text);
      await sendEvoComposingPresenceBeforeText(instancePick.instancia, numero, typingMs);
    }

    if (isAlternativaMotor && buttonUrl) {
      const sendButtonsWithLabel = (label: string) =>
        sendEvoAlternativaUrlButtonMessage({
          instanceName: instancePick.instancia,
          number: numero,
          messageText: outbound.text,
          buttonLabel: label,
          buttonUrl,
        });
      let buttonResult = await sendButtonsWithLabel(buttonLabel);
      let ghost = isGhostButtonsPayload(buttonResult.json ?? buttonResult.body);
      const safeFallbackLabel = ALTERNATIVA_URL_BUTTON_LABELS[0];
      if (
        (!buttonResult.ok || ghost) &&
        normalizeButtonDisplayText(buttonLabel) !== safeFallbackLabel
      ) {
        buttonResult = await sendButtonsWithLabel(safeFallbackLabel);
        ghost = isGhostButtonsPayload(buttonResult.json ?? buttonResult.body);
      }
      if (buttonResult.ok && !ghost) {
        usedUrlButton = true;
        deliveredText =
          prepareOutboundWhatsAppText(outbound.text, { stripUrls: true }) || outbound.text;
        lastSendJson = buttonResult.json;
      } else {
        console.warn(
          "[Campanha Alternativa] sendButtons indisponível; envia texto sem URL (imagem já foi):",
          buttonResult.status,
          ghost ? "viewOnce" : String(buttonResult.body || "").slice(0, 180),
        );
        const textOnly =
          prepareOutboundWhatsAppText(outbound.text, { stripUrls: true }) || outbound.text;
        if (!(await sendCampaignTextMessage(textOnly))) {
          scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
          return;
        }
        deliveredText = textOnly;
      }
    } else if (isAlternativaMotor && !buttonUrl) {
      console.error(
        "[Campanha Alternativa] sem URL do botão; lead pending — não envia texto sem botão.",
      );
      lead.status = "pending";
      queuePersistDisparosLocalState();
      scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
      return;
    } else {
      if (!(await sendCampaignTextMessage(outbound.text))) {
        scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
        return;
      }
    }

    let ackStatus = await confirmCampaignSendAck();
    if (isEvoAckFailure(ackStatus)) {
      console.error(
        `[Campanha] ACK=${ackStatus} — não marcar sent (EVO HTTP ok, WhatsApp rejeitou):`,
        instancePick.instancia,
        lead.phone,
      );
      markCampaignChipUnsendable(instancePick.instancia, "campaign-text-ack-error");
      await persistLeadFailed(lead, "send_error");
      scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
      return;
    }

    const sentIso = new Date().toISOString();
    lead.status = "sent";
    lead.mediaMessageId = undefined;
    lead.mediaInstanceName = undefined;
    lead.messageText = usedUrlButton
      ? `${deliveredText}\n[Botão: ${buttonLabel}]`
      : deliveredText;
    lead.sentAt = sentIso;
    lead.shortUrl = outbound.shortUrl || undefined;
    const sentN = disparosCampaignLeadsMemory.filter(
      (l) => l.campaignId === campaign.id && l.status === "sent",
    ).length;
    campaign.sentCount = Math.max(campaign.sentCount, sentN);
    recordInstanceDailySend(instancePick.instancia);
    recordCampaignInstanceSend(campaign.id, instancePick.instancia);
    if (ownerEmail) {
      const creditsApiKind = await resolveDispatchCreditsApiKindForOwner(ownerEmail);
      if (debitsDisparosCreditsPerSuccessfulSend(creditsApiKind)) {
        disparosCreditsService.recordShipmentConsumed(ownerEmail, 1, creditsApiKind);
        if (
          !disparosCreditsService.isMasterUnlimited(ownerEmail) &&
          disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, creditsApiKind) <= 0
        ) {
          campaign.status = "paused";
          campaign.pauseReason =
            "Pausa automática: créditos de envio esgotados para a API Alternativa.";
          const supabase = getSupabaseClient();
          if (supabase) {
            try {
              await (supabase.from("disparos_campaigns" as any) as any)
                .update({ status: "paused" })
                .eq("id", campaign.id);
            } catch {
              /* */
            }
          }
          queuePersistDisparosLocalState();
        }
      }
    }
    const persisted = await persistLeadSentAndCampaignCount(campaign.id, lead.id, campaign.sentCount, {
      shortUrl: lead.shortUrl || null,
      messageText: lead.messageText || null,
    });
    if (!persisted) {
      console.error(
        "[Campanha] Lead marcado sent em memória mas falhou no Supabase — bloqueando reenvio pelo status local:",
        lead.id,
        lead.phone,
      );
    }

    scheduleNextCampaignDispatchDelay(campaignId, pacingConfig, instancePick.instancia);
  } finally {
    campaignDispatchBusy.delete(campaignId);
  }
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
    let liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows, {
      withOutboundHealth: true,
    });
    if (getCampaignInstanceHealth(c.configSnapshot, liveRows).disconnectedCount > 0) {
      await tryAutoSwapDisconnectedCampaignInstances(c, liveRows);
      liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows);
    }
    liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows);
    await reconcileProxyBrasilForLiveCampaign(c, undefined, false, false);
    await releaseHumanPauseForSelectedCampaignInstances(c);
    const health = getCampaignInstanceHealth(c.configSnapshot, liveRows);
    if (health.needsMoreInstancesForMinimum) {
      c.status = "paused";
      const offline = disparadorInstanceTagsForCampaign(c.configSnapshot, liveRows)
        .filter((t) => t.connected !== true)
        .map((t) => t.instanceName);
      c.pauseReason = pauseReasonFromInstanceHealth(health, offline);
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
    const ownerEmail = String(c.ownerEmail || "").trim().toLowerCase();
    if (ownerEmail && (await shouldApplyAlternativaDispatchProfile(ownerEmail))) {
      if (!isAlternativaBurstWindowOpen(nowSp)) {
        continue;
      }
    }
    await processOneCampaignDispatch(c.id);
  }

  for (const c of disparosCampaignsMemory.filter((row) => row.status === "paused")) {
    if (isOperatorHeldCampaignPause(c.pauseReason)) continue;
    let liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows, {
      withOutboundHealth: true,
    });
    if (getCampaignInstanceHealth(c.configSnapshot, liveRows).disconnectedCount > 0) {
      await tryAutoSwapDisconnectedCampaignInstances(c, liveRows);
      liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows);
    }
    liveRows = await enrichSelectedCampaignInstancesLive(c.configSnapshot, evoRows);
    await reconcileProxyBrasilForLiveCampaign(c, undefined, false, false);
    await releaseHumanPauseForSelectedCampaignInstances(c);
    const health = getCampaignInstanceHealth(c.configSnapshot, liveRows);
    if (health.needsMoreInstancesForMinimum) continue;
    console.warn(
      `[Campanha] ${c.id} retomada automaticamente: há número open suficiente para disparar.`,
    );
    c.status = "running";
    c.pauseReason = undefined;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await (supabase.from("disparos_campaigns" as any) as any)
          .update({ status: "running" })
          .eq("id", c.id);
      } catch {
        /* */
      }
    }
    queuePersistDisparosLocalState();
    const snap = c.configSnapshot || DISPAROS_DEFAULTS;
    const janela = isDisparosWindowOpen(snap, nowSp);
    if (!janela.aberta) continue;
    const ownerEmail = String(c.ownerEmail || "").trim().toLowerCase();
    if (ownerEmail && (await shouldApplyAlternativaDispatchProfile(ownerEmail))) {
      if (!isAlternativaBurstWindowOpen(nowSp)) continue;
    }
    await processOneCampaignDispatch(c.id);
  }
}

/** Para aquecedor do usuário + campanhas em execução (memória e Postgres). */
async function stopAllDispatchActivityOnServer(
  ownerEmail?: string | null,
): Promise<{ pausedCampaignIds: string[] }> {
  const normalizedOwner = normalizeAquecedorOwnerEmail(ownerEmail);
  if (normalizedOwner) {
    await stopAquecedorRuntimeForOwner(normalizedOwner);
  }
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
      c.pauseReason = "Pausa automática: envios interrompidos no servidor.";
      pausedSet.add(c.id);
    }
  }

  queuePersistDisparosLocalState();
  return { pausedCampaignIds: Array.from(pausedSet) };
}

function countCampaignLeadsSent(campaignId: string, sentFallback: number): number {
  const memLeads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === campaignId);
  if (memLeads.length > 0) {
    return memLeads.filter((l) => l.status === "sent").length;
  }
  return Math.max(0, Number(sentFallback || 0));
}

function countCampaignLeadsProcessed(campaignId: string, sentFallback: number, totalNumbers: number): number {
  const memLeads = disparosCampaignLeadsMemory.filter((l) => l.campaignId === campaignId);
  if (memLeads.length > 0) {
    return memLeads.filter((l) => l.status === "sent" || l.status === "failed").length;
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
    const requestedPlannedSendCount = Math.max(
      0,
      Math.floor(Number(req.body?.plannedSendCount) || 0)
    );
    let creditsApiKind: WabaDispatchesApiKind = "oficial";
    if (ownerEmail && !disparosCreditsService.isMasterUnlimited(ownerEmail)) {
      creditsApiKind = await resolveDispatchCreditsApiKindForOwner(ownerEmail);
      const remaining = disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, creditsApiKind);
      if (remaining <= 0) {
        return res.status(400).json({
          error:
            "Você não possui envios contratados disponíveis. Contrate um pacote antes de criar a campanha.",
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
    } else if (requestedPlannedSendCount > 0) {
      plannedSendCount = Math.min(importedLineCount, requestedPlannedSendCount);
      numbers = numbers.slice(0, plannedSendCount);
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
    const heldByOtherCampaigns = heldProxyBrasilNamesFromLiveCampaigns();
    const occupied = campaignInstances.filter((n) =>
      instanceNameConflictsWithHeld(n, heldByOtherCampaigns),
    );
    if (occupied.length) {
      return res.status(409).json({
        error:
          "Há número(s) já em campanha não finalizada: " +
          occupied.join(", ") +
          ". Use só números disponíveis ou finalize a campanha anterior.",
        occupiedInstanceNames: occupied,
      });
    }

    const previousSelectedForProxy = (await loadDisparosConfigFromDb()).selectedDisparadorInstances || [];
    const previousLower = new Set(
      previousSelectedForProxy.map((n) => String(n || "").trim().toLowerCase()).filter(Boolean),
    );
    const selectedLower = new Set(campaignInstances.map((n) => n.toLowerCase()));
    const toDisableProxy = [...previousLower].filter((n) => !selectedLower.has(n));
    if (toDisableProxy.length) {
      queueDisableProxyBrasilOnInstances(toDisableProxy, callEvoAction, EVO_API_BASE);
    }
    const proxyPrepareResults = loadProxyBrasilConfig()?.enabled
      ? await prepareProxyBrasilForCampaignInstancesNow(campaignInstances)
      : [];
    const proxyPrepareNotReady = proxyPrepareResults.filter((r) => !r.ok);

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
      pauseReason:
        "Aguardando ativação. Clique em Ativar campanha para iniciar os disparos.",
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
        (proxyPrepareNotReady.length
          ? "Campanha criada (pausada). Para disparar com Proxy Brasil: reconecte as instâncias com QR campaignProxy=1 e depois ative. "
          : "Campanha criada com sucesso. Ative-a à direita para iniciar os disparos. ") + msgExtra,
      duplicatesRemoved,
      importedLineCount,
      plannedSendCount: numbers.length,
      importSummary,
      proxyPrepare: {
        ready: proxyPrepareResults.filter((r) => r.ok).map((r) => r.instanceName),
        notReady: proxyPrepareNotReady.map((r) => ({
          instanceName: r.instanceName,
          reason: r.reason,
          needsProxyPairing: r.needsProxyPairing === true,
        })),
      },
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
      item: { id: string; status: string; sentCount?: number; pauseReason?: string },
      configSnapshot: DisparosConfig | undefined,
      nowSp: Date,
      instanceHealth?: CampaignInstanceHealth,
      disconnectedNames?: string[]
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
          detail: describeCampaignPauseDetail(instanceHealth, {
            sentCount: Number(item.sentCount || 0),
            storedReason: item.pauseReason,
            disconnectedNames,
          }),
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
      const sentRaw = Number(row?.sent_count ?? row?.sentCount ?? 0);
      const sent = countCampaignLeadsSent(id, sentRaw);
      const progressPercent = progressPercentForCampaignListItem(id, total, sent);
      const processedCount = countCampaignLeadsProcessed(id, sent, total);
      const nextAllowedAtMs = campaignNextAllowedSendAt.get(id) || 0;
      const mem = disparosCampaignsMemory.find((c) => c.id === id);
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
        pauseReason: String(mem?.pauseReason || "").trim() || undefined,
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
        pauseReason?: string;
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
      const sent = countCampaignLeadsSent(c.id, Number(c.sentCount || 0));
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
        pauseReason: String(c.pauseReason || "").trim() || undefined,
      });
      configByCampaignId.set(c.id, c.configSnapshot);
    }

    const evoRowsAll = await fetchEvoInstanceTagRows({ withLiveState: false });
    const evoRows = await filterEvoTagRowsForRequest(req, evoRowsAll);
    const globalDisparos = await loadDisparosConfigFromDb();
    const auth = resolveWabaRequestAuth(req);
    const globalSelected = await filterDisparadorInstancesReadyForAuth(
      auth,
      Array.isArray(globalDisparos.selectedDisparadorInstances)
        ? globalDisparos.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
        : []
    );
    const nowSp = nowInSaoPaulo();

    const liveRowsByCampaignId = new Map<string, EvoInstanceTagRow[]>();
    const spareByCampaignId = new Map<string, number>();
    for (const item of byId.values()) {
      const st = String(item.status || "").toLowerCase();
      const snapshotCfg = configByCampaignId.get(item.id);
      const snapshotTags = disparadorInstanceTagsForCampaign(snapshotCfg, evoRows);
      const useGlobal =
        !snapshotTags.length && st === "running" && globalSelected.length > 0;
      const configForTags = useGlobal
        ? { ...DISPAROS_DEFAULTS, selectedDisparadorInstances: globalSelected }
        : snapshotCfg;
      const liveRows = await enrichSelectedCampaignInstancesLive(configForTags, evoRowsAll);
      liveRowsByCampaignId.set(item.id, liveRows);
      if (st !== "finished") {
        const selectedForSpare = Array.isArray(configForTags?.selectedDisparadorInstances)
          ? configForTags.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
          : [];
        let spareN = listConnectedSpareEvoNames(item.id, selectedForSpare, evoRowsAll, 20).length;
        const disconnectedN = getCampaignInstanceHealth(configForTags, liveRows).disconnectedCount;
        if (spareN === 0 && disconnectedN > 0) {
          spareN = (await resolveLiveSpareEvoNames(item.id, selectedForSpare, evoRowsAll, 20)).length;
        }
        spareByCampaignId.set(item.id, spareN);
      }
    }

    const proxyBrasilOn = Boolean(loadProxyBrasilConfig()?.enabled);
    const proxyKeysByCampaignId = new Map<string, string[]>();
    const items = Array.from(byId.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => {
        const liveRows = liveRowsByCampaignId.get(item.id) || evoRowsAll;
        const snapshotTags = disparadorInstanceTagsForCampaign(
          configByCampaignId.get(item.id),
          liveRows
        );
        const st = String(item.status || "").toLowerCase();
        const useGlobal =
          !snapshotTags.length && st === "running" && globalSelected.length > 0;
        const configForTags = useGlobal
          ? { ...DISPAROS_DEFAULTS, selectedDisparadorInstances: globalSelected }
          : configByCampaignId.get(item.id);
        const tags = disparadorInstanceTagsForCampaign(configForTags, liveRows);
        const instanceHealth = getCampaignInstanceHealth(configForTags, liveRows);
        const healthWithSpare: CampaignInstanceHealth = {
          ...instanceHealth,
          spareConnectedForSwap: spareByCampaignId.get(item.id) || 0,
        };
        const disconnectedNames = tags
          .filter((t) => t.connected !== true)
          .map((t) => String(t.instanceName || "").trim())
          .filter(Boolean);
        const runtimeStage = buildCampaignRuntimeStage(
          item,
          configByCampaignId.get(item.id),
          nowSp,
          healthWithSpare,
          disconnectedNames
        );
        const selectedRaw = Array.isArray(configForTags?.selectedDisparadorInstances)
          ? configForTags.selectedDisparadorInstances
              .map((n) => String(n || "").trim())
              .filter(Boolean)
          : [];
        const evoKeys = resolveSelectedNamesToEvoKeys(selectedRaw, liveRows);
        const connectedEvoKeys = Array.from(
          new Set(
            tags
              .filter((t) => t.connected === true)
              .map((t) => {
                const r = resolveStoredNameToEvoTag(t.instanceName, liveRows);
                return String(r.instanceKey || t.instanceName || "").trim();
              })
              .filter(Boolean),
          ),
        );
        // Chaves para confirmar proxy: só conectadas (offline não pode bloquear a tag).
        proxyKeysByCampaignId.set(item.id, connectedEvoKeys.length ? connectedEvoKeys : evoKeys);
        const proxyProtectionActive =
          proxyBrasilOn &&
          connectedEvoKeys.length > 0 &&
          areAllInstanceNamesProxyConfirmedEnabled(connectedEvoKeys);
        return {
          ...item,
          selectedInstanceNames: selectedDisparadorNamesFromConfig(configByCampaignId.get(item.id)),
          disparadorInstances: tags,
          disparadorInstancesFromGlobalFallback: Boolean(useGlobal && tags.length > 0),
          instanceHealth: healthWithSpare,
          runtimeStage,
          proxyProtectionActive,
        };
      });

    if (proxyBrasilOn) {
      const uniqueKeys = Array.from(
        new Set(Array.from(proxyKeysByCampaignId.values()).flat())
      );
      const uncached = uniqueKeys.filter((k) => getConfirmedProxyFind(k) === null);
      if (uncached.length) {
        await Promise.race([
          refreshConfirmedProxyFindForNames(uncached, callEvoAction, EVO_API_BASE),
          new Promise<void>((resolve) => setTimeout(resolve, 2800)),
        ]);
        for (const item of items) {
          const keys = proxyKeysByCampaignId.get(item.id) || [];
          item.proxyProtectionActive =
            keys.length > 0 && areAllInstanceNamesProxyConfirmedEnabled(keys);
        }
      }
      queueConfirmProxyFindForInstanceNames(uniqueKeys, callEvoAction, EVO_API_BASE);
    }

    return res.json({
      items,
      instancesHeldByUnfinishedCampaigns: heldProxyBrasilNamesFromLiveCampaigns(),
    });
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

app.post("/disparos/parar-envios", async (req, res) => {
  try {
    const auth = resolveWabaRequestAuth(req);
    const ownerEmail = normalizeAquecedorOwnerEmail(auth.email);
    const { pausedCampaignIds } = await stopAllDispatchActivityOnServer(ownerEmail);
    const motor = ownerEmail ? getAquecedorOwnerMotor(ownerEmail) : null;
    return res.json({
      ok: true,
      message:
        "Envios interrompidos: aquecedor parado e campanhas em execução foram pausadas (se houver).",
      aquecedorRodando: motor?.runtime.running === true,
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
      // lightLeads: Ativar no 1º clique sem baixar message_text de milhares de leads.
      campaign =
        (await hydrateCampaignFromDbIfNeeded(id, { lightLeads: true })) || undefined;
    } else {
      const hasLeads = disparosCampaignLeadsMemory.some((l) => l.campaignId === id);
      if (ativa && !hasLeads) {
        await hydrateCampaignFromDbIfNeeded(id, {
          lightLeads: true,
          skipQueueLocalPersist: true,
        });
      }
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
      evoRows = await enrichSelectedCampaignInstancesLive(campaign.configSnapshot, evoRows);
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
          error:
            "Campanha bloqueada: 50% ou mais das instâncias selecionadas estão desconectadas. Reconecte as instâncias ou use «+ Instâncias».",
          instanceHealth: health,
        });
      }
      const selectedForProxy = Array.isArray(campaign.configSnapshot?.selectedDisparadorInstances)
        ? campaign.configSnapshot.selectedDisparadorInstances
            .map((n) => String(n || "").trim())
            .filter(Boolean)
        : [];
      if (selectedForProxy.length && loadProxyBrasilConfig()?.enabled) {
        await prepareProxyBrasilForCampaignInstancesNow(selectedForProxy);
        let anyReady = false;
        const identityRowsForActivate = evoRows.map((r) => ({
          instanceKey: r.instanceKey,
          displayName: r.displayName,
          nameKeys: Array.from(r.nameKeys),
          digitKeys: Array.from(r.digitKeys),
        }));
        for (const rawName of selectedForProxy) {
          const evoName =
            resolveCampaignStoredNameToEvoKey(rawName, identityRowsForActivate) || rawName;
          let live = "";
          for (const probe of uniqueProbeNamesForLiveState(evoName, rawName)) {
            live = await fetchEvoInstanceLiveState(probe, { fresh: true });
            if (isEvoLiveStateOpen(live)) break;
          }
          const proxyFind = await fetchEvoProxyFindEnabled(evoName, callEvoAction, EVO_API_BASE, {
            timeoutMs: 8_000,
            retries: 0,
          });
          const maySend = instanceMaySendWithProxyBrasil({
            proxyConfigEnabled: true,
            selectedInLiveCampaign: true,
            connection: classifyProxyBrasilConnection(live),
            proxyFindEnabled: proxyFind,
            sessionAlreadyOpen: isEvoLiveStateOpen(live),
          });
          if (maySend.allowed) anyReady = true;
        }
        if (!anyReady) {
          return res.status(409).json({
            error:
              "Nenhuma instância selecionada está conectada com Proxy Brasil ligada. Reconecte no Aquecedor com Proxy Campanha e tente Ativar de novo.",
          });
        }
      }
    }
    campaign.status = nextStatus;
    if (ativa) {
      campaignNextAllowedSendAt.set(id, 0);
      campaign.pauseReason = undefined;
    } else {
      campaign.pauseReason = "Campanha pausada manualmente.";
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
      pauseReason: campaign.pauseReason || null,
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
    const auth = resolveWabaRequestAuth(req);
    const auto = req.body?.auto === true;

    let campaign = disparosCampaignsMemory.find((c) => c.id === id);
    if (!campaign) {
      campaign = (await hydrateCampaignFromDbIfNeeded(id)) || undefined;
    }
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }

    const prev = campaign.configSnapshot || { ...DISPAROS_DEFAULTS };
    let evoRows: EvoInstanceTagRow[] = [];
    let evoRowsAll: EvoInstanceTagRow[] = [];
    try {
      evoRowsAll = await fetchEvoInstanceTagRows({ withLiveState: false });
      evoRowsAll = await enrichSelectedCampaignInstancesLive(prev, evoRowsAll);
      evoRows = await filterEvoTagRowsForRequest(req, evoRowsAll);
    } catch {
      evoRows = [];
      evoRowsAll = [];
    }

    const selectedNames = Array.isArray(prev.selectedDisparadorInstances)
      ? prev.selectedDisparadorInstances.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
    const healthBefore = getCampaignInstanceHealth(prev, evoRowsAll);
    const instancesToAdd = Math.max(
      computeCampaignInstancesToAdd(healthBefore),
      healthBefore.disconnectedCount,
    );
    const disconnectedNames = listDisconnectedStoredInstanceNames(selectedNames, evoRowsAll);

    let incoming: string[] = [];
    if (auto) {
      const pickLimit = Math.max(instancesToAdd, 1);
      const spareSameAsUi = listConnectedSpareEvoNames(
        campaign.id,
        selectedNames,
        evoRowsAll,
        pickLimit,
      );
      incoming = spareSameAsUi.length
        ? spareSameAsUi
        : await resolveLiveSpareEvoNames(campaign.id, selectedNames, evoRowsAll, pickLimit);
      console.warn(
        `[Campanha] ${id} +Instâncias auto: spare=[${incoming.join(", ") || "—"}] selected=[${selectedNames.join(", ")}] offline=[${disconnectedNames.join(", ") || "—"}]`,
      );
      if (!incoming.length) {
        return res.status(409).json({
          error: disconnectedNames.length
            ? `Não há instância livre para substituir ${disconnectedNames.join(", ")}. Conecte um número habilitado para disparos e use «+ Instâncias».`
            : "Não há instância fora desta campanha para incluir.",
          instanceHealth: healthBefore,
        });
      }
      const swapped = await persistIncomingCampaignInstances(campaign, incoming, evoRowsAll);
      if (!swapped.added.length) {
        return res.status(400).json({
          error: "Nenhuma instância nova foi adicionada. Verifique se o número está conectado.",
          instanceHealth: healthBefore,
        });
      }
      const instanceHealth = getCampaignInstanceHealth(campaign.configSnapshot, evoRowsAll);
      const addedCount = swapped.added.length;
      const removedCount = swapped.removedBlocked.length;
      const swapNote =
        removedCount > 0
          ? ` Substituímos ${removedCount} número(s) bloqueado(s)/offline (${swapped.removedBlocked.join(", ")}).`
          : "";
      return res.json({
        ok: true,
        id,
        auto,
        selectedDisparadorInstances: campaign.configSnapshot.selectedDisparadorInstances,
        addedCount,
        removedBlockedCount: removedCount,
        removedBlocked: swapped.removedBlocked,
        instanceHealth,
        stillNeedsMore: instanceHealth.needsMoreInstancesForMinimum,
        message:
          `Instâncias atualizadas (${addedCount} adicionada(s)).${swapNote} Proxy Brasil será ligada nos novos números.`,
      });
    } else {
      const raw = Array.isArray(req.body?.instanceNames) ? req.body.instanceNames : [];
      incoming = await filterDisparadorInstancesReadyForAuth(
        auth,
        raw.map((n: any) => String(n || "").trim()).filter(Boolean)
      );
      if (!incoming.length) {
        return res.status(400).json({ error: "Informe ao menos uma instância válida para adicionar." });
      }
      const heldOther = heldProxyBrasilNamesFromLiveCampaigns(campaign.id);
      incoming = incoming.filter((n) => !instanceNameConflictsWithHeld(n, heldOther));
      if (!incoming.length) {
        return res.status(409).json({
          error:
            "Os números informados já estão em outra campanha não finalizada. Finalize a campanha anterior antes de reutilizá-los.",
        });
      }
    }

    const swapped = await applyCampaignDisconnectedSwap(campaign, incoming, evoRowsAll);
    if (!swapped.added.length) {
      return res.status(400).json({
        error:
          "Nenhuma instância nova foi adicionada. Verifique se o número está conectado e habilitado para disparos.",
        instanceHealth: healthBefore,
      });
    }

    const instanceHealth = getCampaignInstanceHealth(campaign.configSnapshot, evoRowsAll);
    const addedCount = swapped.added.length;
    const removedCount = swapped.removedBlocked.length;
    const stillNeedsMore = instanceHealth.needsMoreInstancesForMinimum;
    const swapNote =
      removedCount > 0
        ? ` Substituímos ${removedCount} número(s) bloqueado(s)/offline (${swapped.removedBlocked.join(", ")}).`
        : "";

    return res.json({
      ok: true,
      id,
      auto,
      selectedDisparadorInstances: campaign.configSnapshot.selectedDisparadorInstances,
      addedCount,
      removedBlockedCount: removedCount,
      removedBlocked: swapped.removedBlocked,
      instanceHealth,
      stillNeedsMore,
      message:
        computeCampaignInstancesToAdd(instanceHealth) > 0
          ? `Adicionamos ${addedCount} número(s).${swapNote} Ainda há instâncias desconectadas ou abaixo do mínimo. Conecte outro número e use «+ Instâncias».`
          : `Instâncias atualizadas (${addedCount} adicionada(s)).${swapNote} Proxy Brasil será ligada nos novos números.`,
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
    queueReleaseProxyBrasilAfterCampaignEnd(campaign);
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
registerWabaPushRoutes(app);
registerWabaLeadsCnpjRoutes(app);
registerWabaAdminRoutes(app);
registerWabaOperacionalCampanhasRoutes(app);
registerDeviceCloudRoutes(app);

new WabaSystemUserService().ensureBootstrapFromEnvMaster();

const httpServer = app.listen(PORT, () => {
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
    `[evo] base=${describeEvoApiBaseForOps(EVO_API_BASE)} tlsInsecure=${isEvoTlsInsecure()} timeoutMs=${defaultEvoHttpTimeoutMs()} sendTextTimeoutMs=${defaultEvoSendTextTimeoutMs()}`
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

    const desiredOwners = await loadAquecedorOwnerRuntimeIntents();
    const restoredDesired = await loadAndApplyDurableDesiredOwners();
    if (ENABLE_AQUECEDOR_PROCESSING && !MAINTENANCE_MODE) {
      const activeOwners = listAquecedorOwnersWithDesiredRunning();
      if (activeOwners.length) {
        await syncAquecedorWorkerLeadership();
        console.log(
          `[Aquecedor] retomado após restart para ${activeOwners.length} proprietário(s) (runtime-intent + desired durável${
            restoredDesired.length ? `; restaurados=${restoredDesired.join(",")}` : ""
          }).`,
        );
        for (const email of activeOwners) {
          void appendAquecedorCommandLog(
            "Aquecedor retomado automaticamente após restart do servidor.",
            email,
          );
        }
      } else if (desiredOwners.length) {
        console.log(
          `[Aquecedor] ${desiredOwners.length} proprietário(s) no runtime-intent, nenhum com desired=true.`,
        );
      }
    }

    setInterval(() => {
      syncAquecedorWorkerLeadership().catch((err) =>
        console.error("[Aquecedor] sync worker:", err),
      );
    }, AQUECEDOR_WORKER_SYNC_MS);

    const AQUECEDOR_PREPARE_PROMOTE_MS = 15_000;
    setInterval(() => {
      syncAquecedorPreparingPromotions()
        .then((promoted) => {
          if (promoted.length) {
            console.log(
              `[Aquecedor] ${promoted.length} instância(s) promovida(s) de Preparando → ativo: ${promoted.join(", ")}`,
            );
          }
        })
        .catch((err) => console.error("[Aquecedor] promoção Preparando:", err));
    }, AQUECEDOR_PREPARE_PROMOTE_MS);
    void syncAquecedorPreparingPromotions();
    console.log(
      `[Aquecedor] promoção Preparando→ativo a cada ${Math.round(AQUECEDOR_PREPARE_PROMOTE_MS / 1000)}s (independente do motor ligado)`,
    );

    void purgeAutomaticWhatsappConnectingRestrictions()
      .then((cleared) => {
        if (cleared.length) {
          console.warn(
            `[WA-Restrição] purge automático (connecting≠restrição): ${cleared.join(", ")}`,
          );
        }
      })
      .catch((err) => console.error("[WA-Restrição] purge automático:", err));
    setInterval(() => {
      recheckWhatsappConnectingRestrictions()
        .then((result) => {
          if (result.cleared.length) {
            console.log(
              `[WA-Restrição] liberada(s) após recheck 60min: ${result.cleared.join(", ")}`,
            );
          }
        })
        .catch((err) => console.error("[WA-Restrição] recheck 60min:", err));
    }, WA_CONNECTING_RECHECK_MS);
    void recheckWhatsappConnectingRestrictions().catch((err) =>
      console.error("[WA-Restrição] recheck inicial:", err),
    );
    console.log(
      `[WA-Restrição] só tags explícitas; connecting EVO não gera Restrição`,
    );

    if (ENABLE_BACKGROUND_PROCESSING && !MAINTENANCE_MODE) {
      if (WABA_ENV === "v01") {
        console.log("[campanhas] Disparador EVO ativo (ambiente v01 — tick a cada 7s).");
      }
      setInterval(() => {
        if (campaignDispatchTickRunning) return;
        campaignDispatchTickRunning = true;
        runCampaignDispatchTick()
          .catch((err) => console.error("[Campanhas] tick:", err))
          .finally(() => {
            campaignDispatchTickRunning = false;
          });
      }, 7000);
    } else if (!ENABLE_BACKGROUND_PROCESSING) {
      console.log(
        WABA_ENV === "v01"
          ? "[campanhas] Disparador EVO desativado neste processo (WABA_EVO_DISPARADOR=false)."
          : "[campanhas] processamento automático desativado neste processo (dev isolado)."
      );
    }

    startAsaasIntegrationMonitorScheduler();
    startUptimeMonitorScheduler();
    startCampaignSupplierAssignmentScheduler();
    startVpsCpuLocalSampler();
  })();
});

registerWabaGracefulShutdown(httpServer, async () => {
  try {
    const { shutdownLeadsCnpjBrowserRuntime } = await import(
      "./marketing/leads-cnpj/waba-leads-cnpj-browser-runtime"
    );
    await shutdownLeadsCnpjBrowserRuntime();
    console.log("[shutdown] Leads PJ Chromium runtime encerrado.");
  } catch (err) {
    console.error("[shutdown] falha ao encerrar Chromium Leads PJ:", err);
  }
  try {
    await flushAquecedorOwnerMotorsToDisk();
    console.log("[shutdown] aquecedor desired/runtime-intent persistido.");
  } catch (err) {
    console.error("[shutdown] falha ao persistir aquecedor:", err);
  }
});

