# LOG: Admin Campanhas — espaçamento ícone + API Oficial/Alternativa

## Pedido

Na tela Admin · Campanhas (master), os rótulos `ícone + API Oficial` e `ícone + API Alternativa` no hint de escopo estavam com espaço excessivo entre ícone e texto.

## Causa

- `.panel-header span` aplicava estilo a **todos** os `span` aninhados, incluindo `.waba-api-label` e `.waba-api-label-text`.
- Labels inline no hint não tinham regra compacta (`gap` menor, `nowrap`, `justify-content: flex-start`).

## Solução

1. `.panel-header > span` / `> .muted` — só filhos diretos; zerar padding em labels API dentro do header.
2. `#admin-campanhas-scope-hint .waba-api-label` — `gap: 4px`, ícones 14px, `white-space: nowrap`.
3. Classe `waba-api-label--inline` + `renderWabaApiKindLabelHtml(..., { inline: true })` no hint master/operacional.

Marker: `DEPLOY-2026-06-26-admin-campanhas-api-label-spacing`

## Validar

Admin · Campanhas como master: hint com ícones colados ao texto "API Oficial" / "API Alternativa".
