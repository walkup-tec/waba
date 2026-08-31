"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOperacionalSegmentsInput = exports.formatOperacionalSegmentsLabel = exports.resolveOperacionalSegments = exports.OPERACIONAL_SEGMENT_LABELS = void 0;
exports.OPERACIONAL_SEGMENT_LABELS = {
    bets: "Bets",
    outros: "Outros",
};
const normalizeSegment = (value) => {
    const raw = String(value ?? "")
        .trim()
        .toLowerCase();
    if (raw === "todos")
        return "outros";
    if (raw === "bets" || raw === "outros")
        return raw;
    return null;
};
/**
 * Resolve a lista efetiva de segmentos atendidos (array novo ou campo legado singular).
 * Legado `bets` → Bets + Outros (preserva a regra antiga de escalonamento na migração).
 */
const resolveOperacionalSegments = (user) => {
    const fromArray = Array.isArray(user.operacionalSegments)
        ? user.operacionalSegments
            .map((item) => normalizeSegment(item))
            .filter((item) => Boolean(item))
        : [];
    if (fromArray.length > 0) {
        return [...new Set(fromArray)];
    }
    const single = normalizeSegment(user.operacionalSegment);
    if (!single)
        return [];
    if (single === "bets")
        return ["bets", "outros"];
    return [single];
};
exports.resolveOperacionalSegments = resolveOperacionalSegments;
const formatOperacionalSegmentsLabel = (segments) => {
    if (!segments.length)
        return "—";
    return segments.map((segment) => exports.OPERACIONAL_SEGMENT_LABELS[segment]).join(" + ");
};
exports.formatOperacionalSegmentsLabel = formatOperacionalSegmentsLabel;
/**
 * Aceita array, valor único ou lista CSV.
 * Exige ao menos um segmento quando `required`.
 */
const parseOperacionalSegmentsInput = (value, options = {}) => {
    const collected = [];
    const push = (raw) => {
        const parsed = normalizeSegment(raw);
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
        throw new Error("Selecione ao menos um segmento que este operacional atende (Bets e/ou Outros).");
    }
    return collected;
};
exports.parseOperacionalSegmentsInput = parseOperacionalSegmentsInput;
