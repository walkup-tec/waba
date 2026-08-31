import type { WabaSystemUserOperacionalSegment } from "./waba-system-user.repository";

export const OPERACIONAL_SEGMENT_LABELS: Record<WabaSystemUserOperacionalSegment, string> = {
  bets: "Bets",
  outros: "Outros",
};

const normalizeSegment = (value: unknown): WabaSystemUserOperacionalSegment | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "todos") return "outros";
  if (raw === "bets" || raw === "outros") return raw;
  return null;
};

/**
 * Resolve a lista efetiva de segmentos atendidos (array novo ou campo legado singular).
 * Legado `bets` → Bets + Outros (preserva a regra antiga de escalonamento na migração).
 */
export const resolveOperacionalSegments = (user: {
  operacionalSegment?: WabaSystemUserOperacionalSegment | null;
  operacionalSegments?: WabaSystemUserOperacionalSegment[] | null;
}): WabaSystemUserOperacionalSegment[] => {
  const fromArray = Array.isArray(user.operacionalSegments)
    ? user.operacionalSegments
        .map((item) => normalizeSegment(item))
        .filter((item): item is WabaSystemUserOperacionalSegment => Boolean(item))
    : [];
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const single = normalizeSegment(user.operacionalSegment);
  if (!single) return [];
  if (single === "bets") return ["bets", "outros"];
  return [single];
};

export const formatOperacionalSegmentsLabel = (
  segments: WabaSystemUserOperacionalSegment[],
): string => {
  if (!segments.length) return "—";
  return segments.map((segment) => OPERACIONAL_SEGMENT_LABELS[segment]).join(" + ");
};

/**
 * Aceita array, valor único ou lista CSV.
 * Exige ao menos um segmento quando `required`.
 */
export const parseOperacionalSegmentsInput = (
  value: unknown,
  options: { required?: boolean } = {},
): WabaSystemUserOperacionalSegment[] => {
  const collected: WabaSystemUserOperacionalSegment[] = [];

  const push = (raw: unknown) => {
    const parsed = normalizeSegment(raw);
    if (parsed && !collected.includes(parsed)) collected.push(parsed);
  };

  if (Array.isArray(value)) {
    for (const item of value) push(item);
  } else if (typeof value === "string" && value.includes(",")) {
    for (const part of value.split(",")) push(part);
  } else if (value != null && String(value).trim()) {
    push(value);
  }

  if (!collected.length && options.required) {
    throw new Error("Selecione ao menos um segmento que este operacional atende (Bets e/ou Outros).");
  }
  return collected;
};
