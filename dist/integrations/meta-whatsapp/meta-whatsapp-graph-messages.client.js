"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postMetaCloudMessage = postMetaCloudMessage;
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
function readWamid(json) {
    const messages = json?.messages;
    const id = messages && messages[0] ? String(messages[0].id || "").trim() : "";
    return id || null;
}
async function postMetaCloudMessage(input) {
    const token = String(input.token || "").trim();
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    if (!token)
        throw new Error("Token da Meta não informado.");
    if (!phoneNumberId)
        throw new Error("phone_number_id ausente.");
    const endpoint = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${phoneNumberId}/messages`;
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    const proof = appSecret ? (0, node_crypto_1.createHmac)("sha256", appSecret).update(token).digest("hex") : "";
    const url = proof ? `${endpoint}?appsecret_proof=${proof}` : endpoint;
    const fetchFn = input.fetchImpl || fetch;
    let last = {
        ok: false,
        status: 0,
        json: null,
        body: "",
        timeout: false,
        kind: "transient",
        graphCode: null,
        wamid: null,
        attempts: 0,
    };
    for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let timeout = false;
        try {
            const response = await fetchFn(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(input.body),
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
            const kind = (0, meta_whatsapp_graph_errors_1.classifyMetaGraphError)({
                status: response.status,
                graphCode,
            });
            last = {
                ok: response.ok,
                status: response.status,
                json,
                body: text,
                timeout: false,
                kind,
                graphCode,
                wamid: readWamid(json),
                attempts: attempt,
            };
            if (response.ok)
                return last;
            if (kind === "permanent" || attempt >= 3)
                return last;
            await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
        }
        catch (error) {
            timeout = String(error?.name || "") === "AbortError";
            last = {
                ok: false,
                status: 0,
                json: null,
                body: "",
                timeout: timeout,
                kind: "transient",
                graphCode: null,
                wamid: null,
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
