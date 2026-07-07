"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUptimeTargets = exports.resolveUptimeIntervalMs = exports.isUptimeMonitorEnabled = void 0;
exports.runUptimeMonitorCheck = runUptimeMonitorCheck;
exports.sendUptimeMonitorTestAlert = sendUptimeMonitorTestAlert;
exports.startUptimeMonitorScheduler = startUptimeMonitorScheduler;
exports.getUptimeMonitorStatus = getUptimeMonitorStatus;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const waba_mail_service_1 = require("../mail/waba-mail.service");
const data_path_1 = require("../data-path");
const evo_text_alert_client_1 = require("./evo-text-alert.client");
const evo_connection_state_service_1 = require("../instances/evo-connection-state.service");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
const asaas_integration_health_service_1 = require("./asaas-integration-health.service");
const STATE_FILE = (0, data_path_1.resolveDataFile)("uptime-monitor-state.json");
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_REALERT_MINUTES = 60;
const DEFAULT_HTTP_TIMEOUT_MS = 15000;
const DEFAULT_HTTP_ATTEMPTS = 3;
const DEFAULT_PRIMARY_PHONE = "51981077770";
const DEFAULT_FALLBACK_PHONE = "51997462102";
const DEFAULT_ALERT_WHATSAPP = "5551999666841";
const DEFAULT_ALERT_EMAIL = "walkup@walkuptec.com.br";
let monitorRunning = false;
const DEFAULT_TARGETS = [
    { key: "site_drax", label: "draxsistemas.com.br", kind: "http", url: "https://draxsistemas.com.br/" },
    { key: "site_bet", label: "bet.waba.info", kind: "http", url: "https://bet.waba.info/" },
    { key: "site_disparos", label: "wabadisparos.com.br", kind: "http", url: "https://wabadisparos.com.br/" },
    { key: "app_waba", label: "waba.draxsistemas.com.br", kind: "http", url: "https://waba.draxsistemas.com.br/health" },
];
const parseBoolEnv = (raw) => {
    const value = String(raw ?? "").trim().toLowerCase();
    if (value === "1" || value === "true" || value === "yes")
        return true;
    if (value === "0" || value === "false" || value === "no")
        return false;
    return undefined;
};
const isUptimeMonitorEnabled = () => {
    const explicit = parseBoolEnv(process.env.WABA_UPTIME_MONITOR_ENABLED);
    if (explicit !== undefined)
        return explicit;
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
    if (runtime === "production")
        return true;
    if (wabaEnv === "v01")
        return true;
    return false;
};
exports.isUptimeMonitorEnabled = isUptimeMonitorEnabled;
const isAsaasCheckEnabled = () => parseBoolEnv(process.env.WABA_UPTIME_MONITOR_CHECK_ASAAS) ?? true;
const resolveUptimeIntervalMs = () => {
    const raw = Number(process.env.WABA_UPTIME_MONITOR_INTERVAL_MINUTES ?? DEFAULT_INTERVAL_MINUTES);
    const minutes = Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : DEFAULT_INTERVAL_MINUTES;
    return minutes * 60000;
};
exports.resolveUptimeIntervalMs = resolveUptimeIntervalMs;
const resolveRealertMs = () => {
    const raw = Number(process.env.WABA_UPTIME_MONITOR_REALERT_MINUTES ?? DEFAULT_REALERT_MINUTES);
    const minutes = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : DEFAULT_REALERT_MINUTES;
    return minutes * 60000;
};
const resolveHttpTimeoutMs = () => {
    const raw = Number(process.env.WABA_UPTIME_MONITOR_HTTP_TIMEOUT_MS ?? DEFAULT_HTTP_TIMEOUT_MS);
    return Number.isFinite(raw) && raw >= 3000 ? Math.round(raw) : DEFAULT_HTTP_TIMEOUT_MS;
};
const resolvePrimaryPhone = () => String(process.env.WABA_UPTIME_MONITOR_PRIMARY_PHONE ?? DEFAULT_PRIMARY_PHONE).trim();
const resolveFallbackPhone = () => String(process.env.WABA_UPTIME_MONITOR_FALLBACK_PHONE ?? DEFAULT_FALLBACK_PHONE).trim();
const resolveAlertWhatsapp = () => String(process.env.WABA_UPTIME_MONITOR_ALERT_WHATSAPP ?? DEFAULT_ALERT_WHATSAPP).trim();
const resolveAlertEmail = () => String(process.env.WABA_UPTIME_MONITOR_ALERT_EMAIL ?? DEFAULT_ALERT_EMAIL).trim().toLowerCase();
const resolveUptimeTargets = () => {
    const raw = String(process.env.WABA_UPTIME_MONITOR_TARGETS ?? "").trim();
    const targets = [];
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
            }
            catch {
                // ignora URL inválida
            }
        }
    }
    const httpTargets = targets.length ? targets : DEFAULT_TARGETS;
    if (isAsaasCheckEnabled()) {
        return [
            ...httpTargets,
            { key: "asaas_webhook", label: "Asaas (integração/webhook)", kind: "asaas" },
        ];
    }
    return httpTargets;
};
exports.resolveUptimeTargets = resolveUptimeTargets;
async function checkHttpTarget(target) {
    const url = String(target.url || "").trim();
    if (!url) {
        return { key: target.key, label: target.label, ok: false, detail: "URL não configurada." };
    }
    const timeoutMs = resolveHttpTimeoutMs();
    const attempts = Math.max(1, DEFAULT_HTTP_ATTEMPTS);
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
        }
        catch (error) {
            clearTimeout(timer);
            const message = error instanceof Error && error.name === "AbortError"
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
async function checkAsaasTarget(target) {
    try {
        const report = await (0, asaas_integration_health_service_1.evaluateAsaasIntegrationHealth)();
        if (report.ok) {
            return { key: target.key, label: target.label, ok: true, detail: "integração saudável" };
        }
        const detail = report.issues
            .map((issue) => `${issue.code}: ${issue.message}`)
            .join(" | ")
            .slice(0, 400);
        return { key: target.key, label: target.label, ok: false, detail: detail || "falha na integração" };
    }
    catch (error) {
        return {
            key: target.key,
            label: target.label,
            ok: false,
            detail: error instanceof Error ? error.message : "erro ao avaliar Asaas",
        };
    }
}
async function runChecks(targets) {
    const results = await Promise.all(targets.map((target) => target.kind === "asaas" ? checkAsaasTarget(target) : checkHttpTarget(target)));
    return results;
}
async function readMonitorState() {
    try {
        const raw = await fs_1.promises.readFile(STATE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed?.targets && typeof parsed.targets === "object" ? parsed : { targets: {} };
    }
    catch {
        return { targets: {} };
    }
}
async function writeMonitorState(state) {
    await fs_1.promises.mkdir(path_1.default.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, STATE_FILE);
}
/**
 * Resolve a instância Evolution conectada para envio do alerta.
 * Preferência: telefone primário (51981077770); se não conectado, telefone fallback (51997462102).
 */
async function resolveAlertInstanceName() {
    const primaryPhone = resolvePrimaryPhone();
    const fallbackPhone = resolveFallbackPhone();
    const tryPhone = async (phone) => {
        if (!phone)
            return null;
        const name = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(phone);
        if (!name)
            return null;
        const state = await (0, evo_connection_state_service_1.fetchEvoInstanceLiveState)(name, { fresh: true });
        return (0, evo_connection_state_service_1.isEvoLiveStateOpen)(state) ? name : null;
    };
    const primary = await tryPhone(primaryPhone);
    if (primary) {
        return { instance: primary, connected: true, detail: `instância ${primary} (primária ${primaryPhone})` };
    }
    const fallback = await tryPhone(fallbackPhone);
    if (fallback) {
        return { instance: fallback, connected: true, detail: `instância ${fallback} (fallback ${fallbackPhone})` };
    }
    const lastResort = (await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(primaryPhone)) ||
        (await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(fallbackPhone)) ||
        primaryPhone;
    return {
        instance: lastResort,
        connected: false,
        detail: `nenhuma instância confirmada conectada — tentando ${lastResort}`,
    };
}
const buildWhatsappMessage = (down, recovered) => {
    const lines = [];
    if (down.length) {
        lines.push("🚨 WABA MONITOR — FORA DO AR");
        for (const item of down) {
            lines.push(`• ${item.label}: ${item.detail}`);
        }
    }
    if (recovered.length) {
        if (lines.length)
            lines.push("");
        lines.push("✅ Recuperado:");
        for (const item of recovered) {
            lines.push(`• ${item.label}`);
        }
    }
    lines.push("");
    lines.push(`Verificado: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
    return lines.join("\n");
};
const buildEmailHtml = (down, recovered) => {
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
async function deliverAlerts(down, recovered) {
    const resolved = await resolveAlertInstanceName();
    const whatsapp = await (0, evo_text_alert_client_1.sendEvoTextAlert)({
        instanceName: resolved.instance,
        targetNumber: resolveAlertWhatsapp(),
        text: buildWhatsappMessage(down, recovered),
    });
    let email = { ok: false, detail: "E-mail não tentado." };
    const emailTo = resolveAlertEmail();
    if (!emailTo.includes("@")) {
        email = { ok: false, detail: "E-mail de alerta inválido." };
    }
    else if (!waba_mail_service_1.wabaMailService.isConfigured()) {
        email = { ok: false, detail: "SMTP não configurado." };
    }
    else {
        try {
            const subject = down.length
                ? `URGENTE: WABA — ${down.length} serviço(s) fora do ar`
                : "WABA — serviços recuperados";
            const delivery = await waba_mail_service_1.wabaMailService.send({
                to: emailTo,
                subject,
                html: buildEmailHtml(down, recovered),
                text: buildWhatsappMessage(down, recovered),
            });
            email = { ok: true, detail: delivery.messageId || "E-mail enviado." };
        }
        catch (error) {
            email = { ok: false, detail: error instanceof Error ? error.message : "Falha ao enviar e-mail." };
        }
    }
    console.warn(`[uptime-monitor] alerta enviado via ${resolved.detail} | whatsapp=${whatsapp.ok} email=${email.ok}`);
    if (!whatsapp.ok)
        console.warn("[uptime-monitor] whatsapp falhou:", whatsapp.detail);
    if (!email.ok)
        console.warn("[uptime-monitor] email falhou:", email.detail);
    return {
        instance: { name: resolved.instance, connected: resolved.connected, detail: resolved.detail },
        whatsapp,
        email,
    };
}
async function runUptimeMonitorCheck(input) {
    const targets = (0, exports.resolveUptimeTargets)();
    const results = await runChecks(targets);
    const checkedAt = new Date().toISOString();
    const realertMs = resolveRealertMs();
    const now = Date.now();
    const state = input?.skipState ? { targets: {} } : await readMonitorState();
    const downNow = results.filter((result) => !result.ok);
    const recoveredNow = [];
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
        }
        else {
            const wasDown = previous && previous.status === "down";
            const lastAlertAt = previous?.lastAlertAt ? Date.parse(previous.lastAlertAt) : 0;
            const dueForRealert = wasDown && (now - lastAlertAt >= realertMs);
            if (!wasDown || dueForRealert)
                needAlert = true;
            state.targets[result.key] = {
                status: "down",
                since: wasDown ? previous.since : checkedAt,
                lastCheckedAt: checkedAt,
                lastAlertAt: previous?.lastAlertAt ?? null,
                consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
                lastDetail: result.detail,
            };
        }
    }
    let alertSent = false;
    let alerts;
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
        await writeMonitorState(state);
    }
    if (downNow.length) {
        console.warn(`[uptime-monitor] FALHA — ${downNow.length} alvo(s): ${downNow.map((item) => `${item.label} (${item.detail})`).join("; ")}`);
    }
    else {
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
async function sendUptimeMonitorTestAlert() {
    const down = [
        {
            key: "test",
            label: "Alerta de teste (uptime monitor)",
            ok: false,
            detail: "Teste manual — ignore se foi solicitado.",
        },
    ];
    return deliverAlerts(down, []);
}
async function monitorTick() {
    if (monitorRunning)
        return;
    monitorRunning = true;
    try {
        await runUptimeMonitorCheck();
    }
    catch (error) {
        console.error("[uptime-monitor] tick:", error instanceof Error ? error.message : error);
    }
    finally {
        monitorRunning = false;
    }
}
function startUptimeMonitorScheduler() {
    if (!(0, exports.isUptimeMonitorEnabled)()) {
        console.log("[uptime-monitor] desativado (WABA_UPTIME_MONITOR_ENABLED=false ou ambiente dev).");
        return;
    }
    const intervalMs = (0, exports.resolveUptimeIntervalMs)();
    const targets = (0, exports.resolveUptimeTargets)();
    console.log(`[uptime-monitor] ativo — ${targets.length} alvo(s) a cada ${Math.round(intervalMs / 60000)}min | alerta → WhatsApp ${resolveAlertWhatsapp()} (instância ${resolvePrimaryPhone()}/${resolveFallbackPhone()}) + ${resolveAlertEmail()}`);
    void monitorTick().catch((error) => {
        console.error("[uptime-monitor] bootstrap:", error);
    });
    setInterval(() => {
        void monitorTick();
    }, intervalMs).unref?.();
}
async function getUptimeMonitorStatus() {
    const state = await readMonitorState();
    return {
        enabled: (0, exports.isUptimeMonitorEnabled)(),
        intervalMinutes: Math.round((0, exports.resolveUptimeIntervalMs)() / 60000),
        realertMinutes: Math.round(resolveRealertMs() / 60000),
        targets: (0, exports.resolveUptimeTargets)(),
        alertWhatsapp: resolveAlertWhatsapp(),
        alertEmail: resolveAlertEmail(),
        primaryPhone: resolvePrimaryPhone(),
        fallbackPhone: resolveFallbackPhone(),
        state,
    };
}
