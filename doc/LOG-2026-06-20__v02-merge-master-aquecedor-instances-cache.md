# V02 merge master — aquecedor instances cache scope

**Data:** 2026-06-20  
**Branch:** `v02` → `origin/v02`  
**Serviço Easypanel:** `waba_disparador_v02`

## Commit

Merge `origin/master` (até `e4fe82b`) em `v02`.

Marker esperado: `DEPLOY-2026-06-20-aquecedor-instances-cache-scope`

## Validação

```text
GET http://localhost:3012/version-02/health
```

Ou URL V02 em produção após redeploy.

## Inclui do master

- Fix aquecedor escopo + cache EVO (`2ff29ae`)
- Marker deploy (`32c8b6b`)
- Comprar números picker/layout, fazenda pool, etc. (commits intermediários do master)
