"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEvoInstanceKey = resolveEvoInstanceKey;
/** Chave técnica da instância no sistema WABA - Drax — mesma ordem de `/instancias` e do painel. */
function resolveEvoInstanceKey(inst) {
    if (!inst || typeof inst !== "object")
        return "";
    const root = inst;
    const candidate = root.instanceName ??
        root.name ??
        root.id ??
        root.instanceId ??
        root.instance ??
        "";
    return String(candidate).trim();
}
