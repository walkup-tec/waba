"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvoTlsInsecure = void 0;
exports.evoHttpRequest = evoHttpRequest;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
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
    return runtime === "development" && base.startsWith("https://");
};
exports.isEvoTlsInsecure = isEvoTlsInsecure;
function evoHttpRequest(url, method, options) {
    const timeoutMs = Math.max(1000, Math.round(Number(options.timeoutMs ?? 12000)));
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
            ...(isHttps && (0, exports.isEvoTlsInsecure)() ? { rejectUnauthorized: false } : {}),
        };
        const req = lib.request(requestOptions, (res) => {
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
        req.setTimeout(timeoutMs, () => {
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
