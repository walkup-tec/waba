"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAutomationText = normalizeAutomationText;
exports.keywordMatches = keywordMatches;
exports.exactTextMatches = exactTextMatches;
/**
 * Normalização básica para KEYWORD / EXACT_TEXT.
 * Sem regex do frontend: matching literal após trim, case-insensitive e sem acento.
 */
function normalizeAutomationText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
function keywordMatches(messageText, triggerValue) {
    const haystack = normalizeAutomationText(messageText);
    const raw = String(triggerValue || "");
    if (!haystack || !raw.trim())
        return false;
    const needles = raw
        .split(",")
        .map((part) => normalizeAutomationText(part))
        .filter(Boolean);
    return needles.some((needle) => haystack.includes(needle));
}
function exactTextMatches(messageText, triggerValue) {
    const left = normalizeAutomationText(messageText);
    const right = normalizeAutomationText(triggerValue);
    return Boolean(left) && left === right;
}
