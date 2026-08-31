# LOG — V02 push comprar números stats cores

**Data:** 2026-06-20  
**Contexto:** Usuário reportou que alterações (layout Comprar números, cores stats, fazenda) não apareciam no deploy V02.

## Causa
- Easypanel `waba_disparador_v02` deploya branch **`v02`**, não `master`.
- UI já estava na árvore `v02`, mas `deployMarker` ainda era `aquecedor-instances-cache-scope` — build no painel não refletia release recente.

## Ação
- Branch `v02`: atualizado `src/deploy-marker.ts` → `DEPLOY-2026-06-20-comprar-numeros-stats-cores`
- `npm run build`
- Commit + push: `7bb9b8a` → `origin/v02`

## Validação pós-redeploy
- Easypanel: título deploy `[ba5573d] deploy: v02 stats cores comprar numeros | DEPLOY-2026-06-20-comprar-numeros-stats-cores`
- `GET /health` → `deployMarker: DEPLOY-2026-06-20-comprar-numeros-stats-cores`
- UI: cards Comprados (azul) / Ativados (âmbar) / Disponíveis (verde)

## Pendência
- Usuário dispara redeploy manual no Easypanel (`waba_disparador_v02`).
