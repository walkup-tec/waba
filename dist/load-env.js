"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_ENV = void 0;
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Carrega variáveis por ambiente:
 * - WABA_ENV=v01 → .env.v01
 * - WABA_ENV=v02 → .env.v02
 * - (default)    → .env
 *
 * WABA_ENV pode vir do ambiente do SO ou do próprio ficheiro carregado.
 */
const presetEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();
function resolveEnvFileName(wabaEnv) {
    if (wabaEnv === "v01")
        return ".env.v01";
    if (wabaEnv === "v02")
        return ".env.v02";
    return ".env";
}
function loadEnvFile(fileName) {
    const envPath = path_1.default.join(process.cwd(), fileName);
    if (!(0, fs_1.existsSync)(envPath))
        return false;
    (0, dotenv_1.config)({ path: envPath, override: true });
    return true;
}
const primary = resolveEnvFileName(presetEnv);
if (!loadEnvFile(primary)) {
    if (presetEnv) {
        console.warn(`[env] ${primary} não encontrado em ${process.cwd()}; tentando .env padrão.`);
    }
    loadEnvFile(".env");
}
exports.WABA_ENV = String(process.env.WABA_ENV || presetEnv || "production")
    .trim()
    .toLowerCase();
