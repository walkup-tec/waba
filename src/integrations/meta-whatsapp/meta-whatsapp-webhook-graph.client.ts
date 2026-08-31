import { createHmac } from "node:crypto";
import { readMetaAppSecret, readMetaGraphBase, readMetaGraphVersion } from "./meta-config";

export type MetaGraphCallResult = {
  ok: boolean;
  status: number;
  json: any;
  body: string;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cliente Graph mínimo para inscrição de webhook.
 * Mesmo contrato de timeout/retry do helper existente em src/index.ts (não extraído de lá).
 */
export async function callMetaGraphForWebhook(input: {
  token: string;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
}): Promise<MetaGraphCallResult> {
  const token = String(input.token || "").trim();
  const path = String(input.path || "").trim().replace(/^\/+/, "");
  if (!token) throw new Error("Token da Meta não informado.");
  if (!path) throw new Error("Path da API da Meta não informado.");
  const endpoint = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${path}`;
  const appSecret = readMetaAppSecret();
  const proof = appSecret
    ? createHmac("sha256", appSecret).update(token).digest("hex")
    : "";
  const url = proof ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}appsecret_proof=${proof}` : endpoint;

  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (response.ok) {
        return { ok: true, status: response.status, json, body: text };
      }
      lastStatus = response.status;
      lastBody = text;
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt >= 3) {
        return { ok: false, status: response.status, json, body: text };
      }
      await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { ok: false, status: lastStatus, json: null, body: lastBody };
}
