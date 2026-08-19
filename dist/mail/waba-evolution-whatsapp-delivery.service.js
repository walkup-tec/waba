"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWabaEvolutionWhatsApp = exports.DEFAULT_WABA_WHATSAPP_PHONE_HINTS = void 0;
const evo_http_client_1 = require("../evo-http.client");
const evo_api_config_1 = require("../evo-api-config");
const evo_connection_state_service_1 = require("../instances/evo-connection-state.service");
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
const evo_text_alert_client_1 = require("../monitoring/evo-text-alert.client");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
const aquecedor_instance_lifecycle_service_1 = require("../services/aquecedor-instance-lifecycle.service");
const waba_evolution_delivery_ack_1 = require("./waba-evolution-delivery-ack");
const waba_whatsapp_exists_number_1 = require("./waba-whatsapp-exists-number");
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
const resolveWelcomeFirstPassRounds = () => {
    const raw = Number(process.env.WABA_WELCOME_FIRST_PASS_ROUNDS ?? 5);
    if (Number.isFinite(raw) && raw >= 1)
        return Math.min(15, Math.round(raw));
    return 5;
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
const resolveWelcomeBackgroundDelayMs = () => {
    const raw = Number(process.env.WABA_WELCOME_BACKGROUND_RETRY_MS ?? 8000);
    if (Number.isFinite(raw) && raw >= 2000)
        return Math.round(raw);
    return 8000;
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
const resolveEvoApiKey = () => String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const isRecoverableSendFailure = (detail, status) => {
    const text = String(detail || "").toLowerCase();
    if (status === 404 || status === 400)
        return true;
    if (status === 0)
        return true;
    if (status >= 500)
        return true;
    if (text.includes("not found") || text.includes("does not exist"))
        return true;
    if (text.includes("exists") && text.includes("false"))
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
/**
 * Resolve slots por telefone. Nunca filtra por lifecycle do aquecedor
 * (Preparando / pausa humana) — isso vale só para aquecedor/campanhas.
 * Com `allowAnyOpenFallback`, se nenhum hint estiver open, usa qualquer EVO conectada.
 */
const resolveEvoSendSlots = async (phoneHints, opts) => {
    const slots = [];
    const seen = new Set();
    for (const phoneHint of phoneHints) {
        const instanceName = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(phoneHint, {
            verifyLiveIfCatalogClosed: Boolean(opts?.verifyLiveIfCatalogClosed),
        });
        if (!instanceName) {
            console.warn(`[whatsapp] instância ${phoneHint} indisponível (desconectada ou não encontrada).`);
            continue;
        }
        const key = instanceName.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        slots.push({ phoneHint, instanceName });
    }
    if (!slots.length && opts?.allowAnyOpenFallback) {
        try {
            const fallbackName = await (0, waba_push_community_service_1.resolveConnectedEvoOutboundInstance)();
            const key = fallbackName.toLowerCase();
            if (!seen.has(key)) {
                console.warn(`[whatsapp] ${opts.logLabel || "whatsapp"}: hints sem open — fallback qualquer conectada → ${fallbackName}.`);
                slots.push({ phoneHint: "fallback-any-open", instanceName: fallbackName });
            }
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.warn(`[whatsapp] ${opts.logLabel || "whatsapp"}: fallback qualquer conectada indisponível:`, detail.slice(0, 220));
        }
    }
    return slots;
};
/**
 * Boas-vindas: fila completa na ordem, sem trancar no eleito.
 * Ausente/desconectado → próximo. Se a fila inteira falhar → qualquer EVO open.
 */
const resolveWelcomeEvoSendSlots = async (phoneHints, logLabel) => {
    return resolveEvoSendSlots(phoneHints, {
        allowAnyOpenFallback: true,
        verifyLiveIfCatalogClosed: true,
        logLabel,
    });
};
const logCriticalLifecycleBypass = async (instanceName, logLabel) => {
    try {
        const life = await (0, aquecedor_instance_lifecycle_service_1.getAquecedorLifecycleStatusForInstance)(instanceName);
        if (!life)
            return;
        if (life.phase === "preparing" || life.phase === "restricted_wait") {
            console.info(`[whatsapp] ${logLabel}: enviando via ${instanceName} apesar de aquecedor «${life.statusLabel || life.phase}» (boas-vindas/crítico ignora lifecycle).`);
        }
    }
    catch {
        /* ignore — lifecycle não pode bloquear envio crítico */
    }
};
const resolveCanonicalDestinationNumber = async (instanceName, rawNumber) => {
    const variants = (0, evo_instance_phone_service_1.expandBrazilWhatsAppNumberVariants)(rawNumber);
    if (!variants.length)
        return "";
    const url = `${(0, evo_api_config_1.resolvePrimaryEvoApiBase)()}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`;
    try {
        const result = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(url, "POST", {
            apiKey: resolveEvoApiKey(),
            body: { numbers: variants },
            timeoutMs: 12000,
            retries: 1,
        });
        const items = Array.isArray(result.json) ? result.json : [];
        return (0, waba_whatsapp_exists_number_1.pickCanonicalWhatsAppNumberFromExistsCheck)(items);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[whatsapp] whatsappNumbers falhou em ${instanceName}:`, message.slice(0, 180));
        return "";
    }
};
const trySendViaSlot = async (input) => {
    const { slot, targetWhatsapp, text, recipientLabel, timeoutMs } = input;
    const liveState = await (0, evo_connection_state_service_1.fetchEvoInstanceLiveState)(slot.instanceName, { fresh: true });
    if (shouldSkipInstanceForSend(liveState)) {
        console.warn(`[whatsapp] ${slot.instanceName} (${slot.phoneHint}) ignorada — connectionState=${liveState || "?"}.`);
        return { result: null };
    }
    if (input.ignoreAquecedorLifecycle) {
        await logCriticalLifecycleBypass(slot.instanceName, input.logLabel || "whatsapp");
    }
    const canonical = input.ignoreAquecedorLifecycle
        ? await resolveCanonicalDestinationNumber(slot.instanceName, targetWhatsapp)
        : "";
    const destinations = input.ignoreAquecedorLifecycle
        ? (0, waba_whatsapp_exists_number_1.welcomeDestinationCandidates)(targetWhatsapp, canonical).slice(0, 2)
        : [targetWhatsapp];
    for (const destination of destinations) {
        const result = await (0, evo_text_alert_client_1.sendEvoTextAlert)({
            instanceName: slot.instanceName,
            targetNumber: destination,
            text,
            timeoutMs,
            retries: 2,
        });
        if (!result.ok) {
            const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
            console.warn(`[whatsapp] tentativa falhou (${slot.instanceName} / ${slot.phoneHint}) para ${destination} (${recipientLabel}):`, detail);
            if (!isRecoverableSendFailure(detail, result.status)) {
                return {
                    result: {
                        status: "failed",
                        message: `${slot.instanceName}: ${detail}`,
                        instanceName: slot.instanceName,
                    },
                };
            }
            continue;
        }
        const ack = await (0, waba_evolution_delivery_ack_1.waitForEvoOutboundDeliveryAck)({
            instanceName: slot.instanceName,
            targetNumber: destination,
            messageId: result.messageId,
            remoteJid: result.remoteJid,
        });
        if (ack.outcome === "delivered") {
            console.log(`[whatsapp] entregue no aparelho para ${destination} (${recipientLabel}) via ${slot.instanceName} (${slot.phoneHint}) ack=${ack.status}.`);
            return {
                result: { status: "sent", message: "WhatsApp enviado.", instanceName: slot.instanceName },
            };
        }
        console.warn(`[whatsapp] sendText OK mas não entregue (${slot.instanceName} / ${slot.phoneHint}) para ${destination} (${recipientLabel}): ack=${ack.status}. Tentando próximo da fila.`);
    }
    return { result: null };
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
    const ignoreAquecedorLifecycle = Boolean(input.ignoreAquecedorLifecycle);
    const maxRounds = Math.max(1, options.maxRounds);
    const roundDelayMs = ignoreAquecedorLifecycle
        ? resolveWelcomeBackgroundDelayMs()
        : resolveWabaWhatsAppRoundDelayMs();
    const timeoutMs = resolveWabaWhatsAppSendTimeoutMs();
    const errors = [];
    for (let round = 1; round <= maxRounds; round += 1) {
        const slots = ignoreAquecedorLifecycle
            ? await resolveWelcomeEvoSendSlots(phoneHints, logLabel)
            : await resolveEvoSendSlots(phoneHints, {
                allowAnyOpenFallback: false,
                verifyLiveIfCatalogClosed: false,
                logLabel,
            });
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
            const sendOutcome = await trySendViaSlot({
                slot,
                targetWhatsapp: whatsapp,
                text,
                recipientLabel,
                timeoutMs,
                logLabel,
                ignoreAquecedorLifecycle,
            });
            const outcome = sendOutcome.result;
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
const resolveBackgroundRetryMaxAttempts = (critical) => {
    if (critical) {
        const raw = Number(process.env.WABA_WELCOME_BACKGROUND_RETRY_MAX ?? 40);
        if (Number.isFinite(raw) && raw >= 1)
            return Math.min(80, Math.round(raw));
        return 40;
    }
    const raw = Number(process.env.WABA_WHATSAPP_BACKGROUND_RETRY_MAX ?? 12);
    if (Number.isFinite(raw) && raw >= 1)
        return Math.min(40, Math.round(raw));
    return 12;
};
const scheduleBackgroundRetry = (input) => {
    const key = String(input.backgroundRetryKey || "").trim();
    if (!key || backgroundRetries.has(key))
        return;
    const critical = Boolean(input.ignoreAquecedorLifecycle);
    const roundDelayMs = critical ? resolveWelcomeBackgroundDelayMs() : resolveWabaWhatsAppRoundDelayMs();
    const maxAttempts = resolveBackgroundRetryMaxAttempts(critical);
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
        if (attempts >= maxAttempts) {
            clearTimeout(pending.timer);
            backgroundRetries.delete(key);
            console.error(`[whatsapp] ${input.logLabel}: retry em background esgotado após ${attempts} tentativa(s) (${key}).`);
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
    const maxRounds = input.ignoreAquecedorLifecycle
        ? resolveWelcomeFirstPassRounds()
        : resolveWabaWhatsAppMaxRounds();
    const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds });
    if (result.status !== "sent" && input.backgroundRetryKey) {
        scheduleBackgroundRetry(input);
    }
    return result;
};
exports.deliverWabaEvolutionWhatsApp = deliverWabaEvolutionWhatsApp;
