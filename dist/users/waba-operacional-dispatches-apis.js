"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOperacionalDispatchesApisInput = exports.formatOperacionalDispatchesApisLabel = exports.operacionalServesDispatchesApi = exports.resolveOperacionalDispatchesApis = void 0;
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
/** Resolve a lista efetiva de APIs atendidas (array novo ou campo legado singular). */
const resolveOperacionalDispatchesApis = (user) => {
    const fromArray = Array.isArray(user.operacionalDispatchesApis)
        ? user.operacionalDispatchesApis
            .map((item) => (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(item))
            .filter((item) => Boolean(item))
        : [];
    if (fromArray.length > 0) {
        return [...new Set(fromArray)];
    }
    const single = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(user.operacionalDispatchesApi);
    return single ? [single] : [];
};
exports.resolveOperacionalDispatchesApis = resolveOperacionalDispatchesApis;
const operacionalServesDispatchesApi = (user, apiKind) => (0, exports.resolveOperacionalDispatchesApis)(user).includes(apiKind);
exports.operacionalServesDispatchesApi = operacionalServesDispatchesApi;
const formatOperacionalDispatchesApisLabel = (apis) => {
    if (!apis.length)
        return "—";
    return apis.map((api) => waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[api]).join(" + ");
};
exports.formatOperacionalDispatchesApisLabel = formatOperacionalDispatchesApisLabel;
/**
 * Aceita array, valor único ou lista CSV.
 * Exige ao menos uma API quando `required`.
 */
const parseOperacionalDispatchesApisInput = (value, options = {}) => {
    const collected = [];
    const push = (raw) => {
        const parsed = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(raw);
        if (parsed && !collected.includes(parsed))
            collected.push(parsed);
    };
    if (Array.isArray(value)) {
        for (const item of value)
            push(item);
    }
    else if (typeof value === "string" && value.includes(",")) {
        for (const part of value.split(","))
            push(part);
    }
    else if (value != null && String(value).trim()) {
        push(value);
    }
    if (!collected.length && options.required) {
        throw new Error("Selecione ao menos um tipo de disparos que este operacional atende (API Oficial e/ou API Alternativa).");
    }
    return collected;
};
exports.parseOperacionalDispatchesApisInput = parseOperacionalDispatchesApisInput;
