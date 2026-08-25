"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMetaWebhook = logMetaWebhook;
const PREFIX = "[META][WEBHOOK]";
function sanitizeMeta(meta) {
    const out = {};
    for (const [key, value] of Object.entries(meta)) {
        if (/secret|token|authorization|access_token|app_secret|verify/i.test(key))
            continue;
        if (/body|payload|text|message_body|content/i.test(key))
            continue;
        out[key] = value;
    }
    return out;
}
function logMetaWebhook(step, meta = {}) {
    const line = `${PREFIX}[${step}]`;
    if (step === "ERROR") {
        console.error(line, sanitizeMeta(meta));
        return;
    }
    console.info(line, sanitizeMeta(meta));
}
