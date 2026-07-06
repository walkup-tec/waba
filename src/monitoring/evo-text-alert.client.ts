import { defaultEvoSendTextTimeoutMs, evoHttpRequest } from "../evo-http.client";

const resolveEvoApiBase = (): string =>
  String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080")
    .trim()
    .replace(/\/$/, "");

const resolveEvoApiKey = (): string =>
  String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();

const resolveSendTextUrlTemplate = (): string => {
  const base = resolveEvoApiBase();
  return (
    process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${base}/message/sendText/{instance}`
  ).trim();
};

const isSendTextV1 = (): boolean => {
  const raw = String(process.env.EVO_SEND_TEXT_V1 ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
};

const buildTemplateUrl = (template: string, instanceName: string): string =>
  template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));

const normalizeWhatsAppNumber = (num: string): string => {
  const raw = String(num || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
    return `55${digits}`;
  }
  return digits;
};

const isEvoSendTextAccepted = (json: unknown, body: string): boolean => {
  const rawBody = String(body || "").trim();
  if (!json && !rawBody) return false;
  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    const status = String(record.status ?? record.state ?? "").trim().toUpperCase();
    if (status === "ERROR" || status === "FAILED") return false;
    if (record.error) return false;
    if (record.key || record.messageId || record.id) return true;
  }
  const bodyLc = rawBody.toLowerCase();
  if (bodyLc.includes('"error"') || bodyLc.includes("not found")) return false;
  return rawBody.length > 0;
};

export async function sendEvoTextAlert(input: {
  instanceName: string;
  targetNumber: string;
  text: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; detail: string; status: number }> {
  const instanceName = String(input.instanceName || "").trim();
  const targetNumber = normalizeWhatsAppNumber(String(input.targetNumber || "").trim());
  const text = String(input.text || "").trim();

  if (!instanceName) {
    return { ok: false, detail: "Instância EVO não informada.", status: 0 };
  }
  if (!targetNumber) {
    return { ok: false, detail: "Número de destino inválido.", status: 0 };
  }
  if (!text) {
    return { ok: false, detail: "Texto do alerta vazio.", status: 0 };
  }

  const url = buildTemplateUrl(resolveSendTextUrlTemplate(), instanceName);
  const body: Record<string, unknown> = isSendTextV1()
    ? { number: targetNumber, textMessage: { text } }
    : { number: targetNumber, text, textMessage: { text } };

  const timeoutMs =
    typeof input.timeoutMs === "number" && input.timeoutMs >= 10_000
      ? Math.round(input.timeoutMs)
      : defaultEvoSendTextTimeoutMs();

  const result = await evoHttpRequest(url, "POST", {
    apiKey: resolveEvoApiKey(),
    body,
    timeoutMs,
    retries: 1,
  });

  const accepted = result.ok && isEvoSendTextAccepted(result.json, result.body);
  if (accepted) {
    return { ok: true, detail: "sendText OK.", status: result.status };
  }

  const detail =
    result.error ||
    result.body ||
    (result.json && typeof result.json === "object"
      ? String((result.json as Record<string, unknown>).message ?? "")
      : "") ||
    "Falha no envio via sistema WABA - Drax.";

  return {
    ok: false,
    detail: String(detail).slice(0, 300),
    status: result.status,
  };
}
