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

/** Bodies de findMessages: remoteJid + fallback recente (chats @lid sem JID telefone). */
export function buildAquecedorFindMessagesBodies(
  remoteJid: string,
  fromMe: boolean | null = null,
): Array<Record<string, unknown>> {
  const jid = String(remoteJid || "").trim();
  const bodies: Array<Record<string, unknown>> = [];
  if (jid) {
    const whereKey: Record<string, unknown> = { remoteJid: jid };
    if (fromMe != null) whereKey.fromMe = fromMe;
    bodies.push(
      { where: { key: whereKey }, limit: 50 },
      { where: { key: { remoteJid: jid } }, limit: 50 },
      { where: { key: { remoteJid: jid } }, take: 50 },
      {
        where: { key: { remoteJid: jid.replace("@s.whatsapp.net", "") } },
        limit: 50,
      },
    );
  }
  // Fallback: mensagens recentes (WhatsApp/@lid pode não indexar pelo JID telefone).
  if (fromMe != null) {
    bodies.push({ where: { key: { fromMe } }, limit: 40 });
  } else {
    bodies.push({ where: { key: {} }, limit: 40 });
  }
  return bodies;
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
  sawOrigem: boolean;
  sawDestino: boolean;
};

/** Status Baileys/EVO após sendText (MessageUpdate / findStatusMessage). */
export type EvoMessageAckStatus =
  | "PENDING"
  | "SERVER_ACK"
  | "DELIVERY_ACK"
  | "READ"
  | "PLAYED"
  | "ERROR"
  | "FAILED"
  | "NONE"
  | "UNKNOWN";

const EVO_ACK_FAILURE = new Set(["ERROR", "FAILED"]);
const EVO_ACK_PROGRESS = new Set([
  "SERVER_ACK",
  "DELIVERY_ACK",
  "READ",
  "PLAYED",
]);

export function normalizeEvoMessageAckStatus(raw: unknown): EvoMessageAckStatus {
  const value = String(raw || "")
    .trim()
    .toUpperCase();
  if (!value) return "NONE";
  if (EVO_ACK_FAILURE.has(value)) return value as EvoMessageAckStatus;
  if (EVO_ACK_PROGRESS.has(value)) return value as EvoMessageAckStatus;
  if (value === "PENDING") return "PENDING";
  if (value === "NONE") return "NONE";
  return "UNKNOWN";
}

export function isEvoAckFailure(status: unknown): boolean {
  return EVO_ACK_FAILURE.has(normalizeEvoMessageAckStatus(status));
}

export function isEvoAckProgressed(status: unknown): boolean {
  return EVO_ACK_PROGRESS.has(normalizeEvoMessageAckStatus(status));
}

/** ACK que prova entrega no aparelho (não apenas no servidor WhatsApp). */
export function isEvoAckDeviceDelivered(status: unknown): boolean {
  const ack = normalizeEvoMessageAckStatus(status);
  return ack === "DELIVERY_ACK" || ack === "READ" || ack === "PLAYED";
}

/** Extrai o último status de MessageUpdate / findStatusMessage / campo status. */
export function extractEvoMessageAckStatus(node: unknown, depth = 0): EvoMessageAckStatus {
  if (depth > 12 || node == null) return "UNKNOWN";
  if (Array.isArray(node)) {
    let best: EvoMessageAckStatus = "UNKNOWN";
    for (const item of node) {
      const st = extractEvoMessageAckStatus(item, depth + 1);
      if (isEvoAckFailure(st)) return st;
      if (isEvoAckProgressed(st)) best = st;
      else if (st === "PENDING" && best === "UNKNOWN") best = "PENDING";
      else if (st === "NONE" && (best === "UNKNOWN" || best === "PENDING")) best = st;
    }
    return best;
  }
  if (typeof node !== "object") return "UNKNOWN";
  const obj = node as Record<string, unknown>;
  const updates = obj.MessageUpdate ?? obj.messageUpdate;
  if (Array.isArray(updates) && updates.length) {
    const last = updates[updates.length - 1] as Record<string, unknown> | undefined;
    if (last && last.status != null) {
      return normalizeEvoMessageAckStatus(last.status);
    }
  }
  if (obj.status != null && (obj.keyId != null || obj.messageId != null || obj.key != null)) {
    return normalizeEvoMessageAckStatus(obj.status);
  }
  if (typeof obj.status === "string" && depth === 0) {
    return normalizeEvoMessageAckStatus(obj.status);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const nested = extractEvoMessageAckStatus(value, depth + 1);
      if (nested !== "UNKNOWN") return nested;
    }
  }
  return "UNKNOWN";
}

