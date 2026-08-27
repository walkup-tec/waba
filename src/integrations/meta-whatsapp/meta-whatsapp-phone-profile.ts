const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);

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

export function mapWhatsappBusinessProfilePicture(json: unknown): string | null {
  const row = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const data = Array.isArray(row.data) ? row.data[0] : row;
  const inner = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const url = String(inner.profile_picture_url || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}
