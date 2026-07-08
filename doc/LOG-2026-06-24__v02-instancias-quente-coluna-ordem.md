# LOG — V02 coluna Quente primeira coluna (paridade produção)

## Contexto

Mesma correção de produção: coluna **Quente** como primeira coluna na tabela Instâncias.

## Ações

- `index.html` sincronizado com `dist/index.html` (Quente → avatar → Número…)
- `src/services/aquecedor-instance-warmth.service.ts` preenchido (estava vazio)
- `src/index.ts` — `/instancias/uso-config` com `warmthLevel`/`warmthLabel`
- Marker: `DEPLOY-2026-06-24-instancias-quente-coluna-ordem`
- Branch `v02` → push `origin/v02`

## Validar V02

`http://localhost:3012/version-02/` → Instâncias → Quente na primeira coluna.
