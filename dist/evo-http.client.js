"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeEvoApiBaseForOps = exports.isEvoTlsInsecure = exports.defaultEvoSendTextTimeoutMs = exports.defaultEvoHttpTimeoutMs = void 0;
exports.evoHttpRequest = evoHttpRequest;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultEvoHttpTimeoutMs = () => {
    const raw = Number(process.env.EVO_HTTP_TIMEOUT_MS ?? 45000);
    return Number.isFinite(raw) && raw >= 5000 ? Math.round(raw) : 45000;
};
exports.defaultEvoHttpTimeoutMs = defaultEvoHttpTimeoutMs;
/** sendText na Evolution costuma demorar mais que fetchInstances / connectionState. */
const defaultEvoSendTextTimeoutMs = () => {
    const raw = Number(process.env.EVO_SEND_TEXT_TIMEOUT_MS ??
        process.env.EVO_HTTP_TIMEOUT_MS ??
        90000);
    return Number.isFinite(raw) && raw >= 10000 ? Math.round(raw) : 90000;
};
exports.defaultEvoSendTextTimeoutMs = defaultEvoSendTextTimeoutMs;
const parseJson = (text) => {
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
};
const isEvoTlsInsecure = () => {
    const flag = String(process.env.EVO_TLS_INSECURE ?? "").trim().toLowerCase();
    if (flag === "1" || flag === "true" || flag === "yes")
        return true;
    if (flag === "0" || flag === "false" || flag === "no")
        return false;
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    const base = String(process.env.EVO_API_URL ?? "").trim().toLowerCase();
    if (runtime === "development" && base.startsWith("https://"))
        return true;
    // Easypanel Evolution publica HTTPS com certificado autoassinado/intermediário.
    if (base.startsWith("https://") && /\.easypanel\.host(\/|$)/i.test(base))
        return true;
    return false;
};
exports.isEvoTlsInsecure = isEvoTlsInsecure;
const describeEvoApiBaseForOps = (rawUrl) => {
    try {
        const parsed = new URL(String(rawUrl || "").trim() || "http://invalid.local");
        return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
    }
    catch {
        return String(rawUrl || "").trim() || "(invalid)";
    }
};
exports.describeEvoApiBaseForOps = describeEvoApiBaseForOps;
const shouldRetryEvoRequest = (result) => {
    if (result.ok)
        return false;
    if (result.status === 0)
        return true;
    if (result.status >= 500)
        return true;
    return false;
};
function evoHttpRequestOnce(url, method, options) {
    const timeoutMs = Math.max(5000, Math.round(Number(options.timeoutMs ?? (0, exports.defaultEvoHttpTimeoutMs)())));
    const bodyText = options.body && Object.keys(options.body).length > 0
        ? JSON.stringify(options.body)
        : "";
    return new Promise((resolve) => {
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch (error) {
            resolve({
                ok: false,
                status: 0,
                body: "",
                json: null,
                error: error instanceof Error ? error.message : "URL da Evolution inválida.",
            });
            return;
        }
        const isHttps = parsed.protocol === "https:";
        const lib = isHttps ? node_https_1.default : node_http_1.default;
        const headers = {
            apikey: options.apiKey,
            "Content-Type": "application/json",
        };
        if (bodyText) {
            headers["Content-Length"] = String(Buffer.byteLength(bodyText));
        }
        const requestOptions = {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: `${parsed.pathname}${parsed.search}`,
            method,
            headers,
            timeout: timeoutMs,
            ...(isHttps && (0, exports.isEvoTlsInsecure)() ? { rejectUnauthorized: false } : {}),
        };
        const req = lib.request(requestOptions, (res) => {
            req.setTimeout(0);
            res.setTimeout(0);
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                text += chunk;
            });
            res.on("end", () => {
                const status = res.statusCode ?? 0;
                resolve({
                    ok: status >= 200 && status < 300,
                    status,
                    body: text,
                    json: parseJson(text),
                });
            });
        });
        req.on("timeout", () => {
            req.destroy(new Error("timeout"));
        });
        req.on("error", (error) => {
            resolve({
                ok: false,
                status: 0,
                body: "",
                json: null,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        if (bodyText)
            req.write(bodyText);
        req.end();
    });
}
function evoHttpRequest(url, method, options) {
    const maxAttempts = Math.max(1, Math.min(5, Math.round(Number(options.retries ?? 1))));
    const timeoutMs = options.timeoutMs ?? (0, exports.defaultEvoHttpTimeoutMs)();
    return (async () => {
        let last = {
            ok: false,
            status: 0,
            body: "",
            json: null,
            error: "Evolution API sem resposta.",
        };
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            last = await evoHttpRequestOnce(url, method, {
                apiKey: options.apiKey,
                body: options.body,
                timeoutMs,
            });
            if (!shouldRetryEvoRequest(last) || attempt >= maxAttempts) {
                return last;
            }
            await sleep(350 * attempt);
        }
        return last;
    })();
}
