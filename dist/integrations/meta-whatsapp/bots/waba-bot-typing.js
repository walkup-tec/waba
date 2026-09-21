"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBotTypingWaitForTests = setBotTypingWaitForTests;
exports.botTypingDelayMs = botTypingDelayMs;
exports.waitBotTyping = waitBotTyping;
let waitImpl = (ms) => ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
function setBotTypingWaitForTests(fn) {
    waitImpl = fn || ((ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()));
}
/** Tempo dos 3 pontinhos antes do envio. Mídia/link ficam um pouco mais. */
function botTypingDelayMs(input = {}) {
    const type = String(input.type || "text").trim().toLowerCase();
    if (type === "video" || type === "document" || type === "audio" || type === "cta_url") {
        return 1800;
    }
    const len = String(input.text || "").trim().length;
    return Math.max(1200, Math.min(4000, 900 + len * 35));
}
async function waitBotTyping(ms) {
    await waitImpl(Math.max(0, Math.floor(Number(ms) || 0)));
}
