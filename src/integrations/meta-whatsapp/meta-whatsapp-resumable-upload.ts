import { readMetaGraphBase, readMetaGraphVersion } from "./meta-config";
import { callMetaGraphJson } from "./meta-whatsapp-graph.client";

export type MetaResumableUploadInput = {
  token: string;
  appId: string;
  fileName: string;
  mime: string;
  bytes: Buffer;
};

function toUploadSessionPath(id: string): string {
  const raw = String(id || "").trim();
  if (!raw) return "";
  return raw.startsWith("upload:") ? raw : `upload:${raw}`;
}

function normalizeUploadMime(mime: string): string {
  const raw = String(mime || "").trim().toLowerCase().split(";")[0].trim();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  if (raw === "image/x-png") return "image/png";
  return raw;
}

function sanitizeUploadName(fileName: string, mime: string): string {
  const type = normalizeUploadMime(mime);
  const ext =
    type === "image/png" ? "png" : type === "video/mp4" ? "mp4" : type === "application/pdf" ? "pdf" : "jpg";
  return `header.${ext}`;
}

export async function uploadMetaResumableImage(
  input: MetaResumableUploadInput,
): Promise<{ handle: string }> {
  const token = String(input.token || "").trim();
  const appId = String(input.appId || "").trim();
  if (!token || !appId) throw new Error("Upload da Meta sem app ou token.");
  const started = await callMetaGraphJson({
    token,
    method: "POST",
    path: `${appId}/uploads`,
    query: {
      file_name: sanitizeUploadName(input.fileName, input.mime),
      file_length: String(input.bytes.length),
      file_type: normalizeUploadMime(input.mime),
    },
  });
  const sessionId = toUploadSessionPath(String(started.json?.id || "").trim());
  if (!started.ok || !sessionId) {
    throw new Error(
      `upload-session ${started.status}${started.graphCode ? ` ${started.graphCode}` : ""}`.trim(),
    );
  }
  const url = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${sessionId}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        file_offset: "0",
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(input.bytes),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: { h?: unknown } | null = null;
    try {
      json = text ? (JSON.parse(text) as { h?: unknown }) : null;
    } catch {
      json = null;
    }
    const handle = String(json?.h || "").trim();
    if (!response.ok || !handle) {
      const graphCode = String((json as { error?: { code?: unknown } } | null)?.error?.code || "").trim();
      throw new Error(graphCode ? `upload-binary ${response.status} ${graphCode}` : "A Meta não concluiu o upload da foto.");
    }
    return { handle };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function publishMetaPageProfilePicture(input: {
  token: string;
  pageId: string;
  fileName: string;
  mime: string;
  bytes: Buffer;
}): Promise<{ photoId: string }> {
  const token = String(input.token || "").trim();
  const pageId = String(input.pageId || "").trim();
  if (!token || !pageId) throw new Error("Upload da foto da página sem id ou token.");
  const url = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${pageId}/photos`;
  const form = new FormData();
  form.append("published", "true");
  form.append(
    "source",
    new Blob([new Uint8Array(input.bytes)], { type: input.mime }),
    input.fileName,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    const text = await response.text();
    let json: { id?: unknown } | null = null;
    try {
      json = text ? (JSON.parse(text) as { id?: unknown }) : null;
    } catch {
      json = null;
    }
    const photoId = String(json?.id || "").trim();
    if (!response.ok || !photoId) {
      const graphCode = String((json as { error?: { code?: unknown } } | null)?.error?.code || "").trim();
      throw new Error(graphCode ? `page-photo ${response.status} ${graphCode}` : "A Meta não publicou a foto na página.");
    }
    const pictured = await callMetaGraphJson({
      token,
      method: "POST",
      path: `${pageId}/picture`,
      body: { photo: photoId },
    });
    if (!pictured.ok) {
      throw new Error("A Meta não definiu a foto de perfil da página.");
    }
    return { photoId };
  } finally {
    clearTimeout(timeoutId);
  }
}
