"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callMetaGraphJson = callMetaGraphJson;
const node_crypto_1 = require("node:crypto");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_graph_errors_1 = require("./meta-whatsapp-graph-errors");
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
function readGraphCode(json) {
    const err = json?.error;
    const code = err?.code;
    return code === undefined || code === null ? null : String(code);
}
function withProof(endpoint, token) {
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    if (!appSecret)
        return endpoint;
    const proof = (0, node_crypto_1.createHmac)("sha256", appSecret).update(token).digest("hex");
    return `${endpoint}${endpoint.includes("?") ? "&" : "?"}appsecret_proof=${proof}`;
}
async function callMetaGraphJson(input) {
    const token = String(input.token || "").trim();
    const path = String(input.path || "").trim().replace(/^\/+/, "");
    if (!token)
        throw new Error("Token da Meta não informado.");
    if (!path)
        throw new Error("Path da API da Meta não informado.");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input.query || {})) {
        if (value)
            params.set(key, value);
    }
    const qs = params.toString();
    const endpoint = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${path}${qs ? `?${qs}` : ""}`;
    const url = withProof(endpoint, token);
    const fetchFn = input.fetchImpl || fetch;
    let last = {
        ok: false,
        status: 0,
        json: null,
        body: "",
        timeout: false,
        kind: "transient",
        graphCode: null,
        attempts: 0,
    };
    for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetchFn(url, {
                method: input.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(input.body ? { "Content-Type": "application/json" } : {}),
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
            const graphCode = readGraphCode(json);
            const kind = (0, meta_whatsapp_graph_errors_1.classifyMetaGraphError)({ status: response.status, graphCode });
            last = {
                ok: response.ok,
                status: response.status,
                json,
                body: text,
                timeout: false,
                kind,
                graphCode,
                attempts: attempt,
            };
            if (response.ok)
                return last;
            // Rate limit (4/17/341): backoff curto só piora a cota — não retry imediato.
            if (kind === "permanent" || (0, meta_whatsapp_graph_errors_1.isMetaGraphRateLimitCode)(graphCode) || attempt >= 3)
                return last;
            await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
        }
        catch (error) {
            const timeout = String(error?.name || "") === "AbortError";
            last = {
                ok: false,
                status: 0,
                json: null,
                body: "",
                timeout: timeout,
                kind: "transient",
                graphCode: null,
                attempts: attempt,
            };
            if (attempt >= 3)
                return last;
            await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    return last;
}
