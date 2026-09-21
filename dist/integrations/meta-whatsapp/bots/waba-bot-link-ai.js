"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBotAiCompare = normalizeBotAiCompare;
exports.sameBotAiText = sameBotAiText;
exports.clipBotAiText = clipBotAiText;
exports.listRecentLinkAiTexts = listRecentLinkAiTexts;
exports.rememberLinkAiText = rememberLinkAiText;
exports.resetLinkAiMemoryForTests = resetLinkAiMemoryForTests;
exports.setLinkAiOpenAiCallerForTests = setLinkAiOpenAiCallerForTests;
exports.rewriteLinkAiText = rewriteLinkAiText;
exports.rewriteLinkAiForSend = rewriteLinkAiForSend;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../../data-path");
const waba_openai_responses_client_1 = require("../../openai/waba-openai-responses.client");
const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const RECENT_LIMIT = 40;
let openAiCaller = waba_openai_responses_client_1.callOpenAiStructured;
const recentMemory = new Map();
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return "";
    if (TENANT_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function memoryKey(input) {
    return [safeTenantId(String(input.tenantId || "")), String(input.flowId || "").trim(), String(input.nodeId || "").trim()]
        .filter(Boolean)
        .join("::");
}
function variantsPath(tenantId, flowId, nodeId) {
    const tenant = safeTenantId(tenantId);
    const flow = String(flowId || "").replace(/[^a-zA-Z0-9._-]/g, "");
    const node = String(nodeId || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!tenant || !flow || !node)
        return null;
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "bots", tenant, "link-ai", `${flow}-${node}.json`);
}
function normalizeBotAiCompare(text) {
    return String(text || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function sameBotAiText(left, right) {
    const a = normalizeBotAiCompare(left);
    const b = normalizeBotAiCompare(right);
    return Boolean(a) && a === b;
}
function clipBotAiText(text, maxChars) {
    const limit = Math.max(0, Number(maxChars) || 0);
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (!limit || !value)
        return "";
    if (value.length <= limit)
        return value;
    const sliced = value.slice(0, limit);
    const breakAt = Math.max(sliced.lastIndexOf(" "), sliced.lastIndexOf("\n"));
    if (breakAt >= Math.min(8, Math.floor(limit * 0.55))) {
        return sliced.slice(0, breakAt).trim();
    }
    return sliced.trim();
}
function readStoredTexts(file) {
    try {
        if (!(0, node_fs_1.existsSync)(file))
            return [];
        const row = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        return Array.isArray(row.texts) ? row.texts.map((item) => String(item || "")).filter(Boolean) : [];
    }
    catch {
        return [];
    }
}
function listRecentLinkAiTexts(input) {
    const key = memoryKey(input);
    const memory = key ? recentMemory.get(key) || [] : [];
    const file = variantsPath(String(input.tenantId || ""), String(input.flowId || ""), String(input.nodeId || ""));
    const stored = file ? readStoredTexts(file) : [];
    const out = [];
    const seen = new Set();
    for (const text of [...memory, ...stored]) {
        const norm = normalizeBotAiCompare(text);
        if (!norm || seen.has(norm))
            continue;
        seen.add(norm);
        out.push(text);
    }
    return out.slice(0, RECENT_LIMIT);
}
function rememberLinkAiText(input) {
    const text = String(input.text || "").trim();
    if (!text)
        return;
    const key = memoryKey(input);
    if (key) {
        const next = [text, ...(recentMemory.get(key) || [])].slice(0, RECENT_LIMIT);
        recentMemory.set(key, next);
    }
    const file = variantsPath(String(input.tenantId || ""), String(input.flowId || ""), String(input.nodeId || ""));
    if (!file)
        return;
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(file), { recursive: true });
    const texts = [text, ...readStoredTexts(file).filter((item) => !sameBotAiText(item, text))].slice(0, RECENT_LIMIT);
    (0, node_fs_1.writeFileSync)(file, JSON.stringify({ texts, updatedAt: new Date().toISOString() }), "utf8");
}
function resetLinkAiMemoryForTests() {
    recentMemory.clear();
    openAiCaller = waba_openai_responses_client_1.callOpenAiStructured;
}
function setLinkAiOpenAiCallerForTests(fn) {
    openAiCaller = fn || waba_openai_responses_client_1.callOpenAiStructured;
}
function hasOpenAiKey() {
    return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}
function localRewrite(source, seed, attempt) {
    const max = source.length;
    const phrases = [
        source,
        source.replace(/\bToque\b/gi, "Clique").replace(/\bclicando\b/gi, "tocando"),
        source.replace(/\bFale diretamente\b/gi, "Fale agora com").replace(/\bconsultor\b/gi, "especialista"),
        source.replace(/\bAcesse o\b/gi, "Abra o").replace(/\bno botão abaixo\b/gi, "no botão"),
        source.replace(/\bwhatsapp\b/gi, "WhatsApp").replace(/\bdele\b/gi, "desse contato"),
        source.replace(/\bpara abrir o link\b/gi, "e abra o endereço").replace(/\bToque no botão\b/gi, "Use o botão"),
    ];
    const unique = phrases
        .map((item, index) => clipBotAiText(item + (index && item === source ? "" : ""), max))
        .filter((item) => item && !sameBotAiText(item, source));
    if (unique.length) {
        const idx = Math.abs(hashSeed(`${seed}:${attempt}`)) % unique.length;
        return unique[idx];
    }
    if (max <= 3)
        return clipBotAiText(source, max);
    const trimmed = source.trim();
    const withoutLast = trimmed.replace(/[.,;:!?…]+$/u, "").trim();
    const endings = [" agora.", " já.", " aqui.", "."];
    for (const ending of endings) {
        const candidate = clipBotAiText(`${withoutLast}${ending}`, max);
        if (candidate && !sameBotAiText(candidate, source))
            return candidate;
    }
    return clipBotAiText(source, max);
}
function hashSeed(value) {
    let hash = 0;
    const raw = String(value || "");
    for (let i = 0; i < raw.length; i += 1)
        hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    return hash;
}
function extractAiText(value) {
    if (!value || typeof value !== "object")
        return "";
    return String(value.text || "").trim();
}
async function rewriteWithOpenAi(source, avoid, seed, maxChars) {
    const result = await openAiCaller({
        instructions: "Você reescreve mensagens curtas de WhatsApp em português do Brasil. " +
            "Mantenha o mesmo sentido, tom e chamada à ação. Não invente dados, nomes ou links. " +
            "Não copie o texto original nem os textos proibidos. " +
            `A resposta deve ter no máximo ${maxChars} caracteres, incluindo espaços e pontuação. ` +
            "Não use aspas, markdown, prefixos nem explicações.",
        input: JSON.stringify({
            source,
            maxChars,
            avoid,
            seed,
        }),
        schemaName: "bot_link_ai_text",
        schema: {
            type: "object",
            additionalProperties: false,
            required: ["text"],
            properties: {
                text: { type: "string" },
            },
        },
        maxOutputTokens: 400,
        timeoutMs: 20000,
        maxAttempts: 2,
    });
    return clipBotAiText(extractAiText(result.value), maxChars);
}
function isForbidden(text, avoid) {
    return avoid.some((item) => sameBotAiText(item, text));
}
async function rewriteLinkAiText(input) {
    const sourceText = String(input.sourceText || "").replace(/\s+/g, " ").trim();
    const maxChars = sourceText.length;
    if (!sourceText) {
        throw new Error("Informe o texto da mensagem para a IA.");
    }
    const recent = listRecentLinkAiTexts(input);
    const avoid = [sourceText, ...recent].filter(Boolean);
    const seed = String(input.seed || `${Date.now()}-${Math.random()}`);
    let text = "";
    if (hasOpenAiKey() || openAiCaller !== waba_openai_responses_client_1.callOpenAiStructured) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                text = await rewriteWithOpenAi(sourceText, avoid, `${seed}:${attempt}`, maxChars);
            }
            catch {
                text = "";
            }
            if (text && !isForbidden(text, avoid))
                break;
        }
    }
    if (!text || isForbidden(text, avoid)) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const local = localRewrite(sourceText, seed, attempt);
            if (local && !isForbidden(local, avoid)) {
                text = local;
                break;
            }
            if (!text)
                text = local;
        }
    }
    text = clipBotAiText(text || sourceText, maxChars);
    if (input.remember !== false) {
        rememberLinkAiText({
            tenantId: input.tenantId,
            flowId: input.flowId,
            nodeId: input.nodeId,
            text,
        });
    }
    return { text, sourceText, maxChars };
}
async function rewriteLinkAiForSend(input) {
    try {
        const result = await rewriteLinkAiText(input);
        return result.text || String(input.sourceText || "").trim();
    }
    catch {
        return String(input.sourceText || "").trim();
    }
}
