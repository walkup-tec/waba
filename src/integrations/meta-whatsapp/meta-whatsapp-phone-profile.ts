const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);

export const META_WHATSAPP_VERTICALS = [
  { value: "OTHER", label: "Outro" },
  { value: "PROF_SERVICES", label: "Serviços profissionais" },
  { value: "RETAIL", label: "Compras e varejo" },
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "BEAUTY", label: "Beleza, spa e salão" },
  { value: "HEALTH", label: "Saúde e medicina" },
  { value: "EDU", label: "Educação" },
  { value: "FINANCE", label: "Finanças e bancos" },
  { value: "AUTO", label: "Automotivo" },
  { value: "APPAREL", label: "Roupas e vestuário" },
  { value: "ENTERTAIN", label: "Entretenimento" },
  { value: "EVENT_PLAN", label: "Eventos e serviços" },
  { value: "GROCERY", label: "Alimentos e mercearia" },
  { value: "GOVT", label: "Serviço público" },
  { value: "HOTEL", label: "Hotel e hospedagem" },
  { value: "NONPROFIT", label: "Organização sem fins lucrativos" },
  { value: "TRAVEL", label: "Viagem e transporte" },
  { value: "ALCOHOL", label: "Bebidas alcoólicas" },
] as const;

const VERTICAL_VALUES = new Set(META_WHATSAPP_VERTICALS.map((row) => row.value));

export type MetaWhatsappBusinessProfile = {
  profilePictureUrl: string | null;
  vertical: string | null;
  description: string | null;
  address: string | null;
  email: string | null;
};

export function parseDisplayName(value: unknown): string | null {
  const name = String(value || "").trim();
  if (!name) return null;
  if (name.length < 3 || name.length > 512) return null;
  return name;
}

function sniffProfilePhotoMime(bytes: Buffer): "image/png" | "image/jpeg" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

function normalizePhotoMime(mime: string): string {
  const raw = String(mime || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  if (raw === "image/x-png") return "image/png";
  return raw;
}

export function parseProfilePhoto(input: {
  photoBase64?: unknown;
  photoMime?: unknown;
}): { mime: string; bytes: Buffer; fileName: string } | null {
  const raw = String(input.photoBase64 || "").trim();
  if (!raw) return null;
  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
  const mimeFromUrl = dataUrl ? String(dataUrl[1] || "").trim().toLowerCase() : "";
  const b64 = dataUrl ? String(dataUrl[2] || "") : raw.replace(/\s+/g, "");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
  const sniffed = sniffProfilePhotoMime(bytes);
  const declared = normalizePhotoMime(String(input.photoMime || mimeFromUrl || ""));
  const mime = sniffed || (ALLOWED_MIME.has(declared) ? declared : "");
  if (!mime || !ALLOWED_MIME.has(mime)) return null;
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  const fileName = normalizedMime.includes("png") ? "profile.png" : "profile.jpg";
  return { mime: normalizedMime, bytes, fileName };
}

export function parseDescription(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text.length > 512) return null;
  return text;
}

export function parseAddress(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text.length > 256) return null;
  return text;
}

export function parseEmail(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return "";
  if (text.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null;
  return text;
}

export function parseVertical(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().toUpperCase();
  if (!text) return "";
  if (!VERTICAL_VALUES.has(text as (typeof META_WHATSAPP_VERTICALS)[number]["value"])) return null;
  return text;
}

function profileRow(json: unknown): Record<string, unknown> {
  const row = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const data = Array.isArray(row.data) ? row.data[0] : row;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export function mapWhatsappBusinessProfile(json: unknown): MetaWhatsappBusinessProfile {
  const inner = profileRow(json);
  const url = String(inner.profile_picture_url || "").trim();
  return {
    profilePictureUrl: /^https:\/\//i.test(url) ? url : null,
    vertical: String(inner.vertical || "").trim() || null,
    description: String(inner.description || "").trim() || null,
    address: String(inner.address || "").trim() || null,
    email: String(inner.email || "").trim() || null,
  };
}

export function mapWhatsappBusinessProfilePicture(json: unknown): string | null {
  return mapWhatsappBusinessProfile(json).profilePictureUrl;
}

const PHOTO_FETCH_MS = 5000;

export async function fetchHttpsProfileImage(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ext: "png" | "jpg"; bytes: Buffer } | null> {
  const raw = String(url || "").trim();
  if (!/^https:\/\//i.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  try {
    const response = await fetchImpl(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PHOTO_FETCH_MS),
    });
    if (!response.ok) return null;
    const mime = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_MIME.has(mime)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
    const ext: "png" | "jpg" = mime.includes("png") ? "png" : "jpg";
    return { ext, bytes };
  } catch {
    return null;
  }
}
