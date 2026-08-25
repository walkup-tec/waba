"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMetaInbox = logMetaInbox;
const PREFIX = "[META][INBOX]";
function sanitize(meta) {
    const out = {};
    for (const [key, value] of Object.entries(meta)) {
        if (/secret|token|authorization|access_token|app_secret|verify|encryption/i.test(key))
            continue;
        out[key] = value;
    }
    return out;
}
function logMetaInbox(step, meta = {}) {
    const line = `${PREFIX}[${step}]`;
    if (step === "ERROR") {
        console.error(line, sanitize(meta));
        return;
    }
    console.info(line, sanitize(meta));
}