export type EvoOutboundHealthClass = "healthy" | "broken" | "unknown";

/** Classifica amostra fromMe: 100% ERROR com N>=3 → broken; qualquer ACK progresso → healthy. */
export function classifyEvoOutboundSample(
  statuses: Array<string | EvoMessageAckStatus>,
  options?: { minSamples?: number },
): EvoOutboundHealthClass {
  const minSamples = Math.max(1, options?.minSamples ?? 3);
  const normalized = statuses.map((s) => normalizeEvoMessageAckStatus(s));
  if (normalized.length < minSamples) return "unknown";
  const failures = normalized.filter((s) => isEvoAckFailure(s)).length;
  const progressed = normalized.filter((s) => isEvoAckProgressed(s)).length;
  if (progressed > 0) return "healthy";
  if (failures === normalized.length) return "broken";
  if (failures / normalized.length >= 0.8 && failures >= minSamples) return "broken";
  return "unknown";
}

/** Decisão final de entrega.
 * 1) Tag no DESTINO → sucesso (prova direta no WhatsApp do destinatário).
 * 2) ACK no aparelho (DELIVERY_ACK/READ/PLAYED) → sucesso mesmo se findMessages no destino
 *    falhar (@lid / indexação EVO atrasada) — falso negativo clássico em 2477 etc.
 * 3) MessageUpdate=ERROR na origem → falha de sessão de envio (não culpar destino).
 * SERVER_ACK sozinho NÃO confirma (só servidor; ainda pode não chegar no aparelho).
 */
export function decideAquecedorDeliveryConfirmation(input: {
  sawOrigem: boolean;
  sawDestino: boolean;
  origem?: string;
  destino?: string;
  ackStatus?: string | EvoMessageAckStatus | null;
}): AquecedorDeliveryDecision {
  const origem = String(input.origem || "").trim() || "origem";
  const destino = String(input.destino || "").trim() || "destino";
  const sawOrigem = Boolean(input.sawOrigem);
  const sawDestino = Boolean(input.sawDestino);
  const ack = normalizeEvoMessageAckStatus(input.ackStatus);
  if (sawDestino) {
    return { ok: true, detail: "", sawOrigem, sawDestino };
  }
  if (isEvoAckFailure(ack)) {
    return {
      ok: false,
      detail: `Envio da origem (${origem}) falhou no WhatsApp (MessageUpdate=${ack}). A sessão EVO dessa instância está open, mas o outbound está quebrado — reconecte o QR da ${origem}. Destino (${destino}) não é o problema.`,
      sawOrigem,
      sawDestino,
    };
  }
  if (isEvoAckDeviceDelivered(ack)) {
    return { ok: true, detail: "", sawOrigem, sawDestino };
  }
  if (sawOrigem && !sawDestino) {
    return {
      ok: false,
      detail: `Mensagem apareceu só na origem (${origem}); destino (${destino}) não recebeu no WhatsApp. Verifique conexão ou restrição do número destino.`,
      sawOrigem,
      sawDestino,
    };
  }
  return {
    ok: false,
    detail:
      "EVO aceitou o envio, mas a mensagem não apareceu no WhatsApp do destinatário (conferência findMessages).",
    sawOrigem,
    sawDestino,
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
