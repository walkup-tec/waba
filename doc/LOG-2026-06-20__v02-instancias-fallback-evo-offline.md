# LOG — V02 instâncias vazias (Evolution offline)

**Data:** 2026-06-20

## Problema
Aba Instâncias mostrava 0 exibidas com "Atualizando..." — Evolution API inacessível do PC local (`ETIMEDOUT 72.60.51.127:443`).

## Causas
1. EVO remota timeout (rede/VPS).
2. Frontend abortava `/instancias` em 8s antes do backend responder.
3. Sem fallback — lista ficava vazia.

## Correções
- `/instancias`: se EVO falhar, retorna instâncias do `instance-owners.json` (+ cache `evo-instances-cache.json`) com `degraded: true`.
- Cache gravado quando EVO responde OK.
- Frontend: timeout `/instancias` → 50s; exibe aviso quando `degraded`.
- EVO list: fail-fast 12s (1 retry) antes do fallback.

## Validação walkup@walkuptec.com.br
- `GET /instancias` → `total=12`, `degraded=true`, nomes soma/walkup/drax/...

## Reteste
Ctrl+F5 → Aquecedor → Instâncias. Deve listar ~12 instâncias (status unknown se EVO offline).
