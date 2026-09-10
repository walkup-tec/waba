import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";

export const GRAPH_UPLOAD_COOLDOWN_MS = 30 * 60 * 1000;

type CooldownRow = { until: number };

let memoryUntil = 0;

function cooldownPath(): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "graph-upload-cooldown.json");
}

function persistEnabled(): boolean {
  return !process.env.NODE_TEST_CONTEXT;
}

function readDiskUntil(): number {
  if (!persistEnabled()) return 0;
  const file = cooldownPath();
  if (!existsSync(file)) return 0;
  try {
    const row = JSON.parse(readFileSync(file, "utf8")) as CooldownRow;
    return Number(row.until || 0) || 0;
  } catch {
    return 0;
  }
}

function writeDiskUntil(until: number): void {
  if (!persistEnabled()) return;
  mkdirSync(path.dirname(cooldownPath()), { recursive: true });
  writeFileSync(cooldownPath(), JSON.stringify({ until } satisfies CooldownRow));
}

export function remainingMetaGraphUploadCooldownMs(now = Date.now()): number {
  const until = Math.max(memoryUntil, readDiskUntil());
  memoryUntil = until;
  return Math.max(0, until - now);
}

export function isMetaGraphUploadCooldown(now = Date.now()): boolean {
  return remainingMetaGraphUploadCooldownMs(now) > 0;
}

export function markMetaGraphUploadCooldown(now = Date.now()): void {
  memoryUntil = now + GRAPH_UPLOAD_COOLDOWN_MS;
  writeDiskUntil(memoryUntil);
}

export function metaGraphUploadCooldownMessage(now = Date.now()): string {
  const minutes = Math.max(1, Math.ceil(remainingMetaGraphUploadCooldownMs(now) / 60_000));
  return (
    "A Meta ainda bloqueia o upload deste aplicativo (código 4). " +
    `Não tente de novo agora — a cota só volta se ninguém abrir Conexão nem clicar em Atualizar da Meta. Aguarde cerca de ${minutes} min.`
  );
}

export function clearMetaGraphUploadCooldownForTests(): void {
  memoryUntil = 0;
}
