import { createHmac } from "node:crypto";
import { readMetaAppSecret, readMetaGraphBase, readMetaGraphVersion } from "./meta-config";
import { classifyMetaGraphError } from "./meta-whatsapp-graph-errors";

export type MetaGraphJsonResult = {
  ok: boolean;
  status: number;
  json: any;
  body: string;
  timeout: boolean;
  kind: "permanent" | "transient";
  graphCode: string | null;
  attempts: number;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function readGraphCode(json: unknown): string | null {
  const err = (json as { error?: { code?: unknown } } | null)?.error;
  const code = err?.code;
  return code === undefined || code === null ? null : String(code);
}

function withProof(endpoint: string, token: string): string {
  const appSecret = readMetaAppSecret();
  if (!appSecret) return endpoint;
  const proof = createHmac("sha256", appSecret).update(token).digest("hex");
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}appsecret_proof=${proof}`;
}

export async function callMetaGraphJson(input: {
  token: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<MetaGraphJsonResult> {
  const token = String(input.token || "").trim();
  const path = String(input.path || "").trim().replace(/^\/+/, "");
  if (!token) throw new Error("Token da Meta não informado.");
  if (!path) throw new Error("Path da API da Meta não informado.");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  const endpoint = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${path}${qs ? `?${qs}` : ""}`;
  const url = withProof(endpoint, token);
  const fetchFn = input.fetchImpl || fetch;

  let last: MetaGraphJsonResult = {
    ok: false,
    status: 0,
    json: null,
    body: "",
    timeout: false,
    kind: "transient",
    graphCode: null,
    attempts: 0,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetchFn(url, {
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
      const graphCode = readGraphCode(json);
      const kind = classifyMetaGraphError({ status: response.status, graphCode });
      last = {
        ok: response.ok,
        status: response.status,
        json,
        body: text,
        timeout: false,
        kind,
        graphCode,
        attempts: attempt,
      };
      if (response.ok) return last;
      if (kind === "permanent" || attempt >= 3) return last;
      await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
    } catch (error) {
      const timeout = String((error as { name?: string })?.name || "") === "AbortError";
      last = {
        ok: false,
        status: 0,
        json: null,
        body: "",
        timeout: timeout,
        kind: "transient",
        graphCode: null,
        attempts: attempt,
      };
      if (attempt >= 3) return last;
      await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return last;
}
