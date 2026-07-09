import { promises as fs } from "fs";
import path from "path";
import { wabaMailService } from "../mail/waba-mail.service";
import { deliverWabaEvolutionWhatsApp, DEFAULT_WABA_WHATSAPP_PHONE_HINTS } from "../mail/waba-evolution-whatsapp-delivery.service";
import { resolveDataFile } from "../data-path";
import { evaluateAsaasIntegrationHealth } from "./asaas-integration-health.service";
import { evoHttpRequestWithBaseFailover } from "../evo-api-config";
import { resolveEvoInstancesUrl } from "../services/evo-send-recovery.service";

const STATE_FILE = resolveDataFile("uptime-monitor-state.json");

const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_REALERT_MINUTES = 60;
const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_HTTP_ATTEMPTS = 3;

const DEFAULT_ALERT_WHATSAPP = "5551999666841";
const DEFAULT_ALERT_EMAIL = "walkup@walkuptec.com.br";

type UptimeTargetKind = "http" | "asaas" | "evo";

type UptimeTarget = {
  key: string;
  label: string;
  kind: UptimeTargetKind;
  url?: string;
};

type UptimeCheckResult = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type TargetState = {
  status: "up" | "down";
  since: string;
  lastCheckedAt: string;
  lastAlertAt: string | null;
  consecutiveFailures: number;
  lastDetail: string;
};

type UptimeMonitorState = {
  targets: Record<string, TargetState>;
};

let monitorRunning = false;

const DEFAULT_TARGETS: UptimeTarget[] = [
  { key: "site_drax", label: "draxsistemas.com.br", kind: "http", url: "https://draxsistemas.com.br/" },
  { key: "site_bet", label: "bet.waba.info", kind: "http", url: "https://bet.waba.info/" },
  { key: "site_disparos", label: "wabadisparos.com.br", kind: "http", url: "https://wabadisparos.com.br/" },
  { key: "app_waba", label: "waba.draxsistemas.com.br", kind: "http", url: "https://waba.draxsistemas.com.br/health" },
];

const parseBoolEnv = (raw: string | undefined): boolean | undefined => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return undefined;
};

export const isUptimeMonitorEnabled = (): boolean => {
  const explicit = parseBoolEnv(process.env.WABA_UPTIME_MONITOR_ENABLED);
  if (explicit !== undefined) return explicit;
  const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
  const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
  if (runtime === "production") return true;
  if (wabaEnv === "v01") return true;
  return false;
};

const isAsaasCheckEnabled = (): boolean =>
  parseBoolEnv(process.env.WABA_UPTIME_MONITOR_CHECK_ASAAS) ?? true;

const isEvoCheckEnabled = (): boolean =>
  parseBoolEnv(process.env.WABA_UPTIME_MONITOR_CHECK_EVO) ?? true;

export const resolveUptimeIntervalMs = (): number => {
  const raw = Number(process.env.WABA_UPTIME_MONITOR_INTERVAL_MINUTES ?? DEFAULT_INTERVAL_MINUTES);
  const minutes = Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : DEFAULT_INTERVAL_MINUTES;
  return minutes * 60_000;
};

const resolveRealertMs = (): number => {
  const raw = Number(process.env.WABA_UPTIME_MONITOR_REALERT_MINUTES ?? DEFAULT_REALERT_MINUTES);
  const minutes = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : DEFAULT_REALERT_MINUTES;
  return minutes * 60_000;
};

