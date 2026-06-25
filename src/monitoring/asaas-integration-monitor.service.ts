import { promises as fs } from "fs";
import path from "path";
import { wabaMailService } from "../mail/waba-mail.service";
import { resolveDataFile } from "../data-path";
import {
  evaluateAsaasIntegrationHealth,
  type AsaasIntegrationHealthReport,
} from "./asaas-integration-health.service";
import { sendEvoTextAlert } from "./evo-text-alert.client";

const STATE_FILE = resolveDataFile("asaas-integration-monitor-state.json");

const DEFAULT_MONITOR_SLOTS = "08:00,20:00";
const DEFAULT_ALERT_INSTANCE = "5197462102";
const DEFAULT_ALERT_WHATSAPP = "5551999666841";
const DEFAULT_ALERT_EMAIL = "walkup@walkuptec.com.br";

const URGENT_WHATSAPP_MESSAGE =
  "URGENTE: ASAAS\nÉ necessário dar atenção para a integração asaas.";

type MonitorSlotRun = {
  checkedAt: string;
  ok: boolean;
  alertSent: boolean;
  issueCodes: string[];
};

type MonitorState = {
  runs: Record<string, MonitorSlotRun>;
};

let monitorRunning = false;

export const isAsaasIntegrationMonitorEnabled = (): boolean => {
  const raw = String(process.env.WABA_ASAAS_MONITOR_ENABLED ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
  const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
  if (runtime === "production") return true;
  if (wabaEnv === "v01") return true;
  return false;
};

export const resolveAsaasMonitorSlots = (): string[] => {
  const raw = String(process.env.WABA_ASAAS_MONITOR_SLOTS ?? DEFAULT_MONITOR_SLOTS).trim();
  const slots = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return "";
      const hour = Math.min(23, Math.max(0, Number(match[1])));
      const minute = Math.min(59, Math.max(0, Number(match[2])));
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    })
    .filter(Boolean);
  return slots.length ? Array.from(new Set(slots)) : DEFAULT_MONITOR_SLOTS.split(",");
};

const resolveAlertInstance = (): string =>
  String(process.env.WABA_ASAAS_MONITOR_ALERT_INSTANCE ?? DEFAULT_ALERT_INSTANCE).trim();

const resolveAlertWhatsapp = (): string =>
  String(process.env.WABA_ASAAS_MONITOR_ALERT_WHATSAPP ?? DEFAULT_ALERT_WHATSAPP).trim();

const resolveAlertEmail = (): string =>
  String(process.env.WABA_ASAAS_MONITOR_ALERT_EMAIL ?? DEFAULT_ALERT_EMAIL).trim().toLowerCase();

const nowInSaoPauloParts = (date = new Date()): { dateKey: string; slotKey: string } => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    String(parts.find((part) => part.type === type)?.value ?? "");
  const dateKey = `${read("year")}-${read("month")}-${read("day")}`;
  const slotKey = `${read("hour")}:${read("minute")}`;
  return { dateKey, slotKey };
};

const buildRunKey = (dateKey: string, slot: string): string => `${dateKey}:${slot}`;

async function readMonitorState(): Promise<MonitorState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as MonitorState;
    return parsed?.runs && typeof parsed.runs === "object" ? parsed : { runs: {} };
  } catch {
    return { runs: {} };
  }
}

async function writeMonitorState(state: MonitorState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmp, STATE_FILE);
}

const buildEmailHtml = (report: AsaasIntegrationHealthReport): string => {
  const lines = report.issues.map(
    (issue) =>
      `<li><strong>${issue.code}</strong> — ${issue.message} <em>(ação: ${issue.action})</em></li>`,
  );
  return `
    <p><strong>URGENTE: ASAAS</strong></p>
    <p>É necessário dar atenção para a integração asaas.</p>
    <p>Verificação: ${report.checkedAt}</p>
    <ul>${lines.join("")}</ul>
  `.trim();
};

async function deliverAsaasIntegrationAlerts(report: AsaasIntegrationHealthReport): Promise<{
  whatsapp: { ok: boolean; detail: string };
  email: { ok: boolean; detail: string };
}> {
  const whatsappResult = await sendEvoTextAlert({
    instanceName: resolveAlertInstance(),
    targetNumber: resolveAlertWhatsapp(),
    text: URGENT_WHATSAPP_MESSAGE,
  });

  let emailResult: { ok: boolean; detail: string } = { ok: false, detail: "E-mail não tentado." };
  const email = resolveAlertEmail();
  if (!email.includes("@")) {
    emailResult = { ok: false, detail: "E-mail de alerta inválido." };
  } else if (!wabaMailService.isConfigured()) {
    emailResult = { ok: false, detail: "SMTP não configurado." };
  } else {
    try {
      const delivery = await wabaMailService.send({
        to: email,
        subject: "URGENTE: ASAAS — integração requer atenção",
        html: buildEmailHtml(report),
        text: `${URGENT_WHATSAPP_MESSAGE}\n\n${report.issues
          .map((issue) => `- ${issue.code}: ${issue.message}`)
          .join("\n")}`,
      });
      emailResult = {
        ok: true,
        detail: delivery.messageId || "E-mail enviado.",
      };
    } catch (error) {
      emailResult = {
        ok: false,
        detail: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
      };
    }
  }

  console.warn(
    `[asaas-monitor] alertas enviados whatsapp=${whatsappResult.ok} email=${emailResult.ok}`,
  );
  if (!whatsappResult.ok) {
    console.warn("[asaas-monitor] whatsapp falhou:", whatsappResult.detail);
  }
  if (!emailResult.ok) {
    console.warn("[asaas-monitor] email falhou:", emailResult.detail);
  }

  return { whatsapp: whatsappResult, email: emailResult };
}

