"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMetaTemplate = logMetaTemplate;
const PREFIX = "[META][TEMPLATE]";
function sanitize(meta) {
    const out = {};
    for (const [key, value] of Object.entries(meta)) {
        if (/secret|token|authorization|access_token|app_secret|verify|encryption/i.test(key))
            continue;
        out[key] = value;
    }
    return out;
}
function logMetaTemplate(step, meta = {}) {
    const line = `${PREFIX}[${step}]`;
    if (step === "ERROR") {
        console.error(line, sanitize(meta));
        return;
    }
    console.info(line, sanitize(meta));
}
