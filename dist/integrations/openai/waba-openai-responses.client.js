"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callOpenAiStructured = callOpenAiStructured;
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-nano";
function extractOutputText(payload) {
    const row = payload && typeof payload === "object" ? payload : {};
    const direct = String(row.output_text || "").trim();
    if (direct)
        return direct;
    const output = Array.isArray(row.output) ? row.output : [];
    const chunks = [];
    for (const item of output) {
        const content = Array.isArray(item?.content)
            ? item.content
            : [];
        for (const part of content) {
            const text = String(part.text || part.output_text || "").trim();
            if (text)
                chunks.push(text);
        }
    }
    return chunks.join("\n").trim();
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function callOpenAiStructured(request) {
    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey)
        throw new Error("OPENAI_API_KEY não configurada no servidor.");
    const apiUrl = String(process.env.OPENAI_API_URL || DEFAULT_OPENAI_API_URL).trim();
    const model = String(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim();
    const maxAttempts = Math.max(1, Math.min(3, Number(request.maxAttempts || 3)));
    const timeoutMs = Math.max(5000, Math.min(60000, Number(request.timeoutMs || 20000)));
    const startedAt = Date.now();
    let lastStatus = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    instructions: request.instructions,
                    input: request.input,
                    store: false,
                    max_output_tokens: Math.max(400, Math.min(4000, Number(request.maxOutputTokens || 2000))),
                    text: {
                        format: {
                            type: "json_schema",
                            name: request.schemaName,
                            strict: true,
                            schema: request.schema,
                        },
                    },
                }),
            });
            lastStatus = response.status;
            const json = (await response.json().catch(() => null));
            if (response.ok) {
                const text = extractOutputText(json);
                if (!text)
                    throw new Error("OpenAI retornou resposta estruturada vazia.");
                let value;
                try {
                    value = JSON.parse(text);
                }
                catch {
                    throw new Error("OpenAI retornou JSON inválido.");
                }
                return {
                    value,
                    model: String(json?.model || model),
                    responseId: String(json?.id || "").trim() || null,
                    latencyMs: Date.now() - startedAt,
                };
            }
            const transient = response.status === 429 || response.status >= 500;
            if (!transient || attempt >= maxAttempts)
                break;
        }
        catch (error) {
            const timeoutError = String(error?.name || "") === "AbortError";
            if (!timeoutError && attempt >= maxAttempts)
                throw error;
            if (attempt >= maxAttempts)
                break;
        }
        finally {
            clearTimeout(timeout);
        }
        await sleep(Math.floor(350 * 2 ** (attempt - 1) + Math.random() * 180));
    }
    throw new Error(lastStatus === 429
        ? "Limite temporário da IA atingido. Tente novamente em instantes."
        : "Assistente de IA temporariamente indisponível.");
}
