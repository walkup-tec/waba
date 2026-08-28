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

export function parseProfilePhoto(input: {
  photoBase64?: unknown;
  photoMime?: unknown;
}): { mime: string; bytes: Buffer; fileName: string } | null {
  const raw = String(input.photoBase64 || "").trim();
  if (!raw) return null;
  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
  const mimeFromUrl = dataUrl ? String(dataUrl[1] || "").trim().toLowerCase() : "";
  const b64 = dataUrl ? String(dataUrl[2] || "") : raw.replace(/\s+/g, "");
  const mime = String(input.photoMime || mimeFromUrl || "").trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
  const fileName = mime.includes("png") ? "profile.png" : "profile.jpg";
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
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
