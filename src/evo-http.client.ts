import http from "node:http";
import https from "node:https";

export type EvoHttpResult = {
  ok: boolean;
  status: number;
  body: string;
  json: unknown | null;
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const defaultEvoHttpTimeoutMs = (): number => {
  const raw = Number(process.env.EVO_HTTP_TIMEOUT_MS ?? 45000);
  return Number.isFinite(raw) && raw >= 5000 ? Math.round(raw) : 45000;
};

const parseJson = (text: string): unknown | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export const isEvoTlsInsecure = (): boolean => {
  const flag = String(process.env.EVO_TLS_INSECURE ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
  const base = String(process.env.EVO_API_URL ?? "").trim().toLowerCase();
  return runtime === "development" && base.startsWith("https://");
};

const shouldRetryEvoRequest = (result: EvoHttpResult): boolean => {
  if (result.ok) return false;
  if (result.status === 0) return true;
  if (result.status >= 500) return true;
  return false;
};

function evoHttpRequestOnce(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  options: {
    apiKey: string;
    body?: Record<string, unknown>;
    timeoutMs?: number;
  },
): Promise<EvoHttpResult> {
  const timeoutMs = Math.max(5000, Math.round(Number(options.timeoutMs ?? defaultEvoHttpTimeoutMs())));
  const bodyText =
    options.body && Object.keys(options.body).length > 0
      ? JSON.stringify(options.body)
      : "";

  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({
        ok: false,
        status: 0,
        body: "",
        json: null,
        error: error instanceof Error ? error.message : "URL da Evolution inválida.",
      });
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const headers: Record<string, string> = {
      apikey: options.apiKey,
      "Content-Type": "application/json",
    };
    if (bodyText) {
      headers["Content-Length"] = String(Buffer.byteLength(bodyText));
    }

    const requestOptions: https.RequestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers,
      timeout: timeoutMs,
      ...(isHttps && isEvoTlsInsecure() ? { rejectUnauthorized: false } : {}),
    };

    const req = lib.request(requestOptions, (res) => {
      req.setTimeout(0);
      res.setTimeout(0);

      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          body: text,
          json: parseJson(text),
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        body: "",
        json: null,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    if (bodyText) req.write(bodyText);
    req.end();
  });
}

export function evoHttpRequest(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  options: {
    apiKey: string;
    body?: Record<string, unknown>;
    timeoutMs?: number;
    retries?: number;
  },
): Promise<EvoHttpResult> {
  const maxAttempts = Math.max(1, Math.min(5, Math.round(Number(options.retries ?? 1))));
  const timeoutMs = options.timeoutMs ?? defaultEvoHttpTimeoutMs();

  return (async () => {
    let last: EvoHttpResult = {
      ok: false,
      status: 0,
      body: "",
      json: null,
      error: "Evolution API sem resposta.",
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      last = await evoHttpRequestOnce(url, method, {
        apiKey: options.apiKey,
        body: options.body,
        timeoutMs,
      });
      if (!shouldRetryEvoRequest(last) || attempt >= maxAttempts) {
        return last;
      }
      await sleep(350 * attempt);
    }

    return last;
  })();
}
