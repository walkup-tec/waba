# Correção: foguinhos de aquecimento na aba Instâncias

## Contexto do pedido

Após deploy Device Cloud, a coluna Quente ficou com três fogos cinza em `soma-9224`, `walkup` e `1261`. Status = **conectado** (não Preparando). Usuário pediu correção.

## Comandos / ações

- Conferência de `GET /health` (marker Device Cloud, não o patch do botão Alternativa).
- Leitura de `uso-config`, `computeInstanceWarmthLevel`, `getInstanceUsage`.
- Worktree `fix-warmth-chip-lookup` a partir de `origin/master`.
- `npm run build`.

## Solução implementada

1. `GET /instancias/uso-config` calcula warmth só das instâncias do usuário (antes varria o mapa inteiro e estourava o timeout de 10s → UI caía no default `warmthLevel = 0` com Status conectado).
2. Nível de aquecimento por **chip**: herda lifecycle/histórico de aliases (`9224` → `soma-9224`); fase Preparando não zera foguinho.
3. UI: lookup case-insensitive e por sufixo numérico; timeout do uso-config 25s.

## Arquivos criados/alterados

- `src/index.ts`, `src/services/aquecedor-instance-warmth.service.ts`, `src/deploy-marker.ts`
- `index.html`, `dist/index.html`, `dist/index.js`, `dist/deploy-marker.js`, `dist/services/aquecedor-instance-warmth.service.js`
- Este LOG; `doc/memoria.md`

## Como validar

Após deploy: `GET /health` com `DEPLOY-2026-08-20-warmth-chip-lookup`. Na aba Instâncias, `walkup`/`1261`/`soma-9224` devem mostrar fogos laranja conforme o histórico (não três cinza). Tooltip ≠ “Não aquecido” se o chip já aqueceu.

Validação funcional depende de produção após push/redeploy.

## Observações de segurança

Sem `sendText`. Sem alteração Evolution.

## Palavras-chave

foguinhos, warmthLevel, uso-config, soma-9224, chip identity, timeout
