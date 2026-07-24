/**
 * Helpers puros da confirmação de entrega do aquecedor.
 * Extraídos para teste unitário (evitar falso «Envio com Sucesso»).
 */

export function extractAquecedorMessageMarker(text: string): string {
  const value = String(text || "").trim();
  const suffix = value.match(/\b([a-z0-9]{5,8})\s*$/i);
  if (suffix?.[1]) return suffix[1].toLowerCase();
  return value.slice(-24).toLowerCase();
}

/** Needles seguros: tag única, nunca prefixo da frase reutilizada. */
export function buildAquecedorDeliveryNeedles(messageText: string): string[] {
  const marker = extractAquecedorMessageMarker(messageText);
  const fullText = String(messageText || "").trim().toLowerCase();
  const needles: string[] = [];
  const markerLooksUnique = Boolean(
    marker && /^[a-z0-9]{5,8}$/i.test(marker) && fullText.endsWith(marker),
  );
  if (markerLooksUnique) {
    needles.push(marker);
  } else if (fullText.length >= 6) {
    needles.push(fullText);
  }
  return needles;
}

/** Bodies de findMessages: sempre com remoteJid (sem probe global). */
export function buildAquecedorFindMessagesBodies(
  remoteJid: string,
  fromMe: boolean | null = null,
): Array<Record<string, unknown>> {
  const jid = String(remoteJid || "").trim();
  if (!jid) return [];
  const whereKey: Record<string, unknown> = { remoteJid: jid };
  if (fromMe != null) whereKey.fromMe = fromMe;
  return [
    { where: { key: whereKey }, limit: 50 },
    { where: { key: { remoteJid: jid } }, limit: 50 },
    { where: { key: { remoteJid: jid } }, take: 50 },
    {
      where: { key: { remoteJid: jid.replace("@s.whatsapp.net", "") } },
      limit: 50,
    },
  ];
}

export function aquecedorTextMatchesNeedle(
  text: string,
  needle: string,
  requireTokenBoundary: boolean,
): boolean {
  const lowered = String(text || "").toLowerCase();
  const token = String(needle || "").trim().toLowerCase();
  if (!lowered || !token) return false;
  if (!requireTokenBoundary || token.length > 24) {
    return lowered.includes(token);
  }
  if (lowered === token || lowered.endsWith(` ${token}`) || lowered.endsWith(token)) {
    return true;
  }
  return new RegExp(
    `(?:^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`,
    "i",
  ).test(lowered);
}

export function extractAquecedorMessageTimestampMs(
  node: Record<string, unknown>,
): number | null {
  const key = node.key as Record<string, unknown> | undefined;
  const raw = key?.messageTimestamp ?? node.messageTimestamp ?? node.timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 1_000_000_000_000 ? raw : raw * 1000;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  }
  return null;
}

export function extractAquecedorFromMe(node: Record<string, unknown>): boolean | null {
  const key = node.key as Record<string, unknown> | undefined;
  if (typeof key?.fromMe === "boolean") return key.fromMe;
  if (typeof node.fromMe === "boolean") return node.fromMe;
  return null;
}

export function collectEvoChatMessageTexts(
  node: unknown,
  out: string[],
  depth = 0,
): void {
  if (depth > 10 || node == null) return;
  if (typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvoChatMessageTexts(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.conversation === "string" && obj.conversation.trim()) {
    out.push(obj.conversation.trim());
  }
  const ext = obj.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string" && ext.text.trim()) out.push(ext.text.trim());
  if (typeof obj.text === "string" && obj.text.trim()) out.push(obj.text.trim());
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectEvoChatMessageTexts(value, out, depth + 1);
  }
}

export function evoPayloadIncludesNeedle(
  node: unknown,
  needles: string[],
  options?: {
    minTimestampMs?: number;
    fromMe?: boolean | null;
    requireTokenBoundary?: boolean;
  },
  depth = 0,
): boolean {
  if (depth > 14 || node == null) return false;
  if (Array.isArray(node)) {
    return node.some((item) => evoPayloadIncludesNeedle(item, needles, options, depth + 1));
  }
  if (typeof node !== "object") return false;
  const obj = node as Record<string, unknown>;
  const fromMe = extractAquecedorFromMe(obj);
  const texts: string[] = [];
  collectEvoChatMessageTexts(obj.message ?? obj, texts);
  const normalizedNeedles = needles
    .map((needle) => String(needle || "").trim().toLowerCase())
    .filter(Boolean);
  if (normalizedNeedles.length && texts.length) {
    const minTs = options?.minTimestampMs;
    const ts = extractAquecedorMessageTimestampMs(obj);
    const tsOk = minTs == null || ts == null || ts >= minTs;
    const fromMeOk =
      options?.fromMe == null || fromMe == null || fromMe === options.fromMe;
    if (tsOk && fromMeOk) {
      const requireTokenBoundary = options?.requireTokenBoundary === true;
      const matched = texts.some((text) =>
        normalizedNeedles.some((needle) =>
          aquecedorTextMatchesNeedle(text, needle, requireTokenBoundary),
        ),
      );
      if (matched) return true;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      if (evoPayloadIncludesNeedle(value, needles, options, depth + 1)) return true;
    }
  }
  return false;
}

export type AquecedorDeliveryDecision = {
  ok: boolean;
  detail: string;
};

/** Decisão final: exige origem + destino. */
export function decideAquecedorDeliveryConfirmation(input: {
  sawOrigem: boolean;
  sawDestino: boolean;
  origem?: string;
  destino?: string;
}): AquecedorDeliveryDecision {
  const origem = String(input.origem || "").trim() || "origem";
  const destino = String(input.destino || "").trim() || "destino";
  if (input.sawDestino && input.sawOrigem) {
    return { ok: true, detail: "" };
  }
  if (input.sawOrigem && !input.sawDestino) {
    return {
      ok: false,
      detail: `Mensagem apareceu só na origem (${origem}); destino (${destino}) não recebeu no WhatsApp. Verifique conexão ou restrição do número destino.`,
    };
  }
  if (input.sawDestino && !input.sawOrigem) {
    return {
      ok: false,
      detail: `Marcador apareceu no destino sem prova na origem (${origem}) — possível histórico EVO; não confirmo envio real.`,
    };
  }
  return {
    ok: false,
    detail:
      "EVO aceitou o envio, mas a mensagem não apareceu no WhatsApp do destinatário (conferência findMessages).",
  };
}

/** Simula o bug antigo: prefixo + histórico. */
export function legacyWouldFalsePositive(input: {
  sentText: string;
  historicTexts: string[];
}): boolean {
  const full = String(input.sentText || "").trim().toLowerCase();
  const prefix = full.length >= 12 ? full.slice(0, 48) : full;
  return input.historicTexts.some((t) => String(t || "").toLowerCase().includes(prefix));
}
