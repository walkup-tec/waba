import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export class MetaTokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaTokenCryptoError";
  }
}

function readEncryptionKey(): Buffer {
  const raw = String(process.env.META_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new MetaTokenCryptoError("META_TOKEN_ENCRYPTION_KEY não configurada.");
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new MetaTokenCryptoError("META_TOKEN_ENCRYPTION_KEY inválida.");
  }
  if (key.length !== KEY_LENGTH) {
    throw new MetaTokenCryptoError(
      "META_TOKEN_ENCRYPTION_KEY deve ter 32 bytes (64 hex ou Base64).",
    );
  }
  return key;
}

/**
 * Cifra token Graph (AES-256-GCM). Formato: v1:ivB64:tagB64:cipherB64
 * A chave permanece só em env (não no banco). Envelope estável para troca futura a KMS.
 */
export function encryptMetaToken(plaintext: string): string {
  const value = String(plaintext || "").trim();
  if (!value) {
    throw new MetaTokenCryptoError("Token vazio não pode ser cifrado.");
  }
  const key = readEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    ":",
  );
}

export function decryptMetaToken(payload: string): string {
  const packed = String(payload || "").trim();
  const parts = packed.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new MetaTokenCryptoError("Envelope de token inválido.");
  }
  const key = readEncryptionKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
