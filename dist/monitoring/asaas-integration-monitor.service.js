"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAsaasMonitorSlots = exports.isAsaasIntegrationMonitorEnabled = void 0;
exports.sendAsaasIntegrationTestAlert = sendAsaasIntegrationTestAlert;
exports.runAsaasIntegrationMonitorCheck = runAsaasIntegrationMonitorCheck;
exports.startAsaasIntegrationMonitorScheduler = startAsaasIntegrationMonitorScheduler;
exports.getAsaasIntegrationMonitorStatus = getAsaasIntegrationMonitorStatus;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const waba_evolution_whatsapp_delivery_service_1 = require("../mail/waba-evolution-whatsapp-delivery.service");
const waba_mail_service_1 = require("../mail/waba-mail.service");
const data_path_1 = require("../data-path");
const asaas_integration_health_service_1 = require("./asaas-integration-health.service");
const STATE_FILE = (0, data_path_1.resolveDataFile)("asaas-integration-monitor-state.json");
const DEFAULT_MONITOR_SLOTS = "08:00,20:00";
const DEFAULT_ALERT_WHATSAPP = "5551999666841";
const DEFAULT_ALERT_EMAIL = "walkup@walkuptec.com.br";
const URGENT_WHATSAPP_MESSAGE = "URGENTE: ASAAS\nÉ necessário dar atenção para a integração asaas.";
let monitorRunning = false;
const isAsaasIntegrationMonitorEnabled = () => {
    const raw = String(process.env.WABA_ASAAS_MONITOR_ENABLED ?? "").trim().toLowerCase();
    if (raw === "1" || raw === "true" || raw === "yes")
        return true;
    if (raw === "0" || raw === "false" || raw === "no")
        return false;
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
    if (runtime === "production")
        return true;
    if (wabaEnv === "v01")
        return true;
    return false;
};
exports.isAsaasIntegrationMonitorEnabled = isAsaasIntegrationMonitorEnabled;
const resolveAsaasMonitorSlots = () => {
    const raw = String(process.env.WABA_ASAAS_MONITOR_SLOTS ?? DEFAULT_MONITOR_SLOTS).trim();
    const slots = raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
        const match = part.match(/^(\d{1,2}):(\d{2})$/);
        if (!match)
            return "";
        const hour = Math.min(23, Math.max(0, Number(match[1])));
        const minute = Math.min(59, Math.max(0, Number(match[2])));
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    })
        .filter(Boolean);
    return slots.length ? Array.from(new Set(slots)) : DEFAULT_MONITOR_SLOTS.split(",");
};
exports.resolveAsaasMonitorSlots = resolveAsaasMonitorSlots;
const resolveWhatsappInstanceSequenceLabel = () => waba_evolution_whatsapp_delivery_service_1.DEFAULT_WABA_WHATSAPP_PHONE_HINTS.join(" → ");
const resolveAlertWhatsapp = () => String(process.env.WABA_ASAAS_MONITOR_ALERT_WHATSAPP ?? DEFAULT_ALERT_WHATSAPP).trim();
const resolveAlertEmail = () => String(process.env.WABA_ASAAS_MONITOR_ALERT_EMAIL ?? DEFAULT_ALERT_EMAIL).trim().toLowerCase();
const nowInSaoPauloParts = (date = new Date()) => {
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
    const read = (type) => String(parts.find((part) => part.type === type)?.value ?? "");
    const dateKey = `${read("year")}-${read("month")}-${read("day")}`;
    const slotKey = `${read("hour")}:${read("minute")}`;
    return { dateKey, slotKey };
};
const buildRunKey = (dateKey, slot) => `${dateKey}:${slot}`;
async function readMonitorState() {
    try {
        const raw = await fs_1.promises.readFile(STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed?.runs && typeof parsed.runs === "object" ? parsed : { runs: {} };
    }
    catch {
        return { runs: {} };
    }
}
async function writeMonitorState(state) {
    await fs_1.promises.mkdir(path_1.default.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, STATE_FILE);
}
const buildEmailHtml = (report) => {
    const lines = report.issues.map((issue) => `<li><strong>${issue.code}</strong> — ${issue.message} <em>(ação: ${issue.action})</em></li>`);
    return `
    <p><strong>URGENTE: ASAAS</strong></p>
    <p>É necessário dar atenção para a integração asaas.</p>
    <p>Verificação: ${report.checkedAt}</p>
    <ul>${lines.join("")}</ul>
  `.trim();
};
async function deliverAsaasIntegrationAlerts(report) {
    const delivery = await (0, waba_evolution_whatsapp_delivery_service_1.deliverWabaEvolutionWhatsApp)({
        targetWhatsapp: resolveAlertWhatsapp(),
        text: URGENT_WHATSAPP_MESSAGE,
        logLabel: "asaas monitor",
    });
    const whatsappResult = {
        ok: delivery.status === "sent",
        detail: delivery.message,
    };
    let emailResult = { ok: false, detail: "E-mail não tentado." };
    const email = resolveAlertEmail();
    if (!email.includes("@")) {
        emailResult = { ok: false, detail: "E-mail de alerta inválido." };
    }
    else if (!waba_mail_service_1.wabaMailService.isConfigured()) {
        emailResult = { ok: false, detail: "SMTP não configurado." };
    }
    else {
        try {
            const delivery = await waba_mail_service_1.wabaMailService.send({
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
        }
        catch (error) {
            emailResult = {
                ok: false,
                detail: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
            };
        }
    }
    console.warn(`[asaas-monitor] alertas enviados whatsapp=${whatsappResult.ok} email=${emailResult.ok}`);
    if (!whatsappResult.ok) {
        console.warn("[asaas-monitor] whatsapp falhou:", whatsappResult.detail);
    }
    if (!emailResult.ok) {
        console.warn("[asaas-monitor] email falhou:", emailResult.detail);
    }
    return { whatsapp: whatsappResult, email: emailResult };
}
async function sendAsaasIntegrationTestAlert() {
    const report = {
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
async function runAsaasIntegrationMonitorCheck(input) {
    const report = await (0, asaas_integration_health_service_1.evaluateAsaasIntegrationHealth)();
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
    const state = input?.skipState ? { runs: {} } : await readMonitorState();
    const previous = state.runs[runKey];
    const issueCodes = report.issues.map((issue) => issue.code);
    const shouldAlert = Boolean(input?.forceAlert) || !previous?.alertSent;
    let alerts;
    let alertSent = false;
    if (shouldAlert) {
        alerts = await deliverAsaasIntegrationAlerts(report);
        alertSent = true;
    }
    else {
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
    console.warn(`[asaas-monitor] FALHA (${slot}) — ${report.issues.length} problema(s): ${issueCodes.join(", ")}`);
    return { report, slot, alertSent, alerts };
}
async function monitorTick() {
    if (monitorRunning)
        return;
    monitorRunning = true;
    try {
        const { slotKey } = nowInSaoPauloParts();
        const slots = (0, exports.resolveAsaasMonitorSlots)();
        if (!slots.includes(slotKey))
            return;
        const { dateKey } = nowInSaoPauloParts();
        const runKey = buildRunKey(dateKey, slotKey);
        const state = await readMonitorState();
        if (state.runs[runKey]?.checkedAt) {
            return;
        }
        await runAsaasIntegrationMonitorCheck({ slot: slotKey });
    }
    catch (error) {
        console.error("[asaas-monitor] tick:", error instanceof Error ? error.message : error);
    }
    finally {
        monitorRunning = false;
    }
}
function startAsaasIntegrationMonitorScheduler() {
    if (!(0, exports.isAsaasIntegrationMonitorEnabled)()) {
        console.log("[asaas-monitor] desativado (WABA_ASAAS_MONITOR_ENABLED=false ou ambiente dev).");
        return;
    }
    const slots = (0, exports.resolveAsaasMonitorSlots)();
    console.log(`[asaas-monitor] verificações diárias às ${slots.join(" e ")} (America/Sao_Paulo) | instância ${resolveWhatsappInstanceSequenceLabel()} → WhatsApp ${resolveAlertWhatsapp()} / ${resolveAlertEmail()}`);
    void monitorTick().catch((error) => {
        console.error("[asaas-monitor] bootstrap:", error);
    });
    setInterval(() => {
        void monitorTick();
    }, 60000).unref?.();
}
async function getAsaasIntegrationMonitorStatus() {
    const lastReport = await (0, asaas_integration_health_service_1.evaluateAsaasIntegrationHealth)();
    const state = await readMonitorState();
    return {
        enabled: (0, exports.isAsaasIntegrationMonitorEnabled)(),
        slots: (0, exports.resolveAsaasMonitorSlots)(),
        alertInstance: resolveWhatsappInstanceSequenceLabel(),
        alertWhatsapp: resolveAlertWhatsapp(),
        alertEmail: resolveAlertEmail(),
        state,
        lastReport,
    };
}
