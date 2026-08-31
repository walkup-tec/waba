"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callMetaGraphForWebhook = callMetaGraphForWebhook;
const node_crypto_1 = require("node:crypto");
const meta_config_1 = require("./meta-config");
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Cliente Graph mínimo para inscrição de webhook.
 * Mesmo contrato de timeout/retry do helper existente em src/index.ts (não extraído de lá).
 */
async function callMetaGraphForWebhook(input) {
    const token = String(input.token || "").trim();
    const path = String(input.path || "").trim().replace(/^\/+/, "");
    if (!token)
        throw new Error("Token da Meta não informado.");
    if (!path)
        throw new Error("Path da API da Meta não informado.");
    const endpoint = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${path}`;
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    const proof = appSecret
        ? (0, node_crypto_1.createHmac)("sha256", appSecret).update(token).digest("hex")
        : "";
    const url = proof ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}appsecret_proof=${proof}` : endpoint;
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(url, {
                method: input.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: input.body ? JSON.stringify(input.body) : undefined,
                signal: controller.signal,
            });
            const text = await response.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                json = null;
            }
            if (response.ok) {
                return { ok: true, status: response.status, json, body: text };
            }
            lastStatus = response.status;
            lastBody = text;
            const transient = response.status === 429 || response.status >= 500;
            if (!transient || attempt >= 3) {
                return { ok: false, status: response.status, json, body: text };
            }
            await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    return { ok: false, status: lastStatus, json: null, body: lastBody };
}
