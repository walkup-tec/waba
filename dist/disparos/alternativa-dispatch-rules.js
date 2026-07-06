"use strict";
/** Regras do motor de envio API Alternativa (números da fazenda). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = exports.DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES = exports.ALTERNATIVA_MIN_PURCHASE_QUANTITY = exports.ALTERNATIVA_MIN_PURCHASED_FOR_PICKER = exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND = void 0;
exports.getAlternativaDispatchRulesMeta = getAlternativaDispatchRulesMeta;
exports.computeAlternativaThrottle = computeAlternativaThrottle;
exports.estimateAlternativaCampaignCompletionAt = estimateAlternativaCampaignCompletionAt;
exports.buildAlternativaCapacityLabel = buildAlternativaCapacityLabel;
exports.estimateAlternativaCampaignDuration = estimateAlternativaCampaignDuration;
exports.assertAlternativaMinActivated = assertAlternativaMinActivated;
exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND = 3;
exports.ALTERNATIVA_MIN_PURCHASED_FOR_PICKER = 4;
exports.ALTERNATIVA_MIN_PURCHASE_QUANTITY = 4;
exports.DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES = 4;
exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 300;
const DEFAULT_WORKING_DAY_KEYS = ["seg", "ter", "qua", "qui", "sex"];
const WEEKDAY_KEY_TO_JS = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sab: 6,
};
function getAlternativaDispatchRulesMeta() {
    return {
        minActivatedForSend: exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND,
        minPurchasedForPicker: exports.ALTERNATIVA_MIN_PURCHASED_FOR_PICKER,
        minPurchaseQuantity: exports.ALTERNATIVA_MIN_PURCHASE_QUANTITY,
        minConnectedForCampaign: exports.DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES,
        maxSendsPerDayPerNumber: exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER,
    };
}
/** Calcula delay e limites para respeitar até 300 envios/dia por número na janela de expediente. */
function computeAlternativaThrottle(input) {
    const startHour = Math.max(0, Math.min(23, Math.floor(Number(input.startHour) || 8)));
    const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(input.endHour) || 22)));
    const hoursPerWindow = endHour - startHour;
    const maxPerDay = exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
    const maxPerHour = Math.max(1, Math.ceil(maxPerDay / hoursPerWindow));
    const avgIntervalSec = Math.max(60, Math.floor((hoursPerWindow * 3600) / maxPerDay));
    const delayMin = Math.max(10, avgIntervalSec - 24);
    const delayMax = Math.min(3600, avgIntervalSec + 24);
    return {
        delayMinSeconds: delayMin,
        delayMaxSeconds: Math.max(delayMin, delayMax),
        maxPerHourPerInstance: maxPerHour,
        maxPerDayPerInstance: maxPerDay,
    };
}
function formatQty(n) {
    return new Intl.NumberFormat("pt-BR").format(n);
}
function formatCompletionBr(date) {
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function normalizeWorkingDayJsSet(keys) {
    const src = Array.isArray(keys) && keys.length ? keys : DEFAULT_WORKING_DAY_KEYS;
    const allowed = new Set();
    src.forEach((key) => {
        const day = WEEKDAY_KEY_TO_JS[String(key || "").trim().toLowerCase()];
        if (Number.isFinite(day))
            allowed.add(day);
    });
    if (!allowed.size) {
        DEFAULT_WORKING_DAY_KEYS.forEach((key) => {
            const day = WEEKDAY_KEY_TO_JS[key];
            if (Number.isFinite(day))
                allowed.add(day);
        });
    }
    return allowed;
}
function cloneAtHour(base, hour) {
    const d = new Date(base);
    d.setHours(hour, 0, 0, 0);
    return d;
}
function isWorkingDay(date, allowed) {
    return allowed.has(date.getDay());
}
/** Distribui envios ao longo das janelas de expediente (throughput real, não só dias inteiros). */
function estimateAlternativaCampaignCompletionAt(params) {
    const plannedSendCount = Math.max(0, Math.floor(Number(params.plannedSendCount) || 0));
    const activatedInstanceCount = Math.max(0, Math.floor(Number(params.activatedInstanceCount) || 0));
    if (!plannedSendCount || !activatedInstanceCount)
        return null;
    const startHour = Math.max(0, Math.min(23, Math.floor(Number(params.startHour) || 8)));
    const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(params.endHour) || 22)));
    const hoursPerWindow = endHour - startHour;
    const sendsPerDay = activatedInstanceCount * exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
    const sendsPerHour = sendsPerDay / hoursPerWindow;
    if (!Number.isFinite(sendsPerHour) || sendsPerHour <= 0)
        return null;
    const allowed = normalizeWorkingDayJsSet(params.workingDayKeys);
    const now = params.now instanceof Date ? new Date(params.now) : new Date();
    let remainingHours = plannedSendCount / sendsPerHour;
    let cursor = new Date(now);
    let guard = 0;
    while (remainingHours > 0.001 && guard < 500) {
        guard += 1;
        if (!isWorkingDay(cursor, allowed)) {
            cursor.setDate(cursor.getDate() + 1);
            cursor = cloneAtHour(cursor, startHour);
            continue;
        }
        const windowStart = cloneAtHour(cursor, startHour);
        const windowEnd = cloneAtHour(cursor, endHour);
        if (cursor < windowStart) {
            cursor = windowStart;
        }
        if (cursor >= windowEnd) {
            cursor.setDate(cursor.getDate() + 1);
            cursor = cloneAtHour(cursor, startHour);
            continue;
        }
        const availableHours = (windowEnd.getTime() - cursor.getTime()) / 3600000;
        if (remainingHours <= availableHours) {
            return new Date(cursor.getTime() + remainingHours * 3600000);
        }
        remainingHours -= availableHours;
        cursor.setDate(cursor.getDate() + 1);
        cursor = cloneAtHour(cursor, startHour);
    }
    return cursor;
}
function buildAlternativaCapacityLabel(sendsPerDay, activatedInstanceCount) {
    return `Sua capacidade de envio hoje é de ${formatQty(sendsPerDay)} envios/dia, considerando ${activatedInstanceCount} número(s).`;
}
function estimateAlternativaCampaignDuration(params) {
    const plannedSendCount = Math.max(0, Math.floor(Number(params.plannedSendCount) || 0));
    const activatedInstanceCount = Math.max(0, Math.floor(Number(params.activatedInstanceCount) || 0));
    const workingDaysPerWeek = Math.max(1, Math.min(7, Math.floor(Number(params.workingDaysPerWeek) || 5)));
    const startHour = Math.max(0, Math.min(23, Math.floor(Number(params.startHour) || 8)));
    const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(params.endHour) || 22)));
    const hoursPerWindow = endHour - startHour;
    if (!plannedSendCount) {
        return {
            plannedSendCount,
            activatedInstanceCount,
            sendsPerDay: 0,
            workingDaysNeeded: 0,
            calendarDaysEstimate: 0,
            hoursPerWindow,
            summaryLabel: "Informe a quantidade de envios para ver a projeção.",
            capacityLabel: "Informe a quantidade de envios para ver a projeção.",
            estimatedCompletionBr: "",
        };
    }
    if (!activatedInstanceCount) {
        const missing = `Ative ao menos ${exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND} números para calcular a projeção.`;
        return {
            plannedSendCount,
            activatedInstanceCount,
            sendsPerDay: 0,
            workingDaysNeeded: 0,
            calendarDaysEstimate: 0,
            hoursPerWindow,
            summaryLabel: missing,
            capacityLabel: missing,
            estimatedCompletionBr: "",
        };
    }
    const sendsPerDay = activatedInstanceCount * exports.ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
    const workingDaysNeeded = Math.max(1, Math.ceil(plannedSendCount / sendsPerDay));
    const calendarDaysEstimate = Math.max(workingDaysNeeded, Math.ceil((workingDaysNeeded / workingDaysPerWeek) * 7));
    const capacityLabel = buildAlternativaCapacityLabel(sendsPerDay, activatedInstanceCount);
    const completionAt = estimateAlternativaCampaignCompletionAt({
        plannedSendCount,
        activatedInstanceCount,
        startHour,
        endHour,
        workingDayKeys: params.workingDayKeys,
        now: params.now,
    });
    const estimatedCompletionBr = completionAt ? formatCompletionBr(completionAt) : "";
    return {
        plannedSendCount,
        activatedInstanceCount,
        sendsPerDay,
        workingDaysNeeded,
        calendarDaysEstimate,
        hoursPerWindow,
        summaryLabel: capacityLabel,
        capacityLabel,
        estimatedCompletionBr,
    };
}
function assertAlternativaMinActivated(activatedCount) {
    if (activatedCount < exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND) {
        throw new Error(`Para disparos pela API Alternativa são necessários ao menos ${exports.ALTERNATIVA_MIN_ACTIVATED_FOR_SEND} números ativados. Você possui ${activatedCount}. Ative mais números em «Comprar números».`);
    }
}
