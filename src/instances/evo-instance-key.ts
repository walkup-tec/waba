/** Chave técnica da instância no sistema WABA - Drax — mesma ordem de `/instancias` e do painel. */
export function resolveEvoInstanceKey(inst: unknown): string {
  if (!inst || typeof inst !== "object") return "";
  const root = inst as Record<string, unknown>;
  const candidate =
    root.instanceName ??
    root.name ??
    root.id ??
    root.instanceId ??
    root.instance ??
    "";
  return String(candidate).trim();
}
