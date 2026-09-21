import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../../data-path";
import {
  callOpenAiStructured,
  type OpenAiStructuredRequest,
  type OpenAiStructuredResult,
} from "../../openai/waba-openai-responses.client";

const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const RECENT_LIMIT = 40;

export type LinkAiRewriteInput = {
  sourceText: string;
  tenantId?: string;
  flowId?: string;
  nodeId?: string;
  seed?: string;
  remember?: boolean;
};

export type LinkAiRewriteResult = {
  text: string;
  sourceText: string;
  maxChars: number;
};

type OpenAiCaller = (request: OpenAiStructuredRequest) => Promise<OpenAiStructuredResult>;

let openAiCaller: OpenAiCaller = callOpenAiStructured;
const recentMemory = new Map<string, string[]>();

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) return "";
  if (TENANT_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function memoryKey(input: { tenantId?: string; flowId?: string; nodeId?: string }): string {
  return [safeTenantId(String(input.tenantId || "")), String(input.flowId || "").trim(), String(input.nodeId || "").trim()]
    .filter(Boolean)
    .join("::");
}

function variantsPath(tenantId: string, flowId: string, nodeId: string): string | null {
  const tenant = safeTenantId(tenantId);
  const flow = String(flowId || "").replace(/[^a-zA-Z0-9._-]/g, "");
  const node = String(nodeId || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!tenant || !flow || !node) return null;
  return path.join(resolveDataDir(), "meta-whatsapp", "bots", tenant, "link-ai", `${flow}-${node}.json`);
}

export function normalizeBotAiCompare(text: string): string {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sameBotAiText(left: string, right: string): boolean {
  const a = normalizeBotAiCompare(left);
  const b = normalizeBotAiCompare(right);
  return Boolean(a) && a === b;
}

export function clipBotAiText(text: string, maxChars: number): string {
  const limit = Math.max(0, Number(maxChars) || 0);
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!limit || !value) return "";
  if (value.length <= limit) return value;
  const sliced = value.slice(0, limit);
  const breakAt = Math.max(sliced.lastIndexOf(" "), sliced.lastIndexOf("\n"));
  if (breakAt >= Math.min(8, Math.floor(limit * 0.55))) {
    return sliced.slice(0, breakAt).trim();
  }
  return sliced.trim();
}

function readStoredTexts(file: string): string[] {
  try {
    if (!existsSync(file)) return [];
    const row = JSON.parse(readFileSync(file, "utf8")) as { texts?: unknown };
    return Array.isArray(row.texts) ? row.texts.map((item) => String(item || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function listRecentLinkAiTexts(input: {
  tenantId?: string;
  flowId?: string;
  nodeId?: string;
}): string[] {
  const key = memoryKey(input);
  const memory = key ? recentMemory.get(key) || [] : [];
  const file = variantsPath(String(input.tenantId || ""), String(input.flowId || ""), String(input.nodeId || ""));
  const stored = file ? readStoredTexts(file) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const text of [...memory, ...stored]) {
    const norm = normalizeBotAiCompare(text);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(text);
  }
  return out.slice(0, RECENT_LIMIT);
}

export function rememberLinkAiText(input: {
  tenantId?: string;
  flowId?: string;
  nodeId?: string;
  text: string;
}): void {
  const text = String(input.text || "").trim();
  if (!text) return;
  const key = memoryKey(input);
  if (key) {
    const next = [text, ...(recentMemory.get(key) || [])].slice(0, RECENT_LIMIT);
    recentMemory.set(key, next);
  }
  const file = variantsPath(String(input.tenantId || ""), String(input.flowId || ""), String(input.nodeId || ""));
  if (!file) return;
  mkdirSync(path.dirname(file), { recursive: true });
  const texts = [text, ...readStoredTexts(file).filter((item) => !sameBotAiText(item, text))].slice(0, RECENT_LIMIT);
  writeFileSync(file, JSON.stringify({ texts, updatedAt: new Date().toISOString() }), "utf8");
}

export function resetLinkAiMemoryForTests(): void {
  recentMemory.clear();
  openAiCaller = callOpenAiStructured;
}

export function setLinkAiOpenAiCallerForTests(fn: OpenAiCaller | null): void {
  openAiCaller = fn || callOpenAiStructured;
}

function hasOpenAiKey(): boolean {
  return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}

function localRewrite(source: string, seed: string, attempt: number): string {
  const max = source.length;
  const phrases = [
    source,
    source.replace(/\bToque\b/gi, "Clique").replace(/\bclicando\b/gi, "tocando"),
    source.replace(/\bFale diretamente\b/gi, "Fale agora com").replace(/\bconsultor\b/gi, "especialista"),
    source.replace(/\bAcesse o\b/gi, "Abra o").replace(/\bno botão abaixo\b/gi, "no botão"),
    source.replace(/\bwhatsapp\b/gi, "WhatsApp").replace(/\bdele\b/gi, "desse contato"),
    source.replace(/\bpara abrir o link\b/gi, "e abra o endereço").replace(/\bToque no botão\b/gi, "Use o botão"),
  ];
  const unique = phrases
    .map((item, index) => clipBotAiText(item + (index && item === source ? "" : ""), max))
    .filter((item) => item && !sameBotAiText(item, source));
  if (unique.length) {
    const idx = Math.abs(hashSeed(`${seed}:${attempt}`)) % unique.length;
    return unique[idx];
  }
  if (max <= 3) return clipBotAiText(source, max);
  const trimmed = source.trim();
  const withoutLast = trimmed.replace(/[.,;:!?…]+$/u, "").trim();
  const endings = [" agora.", " já.", " aqui.", "."];
  for (const ending of endings) {
    const candidate = clipBotAiText(`${withoutLast}${ending}`, max);
    if (candidate && !sameBotAiText(candidate, source)) return candidate;
  }
  return clipBotAiText(source, max);
}

function hashSeed(value: string): number {
  let hash = 0;
  const raw = String(value || "");
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash;
}

function extractAiText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return String((value as { text?: unknown }).text || "").trim();
}

async function rewriteWithOpenAi(source: string, avoid: string[], seed: string, maxChars: number): Promise<string> {
  const result = await openAiCaller({
    instructions:
      "Você reescreve mensagens curtas de WhatsApp em português do Brasil. " +
      "Mantenha o mesmo sentido, tom e chamada à ação. Não invente dados, nomes ou links. " +
      "Não copie o texto original nem os textos proibidos. " +
      `A resposta deve ter no máximo ${maxChars} caracteres, incluindo espaços e pontuação. ` +
      "Não use aspas, markdown, prefixos nem explicações.",
    input: JSON.stringify({
      source,
      maxChars,
      avoid,
      seed,
    }),
    schemaName: "bot_link_ai_text",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string" },
      },
    },
    maxOutputTokens: 400,
    timeoutMs: 20_000,
    maxAttempts: 2,
  });
  return clipBotAiText(extractAiText(result.value), maxChars);
}

function isForbidden(text: string, avoid: string[]): boolean {
  return avoid.some((item) => sameBotAiText(item, text));
}

export async function rewriteLinkAiText(input: LinkAiRewriteInput): Promise<LinkAiRewriteResult> {
  const sourceText = String(input.sourceText || "").replace(/\s+/g, " ").trim();
  const maxChars = sourceText.length;
  if (!sourceText) {
    throw new Error("Informe o texto da mensagem para a IA.");
  }
  const recent = listRecentLinkAiTexts(input);
  const avoid = [sourceText, ...recent].filter(Boolean);
  const seed = String(input.seed || `${Date.now()}-${Math.random()}`);
  let text = "";

  if (hasOpenAiKey() || openAiCaller !== callOpenAiStructured) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        text = await rewriteWithOpenAi(sourceText, avoid, `${seed}:${attempt}`, maxChars);
      } catch {
        text = "";
      }
      if (text && !isForbidden(text, avoid)) break;
    }
  }

  if (!text || isForbidden(text, avoid)) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const local = localRewrite(sourceText, seed, attempt);
      if (local && !isForbidden(local, avoid)) {
        text = local;
        break;
      }
      if (!text) text = local;
    }
  }

  text = clipBotAiText(text || sourceText, maxChars);
  if (input.remember !== false) {
    rememberLinkAiText({
      tenantId: input.tenantId,
      flowId: input.flowId,
      nodeId: input.nodeId,
      text,
    });
  }
  return { text, sourceText, maxChars };
}

export async function rewriteLinkAiForSend(input: LinkAiRewriteInput): Promise<string> {
  try {
    const result = await rewriteLinkAiText(input);
    return result.text || String(input.sourceText || "").trim();
  } catch {
    return String(input.sourceText || "").trim();
  }
}