const resolveHttpTimeoutMs = (): number => {
  const raw = Number(process.env.WABA_UPTIME_MONITOR_HTTP_TIMEOUT_MS ?? DEFAULT_HTTP_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 3_000 ? Math.round(raw) : DEFAULT_HTTP_TIMEOUT_MS;
};

const resolveWhatsappInstanceSequenceLabel = (): string =>
  DEFAULT_WABA_WHATSAPP_PHONE_HINTS.join(" → ");

const resolveAlertWhatsapp = (): string =>
  String(process.env.WABA_UPTIME_MONITOR_ALERT_WHATSAPP ?? DEFAULT_ALERT_WHATSAPP).trim();

const resolveAlertEmail = (): string =>
  String(process.env.WABA_UPTIME_MONITOR_ALERT_EMAIL ?? DEFAULT_ALERT_EMAIL).trim().toLowerCase();

export const resolveUptimeTargets = (): UptimeTarget[] => {
  const raw = String(process.env.WABA_UPTIME_MONITOR_TARGETS ?? "").trim();
  const targets: UptimeTarget[] = [];
  if (raw) {
    for (const part of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
      try {
        const parsed = new URL(part);
        targets.push({
          key: `http_${parsed.hostname.replace(/[^a-z0-9]+/gi, "_")}`,
          label: parsed.hostname,
          kind: "http",
          url: part,
        });
      } catch {
        // ignora URL inválida
      }
    }
  }
  const httpTargets = targets.length ? targets : DEFAULT_TARGETS;
  const withAsaas = isAsaasCheckEnabled()
    ? [
        ...httpTargets,
        { key: "asaas_webhook", label: "Asaas (integração/webhook)", kind: "asaas" as const },
      ]
    : httpTargets;
  if (isEvoCheckEnabled()) {
    return [
      ...withAsaas,
      { key: "evo_api", label: "Evolution API (fetchInstances)", kind: "evo" as const },
    ];
  }
  return withAsaas;
};

async function checkHttpTarget(
  target: UptimeTarget,
  options?: { attempts?: number; timeoutMs?: number },
): Promise<UptimeCheckResult> {
  const url = String(target.url || "").trim();
  if (!url) {
    return { key: target.key, label: target.label, ok: false, detail: "URL não configurada." };
  }
  const timeoutMs = options?.timeoutMs ?? resolveHttpTimeoutMs();
  const attempts = Math.max(1, options?.attempts ?? DEFAULT_HTTP_ATTEMPTS);
  let lastDetail = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "waba-uptime-monitor/1.0" },
      });
      clearTimeout(timer);
      const status = response.status;
      if (status >= 200 && status < 400) {
        return { key: target.key, label: target.label, ok: true, detail: `HTTP ${status}` };
      }
      lastDetail = `HTTP ${status}`;
    } catch (error) {
      clearTimeout(timer);
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `timeout (${timeoutMs}ms)`
          : error instanceof Error
            ? error.message
            : "erro de rede";
      lastDetail = message;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return { key: target.key, label: target.label, ok: false, detail: lastDetail || "sem resposta" };
}

async function checkAsaasTarget(target: UptimeTarget): Promise<UptimeCheckResult> {
  try {
    const report = await evaluateAsaasIntegrationHealth();
    if (report.ok) {
      return { key: target.key, label: target.label, ok: true, detail: "integração saudável" };
    }
    const detail = report.issues
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join(" | ")
      .slice(0, 400);
    return { key: target.key, label: target.label, ok: false, detail: detail || "falha na integração" };
  } catch (error) {
    return {
      key: target.key,
      label: target.label,
      ok: false,
      detail: error instanceof Error ? error.message : "erro ao avaliar Asaas",
    };
  }
}

async function checkEvoTarget(target: UptimeTarget): Promise<UptimeCheckResult> {
  const apiKey = String(process.env.EVO_API_KEY || "").trim();
  if (!apiKey) {
    return { key: target.key, label: target.label, ok: false, detail: "EVO_API_KEY ausente." };
  }
  try {
    const url = resolveEvoInstancesUrl();
    const result = await evoHttpRequestWithBaseFailover(url, "GET", {
      apiKey,
      timeoutMs: resolveHttpTimeoutMs(),
      retries: 2,
    });
    if (result.ok) {
      return {
        key: target.key,
        label: target.label,
        ok: true,
        detail: `fetchInstances HTTP ${result.status}`,
      };
    }
    const detail = String(result.body || result.error || "sem corpo").slice(0, 200);
    return {
      key: target.key,
      label: target.label,
      ok: false,
      detail: `fetchInstances HTTP ${result.status}: ${detail}`,
    };
  } catch (error) {
    return {
      key: target.key,
      label: target.label,
      ok: false,
      detail: error instanceof Error ? error.message : "erro ao consultar Evolution",
    };
  }
}

