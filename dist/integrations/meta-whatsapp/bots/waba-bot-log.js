"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWabaBot = logWabaBot;
function logWabaBot(event, data) {
    const safe = {};
    for (const [key, value] of Object.entries(data)) {
        const k = key.toLowerCase();
        if (k.includes("token") || k.includes("secret") || k.includes("password") || k.includes("authorization")) {
            continue;
        }
        if (value === undefined)
            continue;
        safe[key] = value;
    }
    console.info(`[waba-bot] ${event}`, safe);
}
