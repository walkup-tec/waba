import { BASE_PATH } from "./base-path";

export type WabaContainerServiceId =
  | "waba_disparador"
  | "waba_disparador_v01"
  | "waba_disparador_v02"
  | "local"
  | "unknown";

const KNOWN_SERVICES = new Set<WabaContainerServiceId>([
  "waba_disparador",
  "waba_disparador_v01",
  "waba_disparador_v02",
]);

/** Identifica o serviço Easypanel/Docker (ex.: waba_disparador = produção master). */
export function resolveWabaContainerServiceId(): WabaContainerServiceId {
  const explicit = String(process.env.WABA_CONTAINER_SERVICE || "")
    .trim()
    .toLowerCase();
  if (KNOWN_SERVICES.has(explicit as WabaContainerServiceId)) {
    return explicit as WabaContainerServiceId;
  }

  const wabaEnv = String(process.env.WABA_ENV || "")
    .trim()
    .toLowerCase();
  if (wabaEnv === "v01") return "waba_disparador_v01";
  if (wabaEnv === "v02") return "waba_disparador_v02";

  const runtimeMode = String(process.env.RUNTIME_MODE || "production").toLowerCase();
  if (runtimeMode === "development") return "local";

  if (!BASE_PATH && (!wabaEnv || wabaEnv === "production")) {
    return "waba_disparador";
  }

  return "unknown";
}

/** Overlay de deploy só no container de produção master (waba_disparador). */
export function isWabaDisparadorProductionContainer(): boolean {
  return resolveWabaContainerServiceId() === "waba_disparador";
}
