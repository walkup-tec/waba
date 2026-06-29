"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewPushMessageWithOpenAi = reviewPushMessageWithOpenAi;
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
function extractOpenAiText(payload) {
    const record = payload;
    const direct = String(record?.output_text || "").trim();
    if (direct)
        return direct;
    const out = Array.isArray(record?.output) ? record.output : [];
    const chunks = [];
    for (const item of out) {
        const content = Array.isArray(item?.content)
            ? item.content
            : [];
        for (const part of content) {
            const text = String(part?.text || part?.output_text || "").trim();
            if (text)
                chunks.push(text);
        }
    }
    return chunks.join("\n").trim();
}
async function reviewPushMessageWithOpenAi(input) {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY não configurada no servidor.");
    }
    const original = String(input.text || "").trim();
    if (!original) {
        throw new Error("Informe o texto da mensagem para revisão.");
    }
    const title = String(input.title || "").trim();
    const prompt = [
        "Você é revisor editorial de comunicados do sistema WABA (WhatsApp Business).",
        "Revise o texto em português do Brasil:",
        "- Corrija ortografia e gramática",
        "- Melhore clareza e tom profissional",
        "- Mantenha o sentido original e fatos",
        "- Não invente informações novas",
        "- Retorne APENAS o texto revisado, sem explicações",
        title ? `Título de referência: ${title}` : "",
        "Texto:",
        original,
    ]
        .filter(Boolean)
        .join("\n");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                input: prompt,
                store: false,
                max_output_tokens: 500,
            }),
        });
        const bodyText = await response.text();
        let json = null;
        try {
            json = bodyText ? JSON.parse(bodyText) : null;
        }
        catch {
            json = null;
        }
        if (!response.ok) {
            const err = json;
            const message = String(err?.error?.message || bodyText).slice(0, 240);
            throw new Error(`OpenAI HTTP ${response.status}${message ? `: ${message}` : ""}`);
        }
        const reviewedText = extractOpenAiText(json);
        if (!reviewedText) {
            throw new Error("OpenAI retornou resposta vazia.");
        }
        return { reviewedText, model: OPENAI_MODEL };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
