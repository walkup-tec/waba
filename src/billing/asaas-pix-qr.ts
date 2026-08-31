const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export const formatDueDateInBrazil = (daysAhead: number): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = formatter.format(new Date());
  const [year, month, day] = today.split("-").map((part) => Number(part));
  const extra = Math.max(0, Math.round(Number(daysAhead) || 0));
  const utc = Date.UTC(year, month - 1, day + extra);
  const next = new Date(utc);
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** Asaas devolve `YYYY-MM-DD HH:mm:ss` sem timezone (horário de Brasília). */
export const parseAsaasDateTimeToIso = (raw: string): string => {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const parsed = new Date(`${value.replace(" ", "T")}-03:00`);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

export const isPixQrExpired = (expiresAt: string | undefined, nowMs = Date.now()): boolean => {
  const iso = String(expiresAt ?? "").trim();
  if (!iso) return false;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return false;
  return at <= nowMs;
};

export const stripPixQrEncodedImage = (encodedImage: string): string => {
  const raw = String(encodedImage ?? "").trim();
  if (!raw) return "";
  const comma = raw.indexOf(",");
  if (/^data:image\//i.test(raw) && comma >= 0) {
    return raw.slice(comma + 1).replace(/\s/g, "");
  }
  return raw.replace(/\s/g, "");
};
