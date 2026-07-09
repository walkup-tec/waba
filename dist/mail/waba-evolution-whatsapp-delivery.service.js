"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWabaEvolutionWhatsApp = exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS = void 0;
const evo_http_client_1 = require("../evo-http.client");
const evo_connection_state_service_1 = require("../instances/evo-connection-state.service");
const evo_text_alert_client_1 = require("../monitoring/evo-text-alert.client");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
/** Sequência padrão Evolution para todos os envios WhatsApp do WABA. */
exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS = ["51981077770", "51997462102", "51981082477"];
const resolveWabaWhatsAppPhoneHints = () => {
    const hints = [
        String(process.env.WABA_WHATSAPP_PRIMARY_PHONE ||
            process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE ||
            process.env.WABA_WELCOME_WHATSAPP_PRIMARY_PHONE ||
            exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS[0]).trim(),
        String(process.env.WABA_WHATSAPP_SECONDARY_PHONE ||
            process.env.WABA_WHATSAPP_FALLBACK_PHONE ||
            process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE ||
            process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SECONDARY_PHONE ||
            process.env.WABA_WELCOME_WHATSAPP_FALLBACK_PHONE ||
            exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS[1]).trim(),
        String(process.env.WABA_WHATSAPP_TERTIARY_PHONE ||
            process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_TERTIARY_PHONE ||
            exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS[2]).trim(),
    ];
    const seen = new Set();
    const out = [];
    for (const hint of hints) {
        const digits = hint.replace(/\D/g, "");
        if (!digits || seen.has(digits))
            continue;
        seen.add(digits);
        out.push(digits);
    }
    return out;
};
const resolveWabaWhatsAppMaxRounds = () => {
    const raw = process.env.WABA_WHATSAPP_MAX_ROUNDS || process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_MAX_ROUNDS;
    if (raw !== undefined && String(raw).trim() !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 1)
            return Math.min(30, Math.round(n));
    }
    return 15;
};
const resolveWabaWhatsAppRoundDelayMs = () => {
    const raw = process.env.WABA_WHATSAPP_ROUND_DELAY_MS ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_ROUND_DELAY_MS;
    if (raw !== undefined && String(raw).trim() !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 500)
            return Math.round(n);
    }
    return 2500;
};
const resolveWabaWhatsAppSendTimeoutMs = () => {
    const raw = process.env.WABA_WHATSAPP_SEND_TIMEOUT_MS ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SEND_TIMEOUT_MS ||
        process.env.WABA_WELCOME_WHATSAPP_SEND_TIMEOUT_MS;
    if (raw !== undefined && String(raw).trim() !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 12000)
            return Math.round(n);
    }
    return (0, evo_http_client_1.defaultEvoSendTextTimeoutMs)();
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const isRecoverableSendFailure = (detail, status) => {
    const text = String(detail || "").toLowerCase();
    if (status === 404)
        return true;
    if (status === 0)
        return true;
    if (status >= 500)
        return true;
    if (text.includes("not found") || text.includes("does not exist"))
        return true;
    if (text.includes("instance") && text.includes("exist"))
        return true;
    if (text.includes("disconnected") || text.includes("not connected"))
        return true;
    if (text.includes("integrationsession") || text.includes("internal server error"))
        return true;
    if (text.includes("socket hang up") || text.includes("econnreset") || text.includes("timeout")) {
        return true;
    }
    if (text.includes("network") || text.includes("fetch failed"))
        return true;
    return false;
};
const shouldSkipInstanceForSend = (liveState) => {
    const state = String(liveState || "").trim().toLowerCase();
    if (!state)
        return false;
    if ((0, evo_connection_state_service_1.isEvoLiveStateOpen)(state))
        return false;
    return state === "close" || state === "closed" || state === "disconnected";
};
const resolveEvoSendSlots = async (phoneHints) => {
    const slots = [];
    for (const phoneHint of phoneHints) {
        const instanceName = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(phoneHint);
        if (!instanceName) {
            console.warn(`[whatsapp] instância ${phoneHint} indisponível (desconectada ou não encontrada).`);
            continue;
        }
        slots.push({ phoneHint, instanceName });
    }
    return slots;
};
const trySendViaSlot = async (input) => {
    const { slot, targetWhatsapp, text, recipientLabel, timeoutMs } = input;
    const liveState = await (0, evo_connection_state_service_1.fetchEvoInstanceLiveState)(slot.instanceName, { fresh: true });
    if (shouldSkipInstanceForSend(liveState)) {
        console.warn(`[whatsapp] ${slot.instanceName} (${slot.phoneHint}) ignorada — connectionState=${liveState || "?"}.`);
        return null;
    }
    const result = await (0, evo_text_alert_client_1.sendEvoTextAlert)({
        instanceName: slot.instanceName,
        targetNumber: targetWhatsapp,
        text,
        timeoutMs,
        retries: 2,
    });
    if (result.ok) {
        console.log(`[whatsapp] enviado para ${targetWhatsapp} (${recipientLabel}) via ${slot.instanceName} (${slot.phoneHint}).`);
        return { status: "sent", message: "WhatsApp enviado.", instanceName: slot.instanceName };
    }
    const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
    console.warn(`[whatsapp] tentativa falhou (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${recipientLabel}):`, detail);
    if (!isRecoverableSendFailure(detail, result.status)) {
        return {
            status: "failed",
            message: `${slot.instanceName}: ${detail}`,
            instanceName: slot.instanceName,
        };
    }
    return null;
};
const backgroundRetries = new Map();
const runWabaEvolutionWhatsAppDelivery = async (input, options) => {
    const whatsapp = String(input.targetWhatsapp || "").replace(/\D/g, "");
    const recipientLabel = String(input.recipientEmail || input.logLabel || "destinatário")
        .trim()
        .toLowerCase();
    const logLabel = String(input.logLabel || "whatsapp").trim();
    if (!whatsapp || whatsapp.length < 10) {
        return {
            status: "skipped",
            message: `${logLabel} WhatsApp ${recipientLabel}: número inválido.`,
        };
    }
    const text = String(input.text || "").trim();
    if (!text) {
        return { status: "skipped", message: `${logLabel}: mensagem vazia.` };
    }
    const phoneHints = resolveWabaWhatsAppPhoneHints();
    const maxRounds = Math.max(1, options.maxRounds);
    const roundDelayMs = resolveWabaWhatsAppRoundDelayMs();
    const timeoutMs = resolveWabaWhatsAppSendTimeoutMs();
    const errors = [];
    for (let round = 1; round <= maxRounds; round += 1) {
        const slots = await resolveEvoSendSlots(phoneHints);
        if (!slots.length) {
            const msg = `rodada ${round}/${maxRounds}: nenhuma instância conectada (${phoneHints.join(" → ")}).`;
            errors.push(msg);
            console.warn(`[whatsapp] ${logLabel}: ${msg}`);
            if (round < maxRounds)
                await sleep(roundDelayMs);
            continue;
        }
        if (round === 1) {
            console.info(`[whatsapp] ${logLabel}: sequência ${slots.map((s) => `${s.phoneHint}→${s.instanceName}`).join(", ")}.`);
        }
        else {
            console.info(`[whatsapp] ${logLabel}: repetindo sequência (rodada ${round}/${maxRounds}).`);
        }
        for (const slot of slots) {
            const outcome = await trySendViaSlot({
                slot,
                targetWhatsapp: whatsapp,
                text,
                recipientLabel,
                timeoutMs,
            });
            if (outcome?.status === "sent")
                return outcome;
            if (outcome?.status === "failed")
                errors.push(outcome.message);
        }
        if (round < maxRounds)
            await sleep(roundDelayMs);
    }
    const message = errors.filter(Boolean).join(" | ") ||
        `${logLabel} WhatsApp ${recipientLabel}: falha após ${maxRounds} rodada(s) na sequência ${phoneHints.join(" → ")}.`;
    console.error(`[whatsapp] ${logLabel} falhou para ${whatsapp} (${recipientLabel}):`, message);
    return { status: "failed", message };
};
const scheduleBackgroundRetry = (input) => {
    const key = String(input.backgroundRetryKey || "").trim();
    if (!key || backgroundRetries.has(key))
        return;
    const roundDelayMs = resolveWabaWhatsAppRoundDelayMs();
    let attempts = 0;
    const tick = async () => {
        const pending = backgroundRetries.get(key);
        if (!pending)
            return;
        attempts += 1;
        console.info(`[whatsapp] ${input.logLabel}: retry em background #${attempts} (${key}).`);
        const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds: 1 });
        if (result.status === "sent") {
            clearTimeout(pending.timer);
            backgroundRetries.delete(key);
            console.log(`[whatsapp] ${input.logLabel}: retry em background OK (${key}).`);
            return;
        }
        const nextTimer = setTimeout(() => {
            void tick();
        }, roundDelayMs);
        backgroundRetries.set(key, { timer: nextTimer, attempts });
    };
    const initialTimer = setTimeout(() => {
        void tick();
    }, roundDelayMs);
    backgroundRetries.set(key, { timer: initialTimer, attempts: 0 });
    console.warn(`[whatsapp] ${input.logLabel}: retry em background até sucesso (${key}).`);
};
const deliverWabaEvolutionWhatsApp = async (input) => {
    const maxRounds = resolveWabaWhatsAppMaxRounds();
    const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds });
    if (result.status !== "sent" && input.backgroundRetryKey) {
        scheduleBackgroundRetry(input);
    }
    return result;
};
exports.deliverWabaEvolutionWhatsApp = deliverWabaEvolutionWhatsApp;
