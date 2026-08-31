# LOG — Aquecedor reconhecer instâncias habilitadas

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-instances-cache-scope`

## Sintoma

Painel mostrava várias instâncias com Aquecedor ligado, mas motor: «Menos de 2 instâncias conectadas e habilitadas (somente as suas)».

## Causas

1. **UI** usa cache `evo-instances-cache.json` + dono em `instance-owners.json`.
2. **Motor** só consultava Evolution ao vivo (timeout frequente) → 0–1 instância.
3. Escopo do motor = só `instance-owners.json`; instâncias ativadas via **API Alternativa** não entravam.

## Correção

- `listAquecedorScopedInstanceNames`: dono + ativações alternativa.
- `resolveAquecedorConnectedForOwner`: EVO live → fallback cache (igual `/instancias`).
- `analyzeAquecedorInstances`: cache quando EVO falha; mensagem com contagem no escopo.

## Validar

1. Reiniciar V02 / redeploy produção.
2. Pare e inicie Aquecedor.
3. Diagnóstico no painel ou `GET /aquecedor/diagnostico` → `instancias.eligible` ≥ 2.
