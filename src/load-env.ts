import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";

/**
 * Carrega variáveis por ambiente:
 * - WABA_ENV=v01 → .env.v01
 * - WABA_ENV=v02 → .env.v02
 * - (default)    → .env
 *
 * WABA_ENV pode vir do ambiente do SO ou do próprio ficheiro carregado.
 */
const presetEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();

function resolveEnvFileName(wabaEnv: string): string {
  if (wabaEnv === "v01") return ".env.v01";
  if (wabaEnv === "v02") return ".env.v02";
  return ".env";
}

function loadEnvFile(fileName: string): boolean {
  const envPath = path.join(process.cwd(), fileName);
  if (!existsSync(envPath)) return false;
  config({ path: envPath, override: true });
  return true;
}

const primary = resolveEnvFileName(presetEnv);
if (!loadEnvFile(primary)) {
  if (presetEnv) {
    console.warn(`[env] ${primary} não encontrado em ${process.cwd()}; tentando .env padrão.`);
  }
  loadEnvFile(".env");
}

export const WABA_ENV = String(process.env.WABA_ENV || presetEnv || "production")
  .trim()
  .toLowerCase();
