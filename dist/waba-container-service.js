"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWabaContainerServiceId = resolveWabaContainerServiceId;
exports.isWabaDisparadorProductionContainer = isWabaDisparadorProductionContainer;
const base_path_1 = require("./base-path");
const KNOWN_SERVICES = new Set([
    "waba_disparador",
    "waba_disparador_v01",
    "waba_disparador_v02",
]);
/** Identifica o serviço Easypanel/Docker (ex.: waba_disparador = produção master). */
function resolveWabaContainerServiceId() {
    const explicit = String(process.env.WABA_CONTAINER_SERVICE || "")
        .trim()
        .toLowerCase();
    if (KNOWN_SERVICES.has(explicit)) {
        return explicit;
    }
    const wabaEnv = String(process.env.WABA_ENV || "")
        .trim()
        .toLowerCase();
    if (wabaEnv === "v01")
        return "waba_disparador_v01";
    if (wabaEnv === "v02")
        return "waba_disparador_v02";
    const runtimeMode = String(process.env.RUNTIME_MODE || "production").toLowerCase();
    if (runtimeMode === "development")
        return "local";
    if (!base_path_1.BASE_PATH && (!wabaEnv || wabaEnv === "production")) {
        return "waba_disparador";
    }
    return "unknown";
}
/** Overlay de deploy só no container de produção master (waba_disparador). */
function isWabaDisparadorProductionContainer() {
    return resolveWabaContainerServiceId() === "waba_disparador";
}
