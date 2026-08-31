import type { SystemLogMotivo } from "./system-connection-log.types";

/**
 * Classifica a causa raiz a partir do detalhe do probe / contexto do alvo.
 * Motivos canônicos: Traefik | Yaml | Docker | Servidor
 */
export function classifySystemLogMotivo(input: {
  detail: string;
  targetKey?: string;
  targetLabel?: string;
  downCountSameCheck?: number;
}): SystemLogMotivo {
  const detail = String(input.detail || "").toLowerCase();
  const key = String(input.targetKey || "").toLowerCase();
  const label = String(input.targetLabel || "").toLowerCase();
  const downCount = Number(input.downCountSameCheck || 0);

  if (
    /entrypoint|websecure|\bweb\b.*https|main\.ya?ml|yaml|rota(dor)?|host\(`|backend url|30211|30210/.test(
      detail,
    )
  ) {
    return "Yaml";
  }

  if (
    /docker|swarm|container|0\/1|replicas|service update|easypanel-traefik|overlay|docker-proxy/.test(
      detail,
    )
  ) {
    return "Docker";
  }

  if (
    /traefik|bad gateway|502|000|tls|schannel|certificate|acme|:443|gateway|proxy/.test(detail) ||
    key.startsWith("site_") ||
    key === "app_waba" ||
    /wabadisparos|bet\.waba|draxsistemas/.test(label)
  ) {
    if (downCount >= 3 && /(timeout|econnrefused|network|fetch failed|could not resolve)/.test(detail)) {
      return "Servidor";
    }
    if (
      /(timeout|econnrefused|enotfound|network|unreachable|could not resolve|abort)/.test(detail) &&
      downCount >= 2
    ) {
      return "Servidor";
    }
    return "Traefik";
  }

  if (/(timeout|econnrefused|enotfound|network|unreachable|could not resolve|abort|servidor|vps)/.test(detail)) {
    return "Servidor";
  }

  if (key.includes("evo") || key.includes("asaas")) {
    return "Docker";
  }

  return "Traefik";
}
