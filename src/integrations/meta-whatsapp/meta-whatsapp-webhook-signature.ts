import { createHmac, timingSafeEqual } from "node:crypto";

export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readHubSignature256(header: unknown): string | null {
  const raw = String(header || "").trim();
  if (!raw) return null;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(raw);
  return match ? match[1].toLowerCase() : null;
}

export function computeMetaHubSignatureHex(appSecret: string, rawBody: Buffer): string {
  return createHmac("sha256", appSecret).update(rawBody).digest("hex");
}

export function isValidMetaHubSignature(input: {
  appSecret: string;
  rawBody: Buffer;
  header: unknown;
}): boolean {
  const secret = String(input.appSecret || "");
  if (!secret || !input.rawBody || !Buffer.isBuffer(input.rawBody)) return false;
  const received = readHubSignature256(input.header);
  if (!received) return false;
  const expected = computeMetaHubSignatureHex(secret, input.rawBody);
  return timingSafeEqualString(expected, received);
}