export async function sendAsaasIntegrationTestAlert(): Promise<{
  whatsapp: { ok: boolean; detail: string };
  email: { ok: boolean; detail: string };
}> {
  const report: AsaasIntegrationHealthReport = {
    ok: false,
    checkedAt: new Date().toISOString(),
    issues: [
      {
        code: "test_alert",
        severity: "warning",
        message: "Alerta de teste manual — integração pode estar OK; ignore se foi solicitado.",
        action: "env",
      },
    ],
  };
  return deliverAsaasIntegrationAlerts(report);
}

export async function runAsaasIntegrationMonitorCheck(input?: {
  slot?: string;
  forceAlert?: boolean;
  skipState?: boolean;
}): Promise<{
  report: AsaasIntegrationHealthReport;
  slot: string;
  alertSent: boolean;
  alerts?: Awaited<ReturnType<typeof deliverAsaasIntegrationAlerts>>;
}> {
  const report = await evaluateAsaasIntegrationHealth();
  const { dateKey, slotKey } = nowInSaoPauloParts();
  const slot = String(input?.slot ?? slotKey).trim();
  const runKey = buildRunKey(dateKey, slot);

  if (report.ok) {
    if (!input?.skipState) {
      const state = await readMonitorState();
      state.runs[runKey] = {
        checkedAt: report.checkedAt,
        ok: true,
        alertSent: false,
        issueCodes: [],
      };
      await writeMonitorState(state);
    }
    console.info(`[asaas-monitor] OK (${slot}) — integração Asaas saudável.`);
    return { report, slot, alertSent: false };
  }

  const state = input?.skipState ? { runs: {} as Record<string, MonitorSlotRun> } : await readMonitorState();
  const previous = state.runs[runKey];
  const issueCodes = report.issues.map((issue) => issue.code);
  const shouldAlert = Boolean(input?.forceAlert) || !previous?.alertSent;

  let alerts: Awaited<ReturnType<typeof deliverAsaasIntegrationAlerts>> | undefined;
  let alertSent = false;
  if (shouldAlert) {
    alerts = await deliverAsaasIntegrationAlerts(report);
    alertSent = true;
  } else {
    console.info(`[asaas-monitor] problemas persistem (${slot}), alerta já enviado hoje neste horário.`);
  }

  if (!input?.skipState) {
    state.runs[runKey] = {
      checkedAt: report.checkedAt,
      ok: false,
      alertSent: previous?.alertSent || alertSent,
      issueCodes,
    };
    await writeMonitorState(state);
  }

  console.warn(
    `[asaas-monitor] FALHA (${slot}) — ${report.issues.length} problema(s): ${issueCodes.join(", ")}`,
  );

  return { report, slot, alertSent, alerts };
}

async function monitorTick(): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;
  try {
    const { slotKey } = nowInSaoPauloParts();
    const slots = resolveAsaasMonitorSlots();
    if (!slots.includes(slotKey)) return;

    const { dateKey } = nowInSaoPauloParts();
    const runKey = buildRunKey(dateKey, slotKey);
    const state = await readMonitorState();
    if (state.runs[runKey]?.checkedAt) {
      return;
    }

    await runAsaasIntegrationMonitorCheck({ slot: slotKey });
  } catch (error) {
    console.error(
      "[asaas-monitor] tick:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    monitorRunning = false;
  }
}

export function startAsaasIntegrationMonitorScheduler(): void {
  if (!isAsaasIntegrationMonitorEnabled()) {
    console.log("[asaas-monitor] desativado (WABA_ASAAS_MONITOR_ENABLED=false ou ambiente dev).");
    return;
  }

  const slots = resolveAsaasMonitorSlots();
  console.log(
    `[asaas-monitor] verificações diárias às ${slots.join(" e ")} (America/Sao_Paulo) | instância ${resolveAlertInstance()} → WhatsApp ${resolveAlertWhatsapp()} / ${resolveAlertEmail()}`,
  );

  void monitorTick().catch((error) => {
    console.error("[asaas-monitor] bootstrap:", error);
  });

  setInterval(() => {
    void monitorTick();
  }, 60_000).unref?.();
}

export async function getAsaasIntegrationMonitorStatus(): Promise<{
  enabled: boolean;
  slots: string[];
  alertInstance: string;
  alertWhatsapp: string;
  alertEmail: string;
  state: MonitorState;
  lastReport: AsaasIntegrationHealthReport;
}> {
  const lastReport = await evaluateAsaasIntegrationHealth();
  const state = await readMonitorState();
  return {
    enabled: isAsaasIntegrationMonitorEnabled(),
    slots: resolveAsaasMonitorSlots(),
    alertInstance: resolveAlertInstance(),
    alertWhatsapp: resolveAlertWhatsapp(),
    alertEmail: resolveAlertEmail(),
    state,
    lastReport,
  };
}
