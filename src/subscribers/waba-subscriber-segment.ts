import { WabaSubscriberRepository } from "./waba-subscriber.repository";

export type WabaSubscriberSegment = "bets" | "outros";

export const WABA_SUBSCRIBER_SEGMENT_LABELS: Record<WabaSubscriberSegment, string> = {
  bets: "Black",
  outros: "White",
};

const normalizeRaw = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const parseWabaSubscriberSegment = (
  raw: unknown,
  options?: { defaultValue?: WabaSubscriberSegment; required?: boolean },
): WabaSubscriberSegment => {
  const value = normalizeRaw(raw);
  if (!value) {
    if (options?.required) {
      throw new Error("Selecione o segmento do assinante (Black ou White).");
    }
    return options?.defaultValue ?? "outros";
  }
  if (value === "bets" || value === "bet" || value === "black") return "bets";
  if (
    value === "outros" ||
    value === "outro" ||
    value === "white" ||
    value === "todos" ||
    value === "wabadisparos" ||
    value === "waba-disparos" ||
    value === "drax" ||
    value === "default"
  ) {
    return "outros";
  }
  if (
    value === "bet-waba" ||
    value === "betwaba" ||
    value === "bet.waba.info" ||
    value === "bet_waba"
  ) {
    return "bets";
  }
  throw new Error("Segmento inválido. Use Black ou White.");
};

export const resolveSignupSegmentFromRequest = (
  body: Record<string, unknown>,
  headers: { origin?: string; referer?: string },
): WabaSubscriberSegment => {
  const explicit = normalizeRaw(body.segment ?? body.signupOrigin ?? body.signupSource);
  if (explicit) {
    try {
      return parseWabaSubscriberSegment(explicit, { defaultValue: "outros" });
    } catch {
      /* tenta inferir pelo host */
    }
  }
  const hostHint = `${headers.origin ?? ""} ${headers.referer ?? ""}`.toLowerCase();
  if (hostHint.includes("bet.waba.info")) return "bets";
  if (hostHint.includes("wabadisparos.com.br")) return "outros";
  return "outros";
};

const subscriberRepository = new WabaSubscriberRepository();

export const getSubscriberSegmentByEmail = (email: string): WabaSubscriberSegment => {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) return "outros";
  const subscriber = subscriberRepository.getByEmail(normalized);
  return subscriber?.segment ?? "outros";
};

export const isBetsSubscriberEmail = (email: string): boolean =>
  getSubscriberSegmentByEmail(email) === "bets";
