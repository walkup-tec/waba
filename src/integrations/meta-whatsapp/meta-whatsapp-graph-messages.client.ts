import { createHmac } from "node:crypto";
import { readMetaAppSecret, readMetaGraphBase, readMetaGraphVersion } from "./meta-config";
import { classifyMetaGraphError, isMetaGraphRateLimitCode } from "./meta-whatsapp-graph-errors";

export type MetaGraphMessagesResult = {
  ok: boolean;
  status: number;
  json: any;
  body: string;
  timeout: boolean;
  kind: "permanent" | "transient";
  graphCode: string | null;
  wamid: string | null;
  attempts: number;
};

export type MetaGraphMessagesCaller = (input: {
  token: string;
  phoneNumberId: string;
  body: Record<string, unknown>;
}) => Promise<MetaGraphMessagesResult>;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function readGraphCode(json: unknown): string | null {
  const err = (json as { error?: { code?: unknown } } | null)?.error;
  const code = err?.code;
  return code === undefined || code === null ? null : String(code);
}

function readWamid(json: unknown): string | null {
  const messages = (json as { messages?: Array<{ id?: string }> } | null)?.messages;
  const id = messages && messages[0] ? String(messages[0].id || "").trim() : "";
  return id || null;
}

export async function postMetaCloudMessage(input: {
  token: string;
  phoneNumberId: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<MetaGraphMessagesResult> {
  const token = String(input.token || "").trim();
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  if (!token) throw new Error("Token da Meta não informado.");
  if (!phoneNumberId) throw new Error("phone_number_id ausente.");

  const endpoint = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${phoneNumberId}/messages`;
  const appSecret = readMetaAppSecret();
  const proof = appSecret ? createHmac("sha256", appSecret).update(token).digest("hex") : "";
  const url = proof ? `${endpoint}?appsecret_proof=${proof}` : endpoint;
  const fetchFn = input.fetchImpl || fetch;

  let last: MetaGraphMessagesResult = {
    ok: false,
    status: 0,
    json: null,
    body: "",
    timeout: false,
    kind: "transient",
    graphCode: null,
    wamid: null,
    attempts: 0,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let timeout = false;
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.body),
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
      const kind = classifyMetaGraphError({
        status: response.status,
        graphCode,
      });
      last = {
        ok: response.ok,
        status: response.status,
        json,
        body: text,
        timeout: false,
        kind,
        graphCode,
        wamid: readWamid(json),
        attempts: attempt,
      };
      if (response.ok) return last;
      // Rate limit (4/17/341): não retry imediato — esgota a cota da app.
      if (kind === "permanent" || isMetaGraphRateLimitCode(graphCode) || attempt >= 3) return last;
      await sleep(Math.floor(350 * Math.pow(2, attempt - 1) + Math.random() * 180));
    } catch (error) {
      timeout = String((error as { name?: string })?.name || "") === "AbortError";
      last = {
        ok: false,
        status: 0,
        json: null,
        body: "",
        timeout: timeout,
        kind: "transient",
        graphCode: null,
        wamid: null,
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
