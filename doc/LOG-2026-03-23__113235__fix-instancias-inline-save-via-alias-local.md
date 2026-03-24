# LOG - fix-instancias-inline-save-via-alias-local

## Contexto

Problema persistente na edicao inline do nome da instancia: check (`✓`) nao salvava nem retornava ao estado inicial.

## Causa raiz

O fluxo anterior dependia de renomear a instancia diretamente na EVO (`/instancias/:name/renomear`), mas o backend retornava erro (`404` na EVO para rename em alguns cenarios), o que impedia a confirmacao do rename inline.

## Solucao implementada (assertiva)

- Modo de salvamento alterado para **alias local persistente**, sem depender do rename da EVO.
- Backend:
  - novo armazenamento local em arquivo: `data/instance-aliases.json`
  - novo endpoint: `POST /instancias/:name/alias`
  - endpoint `/instancias` agora retorna `instanceAlias` por instancia
- Frontend:
  - edicao inline da coluna `Nome da Instância` salva via `/instancias/:name/alias`
  - exibicao na coluna passa a usar `instanceAlias` quando existir (fallback para nome real)
  - fluxo de retorno ao estado inicial mantido apos sucesso

## Validacao executada

- Build: `npm run build` (ok)
- Reinicio do servidor (ok)
- Teste direto no endpoint:
  - `POST /instancias/5401/alias` com alias `DC - 5401` -> status `200`
- Confirmacao no payload `/instancias`:
  - instancia `5401` retornou `instanceAlias: "DC - 5401"`

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.js` (build)
- `dist/index.html` (build)

## Palavras-chave

- alias-instancia
- inline-rename-sem-evo-rename
- instance-aliases-json
