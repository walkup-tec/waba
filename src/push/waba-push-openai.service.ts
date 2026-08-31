const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function extractOpenAiText(payload: unknown): string {
  const record = payload as Record<string, unknown> | null;
  const direct = String(record?.output_text || "").trim();
  if (direct) return direct;
  const out = Array.isArray(record?.output) ? record.output : [];
  const chunks: string[] = [];
  for (const item of out) {
    const content = Array.isArray((item as Record<string, unknown>)?.content)
      ? (item as Record<string, unknown>).content
      : [];
    for (const part of content as Array<Record<string, unknown>>) {
      const text = String(part?.text || part?.output_text || "").trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

export function sanitizeReviewedPushText(text: string): string {
  return String(text || "")
    .replace(/^\s*t[ií]tulo de refer[eê]ncia:\s*.+(\r?\n)*/i, "")
    .replace(/^\s*t[ií]tulo:\s*.+(\r?\n)*/i, "")
    .replace(/^\s*texto:\s*/i, "")
    .trim();
}

export async function reviewPushMessageWithOpenAi(input: {
  title?: string;
  text: string;
}): Promise<{ reviewedText: string; model: string }> {
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
    "- Retorne APENAS o corpo do comunicado revisado, sem explicações",
    "- Não inclua rótulos, cabeçalhos ou o título na resposta (ex.: não escreva 'Título de referência', 'Título:' ou 'Texto:')",
    title
      ? `Contexto interno (não repetir na resposta): o assunto do comunicado é "${title}".`
      : "",
    "Texto a revisar:",
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
    let json: unknown = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const err = json as Record<string, unknown> | null;
      const message = String((err?.error as Record<string, unknown>)?.message || bodyText).slice(
        0,
        240,
      );
      throw new Error(`OpenAI HTTP ${response.status}${message ? `: ${message}` : ""}`);
    }
    const reviewedText = sanitizeReviewedPushText(extractOpenAiText(json));
    if (!reviewedText) {
      throw new Error("OpenAI retornou resposta vazia.");
    }
    return { reviewedText, model: OPENAI_MODEL };
  } finally {
    clearTimeout(timeoutId);
  }
}
