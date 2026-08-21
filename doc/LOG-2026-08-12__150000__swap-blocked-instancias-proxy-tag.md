# LOG — Troca de bloqueados no + Instâncias + tag Proteção ativa

## Contexto

Campanha (ex.: Vem Card 01) pausava com 50% offline (`drax-oficial`, `proxy-2477` vermelhos) mesmo após «+ Instâncias», porque os bloqueados **permaneciam** na seleção. Tag «Proteção ativa» sumia quando algum selecionado offline não tinha proxy confirmada.

## Solução

1. `POST /disparos/campanhas/:id/instancias`: para cada número **adicionado**, remove 1 bloqueado/offline da seleção (troca 1:1).
2. Proxy: `prepare` nos novos; `disable` nos removidos.
3. `computeCampaignInstancesToAdd` recalculado para o modelo de troca (ex.: 2/4 offline → adiciona 1).
4. `proxyProtectionActive`: confirma proxy só nas instâncias **conectadas** da campanha.

## Arquivos

- `src/index.ts`
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-12-swap-blocked-proxy-tag`
- `dist/index.js`

## Validar

1. Redeploy + `/health` com marker `DEPLOY-2026-08-12-swap-blocked-proxy-tag`.
2. Campanha com 2 verdes + 2 vermelhos → «+ Instâncias» → 1 vermelho sai, 1 novo entra; Proxy no novo; campanha pode ativar.
3. Com proxy ligada nos conectados → tag «Proteção ativa» visível.

## Palavras-chave

`+ Instâncias`, `swap blocked`, `Proteção ativa`, `Proxy Brasil`, `50% desconectadas`
