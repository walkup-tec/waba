"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_WHATSAPP_VERTICALS = void 0;
exports.parseDisplayName = parseDisplayName;
exports.parseProfilePhoto = parseProfilePhoto;
exports.parseDescription = parseDescription;
exports.parseAddress = parseAddress;
exports.parseEmail = parseEmail;
exports.parseVertical = parseVertical;
exports.mapWhatsappBusinessProfile = mapWhatsappBusinessProfile;
exports.mapWhatsappBusinessProfilePicture = mapWhatsappBusinessProfilePicture;
exports.fetchHttpsProfileImage = fetchHttpsProfileImage;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);
exports.META_WHATSAPP_VERTICALS = [
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
];
const VERTICAL_VALUES = new Set(exports.META_WHATSAPP_VERTICALS.map((row) => row.value));
function parseDisplayName(value) {
    const name = String(value || "").trim();
    if (!name)
        return null;
    if (name.length < 3 || name.length > 512)
        return null;
    return name;
}
function parseProfilePhoto(input) {
    const raw = String(input.photoBase64 || "").trim();
    if (!raw)
        return null;
    const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
    const mimeFromUrl = dataUrl ? String(dataUrl[1] || "").trim().toLowerCase() : "";
    const b64 = dataUrl ? String(dataUrl[2] || "") : raw.replace(/\s+/g, "");
    const mime = String(input.photoMime || mimeFromUrl || "").trim().toLowerCase();
    if (!ALLOWED_MIME.has(mime))
        return null;
    let bytes;
    try {
        bytes = Buffer.from(b64, "base64");
    }
    catch {
        return null;
    }
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
        return null;
    const fileName = mime.includes("png") ? "profile.png" : "profile.jpg";
    const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
    return { mime: normalizedMime, bytes, fileName };
}
function parseDescription(value) {
    if (value === undefined || value === null)
        return undefined;
    const text = String(value).trim();
    if (text.length > 512)
        return null;
    return text;
}
function parseAddress(value) {
    if (value === undefined || value === null)
        return undefined;
    const text = String(value).trim();
    if (text.length > 256)
        return null;
    return text;
}
function parseEmail(value) {
    if (value === undefined || value === null)
        return undefined;
    const text = String(value).trim();
    if (!text)
        return "";
    if (text.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
        return null;
    return text;
}
function parseVertical(value) {
    if (value === undefined || value === null)
        return undefined;
    const text = String(value).trim().toUpperCase();
    if (!text)
        return "";
    if (!VERTICAL_VALUES.has(text))
        return null;
    return text;
}
function profileRow(json) {
    const row = json && typeof json === "object" ? json : {};
    const data = Array.isArray(row.data) ? row.data[0] : row;
    return data && typeof data === "object" ? data : {};
}
function mapWhatsappBusinessProfile(json) {
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
function mapWhatsappBusinessProfilePicture(json) {
    return mapWhatsappBusinessProfile(json).profilePictureUrl;
}
const PHOTO_FETCH_MS = 5000;
async function fetchHttpsProfileImage(url, fetchImpl = fetch) {
    const raw = String(url || "").trim();
    if (!/^https:\/\//i.test(raw))
        return null;
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== "https:")
        return null;
    try {
        const response = await fetchImpl(parsed.toString(), {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(PHOTO_FETCH_MS),
        });
        if (!response.ok)
            return null;
        const mime = String(response.headers.get("content-type") || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        if (!ALLOWED_MIME.has(mime))
            return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
            return null;
        const ext = mime.includes("png") ? "png" : "jpg";
        return { ext, bytes };
    }
    catch {
        return null;
    }
}