async function runChecks(targets: UptimeTarget[]): Promise<UptimeCheckResult[]> {
  const results = await Promise.all(
    targets.map((target) => {
      if (target.kind === "asaas") return checkAsaasTarget(target);
      if (target.kind === "evo") return checkEvoTarget(target);
      return checkHttpTarget(target);
    }),
  );
  return results;
}

async function readMonitorState(): Promise<UptimeMonitorState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as UptimeMonitorState;
    return parsed?.targets && typeof parsed.targets === "object" ? parsed : { targets: {} };
  } catch {
    return { targets: {} };
  }
}

async function writeMonitorState(state: UptimeMonitorState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmp, STATE_FILE);
}

const buildWhatsappMessage = (down: UptimeCheckResult[], recovered: UptimeCheckResult[]): string => {
  const lines: string[] = [];
  if (down.length) {
    lines.push("🚨 WABA MONITOR — FORA DO AR");
    for (const item of down) {
      lines.push(`• ${item.label}: ${item.detail}`);
    }
  }
  if (recovered.length) {
    if (lines.length) lines.push("");
    lines.push("✅ Recuperado:");
    for (const item of recovered) {
      lines.push(`• ${item.label}`);
    }
  }
  lines.push("");
  lines.push(`Verificado: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  return lines.join("\n");
};

const buildEmailHtml = (down: UptimeCheckResult[], recovered: UptimeCheckResult[]): string => {
  const downList = down
    .map((item) => `<li><strong>${item.label}</strong> — ${item.detail}</li>`)
    .join("");
  const recoveredList = recovered.map((item) => `<li>${item.label}</li>`).join("");
  return `
    ${down.length ? `<p><strong>🚨 WABA MONITOR — serviços fora do ar</strong></p><ul>${downList}</ul>` : ""}
    ${recovered.length ? `<p><strong>✅ Recuperado</strong></p><ul>${recoveredList}</ul>` : ""}
    <p>Verificado: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
  `.trim();
};

async function deliverAlerts(
  down: UptimeCheckResult[],
  recovered: UptimeCheckResult[],
): Promise<{
  instance: { name: string; connected: boolean; detail: string };
  whatsapp: { ok: boolean; detail: string };
  email: { ok: boolean; detail: string };
}> {
  const sequenceLabel = resolveWhatsappInstanceSequenceLabel();
  const delivery = await deliverWabaEvolutionWhatsApp({
    targetWhatsapp: resolveAlertWhatsapp(),
    text: buildWhatsappMessage(down, recovered),
    logLabel: "uptime monitor",
  });
  const whatsapp = {
    ok: delivery.status === "sent",
    detail: delivery.message,
  };

  let email: { ok: boolean; detail: string } = { ok: false, detail: "E-mail não tentado." };
  const emailTo = resolveAlertEmail();
  if (!emailTo.includes("@")) {
    email = { ok: false, detail: "E-mail de alerta inválido." };
  } else if (!wabaMailService.isConfigured()) {
    email = { ok: false, detail: "SMTP não configurado." };
  } else {
    try {
      const subject = down.length
        ? `URGENTE: WABA — ${down.length} serviço(s) fora do ar`
        : "WABA — serviços recuperados";
      const mailDelivery = await wabaMailService.send({
        to: emailTo,
        subject,
        html: buildEmailHtml(down, recovered),
        text: buildWhatsappMessage(down, recovered),
      });
      email = { ok: true, detail: mailDelivery.messageId || "E-mail enviado." };
    } catch (error) {
      email = { ok: false, detail: error instanceof Error ? error.message : "Falha ao enviar e-mail." };
    }
  }

  const instanceDetail =
    delivery.instanceName
      ? `instância ${delivery.instanceName} (${sequenceLabel})`
      : `sequência ${sequenceLabel}`;

  console.warn(
    `[uptime-monitor] alerta enviado via ${instanceDetail} | whatsapp=${whatsapp.ok} email=${email.ok}`,
  );
  if (!whatsapp.ok) console.warn("[uptime-monitor] whatsapp falhou:", whatsapp.detail);
  if (!email.ok) console.warn("[uptime-monitor] email falhou:", email.detail);

  return {
    instance: {
      name: delivery.instanceName || sequenceLabel,
      connected: delivery.status === "sent",
      detail: instanceDetail,
    },
    whatsapp,
    email,
  };
}

export async function runUptimeMonitorCheck(input?: {
  forceAlert?: boolean;
  skipState?: boolean;
}): Promise<{
  checkedAt: string;
  ok: boolean;
  results: UptimeCheckResult[];
  down: string[];
  recovered: string[];
  alertSent: boolean;
  alerts?: Awaited<ReturnType<typeof deliverAlerts>>;
}> {
  const targets = resolveUptimeTargets();
  const results = await runChecks(targets);
  const checkedAt = new Date().toISOString();
  const realertMs = resolveRealertMs();
  const now = Date.now();

  const state = input?.skipState ? { targets: {} as Record<string, TargetState> } : await readMonitorState();

  const downNow = results.filter((result) => !result.ok);
  const recoveredNow: UptimeCheckResult[] = [];
  let needAlert = Boolean(input?.forceAlert);

  for (const result of results) {
    const previous = state.targets[result.key];
    if (result.ok) {
      if (previous && previous.status === "down") {
        recoveredNow.push(result);
        needAlert = true;
      }
      state.targets[result.key] = {
        status: "up",
        since: previous && previous.status === "up" ? previous.since : checkedAt,
        lastCheckedAt: checkedAt,
        lastAlertAt: previous?.lastAlertAt ?? null,
        consecutiveFailures: 0,
        lastDetail: result.detail,
      };
    } else {
      const wasDown = previous && previous.status === "down";
      const lastAlertAt = previous?.lastAlertAt ? Date.parse(previous.lastAlertAt) : 0;
      const dueForRealert = wasDown && (now - lastAlertAt >= realertMs);
      if (!wasDown || dueForRealert) needAlert = true;
      state.targets[result.key] = {
        status: "down",
        since: wasDown ? previous!.since : checkedAt,
        lastCheckedAt: checkedAt,
        lastAlertAt: previous?.lastAlertAt ?? null,
        consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
        lastDetail: result.detail,
      };
    }
  }

  let alertSent = false;
  let alerts: Awaited<ReturnType<typeof deliverAlerts>> | undefined;
  const shouldSend = needAlert && (downNow.length > 0 || recoveredNow.length > 0);

  if (shouldSend) {
    alerts = await deliverAlerts(downNow, recoveredNow);
    alertSent = true;
    for (const result of downNow) {
      if (state.targets[result.key]) {
        state.targets[result.key].lastAlertAt = checkedAt;
      }
    }
  }

  if (!input?.skipState) {
    await writeMonitorState(state as UptimeMonitorState);
  }

  if (downNow.length) {
    console.warn(
      `[uptime-monitor] FALHA — ${downNow.length} alvo(s): ${downNow.map((item) => `${item.label} (${item.detail})`).join("; ")}`,
    );
  } else {
    console.info(`[uptime-monitor] OK — ${results.length} alvo(s) no ar.`);
  }

  return {
    checkedAt,
    ok: downNow.length === 0,
    results,
    down: downNow.map((item) => item.key),
    recovered: recoveredNow.map((item) => item.key),
    alertSent,
    alerts,
  };
}

export async function sendUptimeMonitorTestAlert(): Promise<
  Awaited<ReturnType<typeof deliverAlerts>>
> {
  const down: UptimeCheckResult[] = [
    {
      key: "test",
      label: "Alerta de teste (uptime monitor)",
      ok: false,
      detail: "Teste manual — ignore se foi solicitado.",
    },
  ];
  return deliverAlerts(down, []);
}

async function monitorTick(): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;
  try {
    await runUptimeMonitorCheck();
  } catch (error) {
    console.error("[uptime-monitor] tick:", error instanceof Error ? error.message : error);
  } finally {
    monitorRunning = false;
  }
}

export function startUptimeMonitorScheduler(): void {
  if (!isUptimeMonitorEnabled()) {
    console.log("[uptime-monitor] desativado (WABA_UPTIME_MONITOR_ENABLED=false ou ambiente dev).");
    return;
  }

  const intervalMs = resolveUptimeIntervalMs();
  const targets = resolveUptimeTargets();
  console.log(
    `[uptime-monitor] ativo — ${targets.length} alvo(s) a cada ${Math.round(intervalMs / 60_000)}min | alerta → WhatsApp ${resolveAlertWhatsapp()} (instância ${resolveWhatsappInstanceSequenceLabel()}) + ${resolveAlertEmail()}`,
  );

  void monitorTick().catch((error) => {
    console.error("[uptime-monitor] bootstrap:", error);
  });

  setInterval(() => {
    void monitorTick();
  }, intervalMs).unref?.();
}

type UptimeLight = { key: string; label: string; ok: boolean; detail: string };
type UptimeLightsPayload = { checkedAt: string; allOk: boolean; lights: UptimeLight[] };

const LIGHTS_CACHE_MS = Math.max(
  10_000,
  Math.min(120_000, Number(process.env.WABA_UPTIME_MONITOR_LIGHTS_CACHE_MS ?? 45_000) || 45_000),
);
let lightsCache: { at: number; payload: UptimeLightsPayload } | null = null;

/**
 * Estado atual (para as luzes da UI): checagem rápida (1 tentativa, timeout curto)
 * com cache curto para não sobrecarregar. Não envia alertas nem grava estado.
 */
export async function getUptimeLights(options?: { fresh?: boolean }): Promise<UptimeLightsPayload> {
  if (!options?.fresh && lightsCache && Date.now() - lightsCache.at < LIGHTS_CACHE_MS) {
    return lightsCache.payload;
  }
  const targets = resolveUptimeTargets();
  const fastTimeout = Math.min(resolveHttpTimeoutMs(), 6_000);
  const results = await Promise.all(
    targets.map((target) => {
      if (target.kind === "asaas") return checkAsaasTarget(target);
      if (target.kind === "evo") return checkEvoTarget(target);
      return checkHttpTarget(target, { attempts: 2, timeoutMs: fastTimeout });
    }),
  );
  const lights: UptimeLight[] = results.map((result) => ({
    key: result.key,
    label: result.label,
    ok: result.ok,
    detail: result.detail,
  }));
  const payload: UptimeLightsPayload = {
    checkedAt: new Date().toISOString(),
    allOk: lights.every((light) => light.ok),
    lights,
  };
  lightsCache = { at: Date.now(), payload };
  return payload;
}

export async function getUptimeMonitorStatus(): Promise<{
  enabled: boolean;
  intervalMinutes: number;
  realertMinutes: number;
  targets: UptimeTarget[];
  alertWhatsapp: string;
  alertEmail: string;
  primaryPhone: string;
  fallbackPhone: string;
  state: UptimeMonitorState;
}> {
  const state = await readMonitorState();
  return {
    enabled: isUptimeMonitorEnabled(),
    intervalMinutes: Math.round(resolveUptimeIntervalMs() / 60_000),
    realertMinutes: Math.round(resolveRealertMs() / 60_000),
    targets: resolveUptimeTargets(),
    alertWhatsapp: resolveAlertWhatsapp(),
    alertEmail: resolveAlertEmail(),
    primaryPhone: DEFAULT_WABA_WHATSAPP_PHONE_HINTS[0],
    fallbackPhone: `${DEFAULT_WABA_WHATSAPP_PHONE_HINTS[1]} → ${DEFAULT_WABA_WHATSAPP_PHONE_HINTS[2]}`,
    state,
  };
}
