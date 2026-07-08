# LOG — 2026-07-08 — Bets: ocultar botão API Alternativa no menu lateral

## Pedido
Assinantes segmento **Bets** não podem ver o botão **API Alternativa** no menu lateral (faixa de ambiente + item disparo-evo).

## Causa
CSS `body.waba-ui-production .integration-env-btn[data-integration-env="alternativa"] { display: inline-flex }` sobrescrevia o atributo `hidden` do JS.

## Correção (`index.html`)
- Regra de exibição só quando **não** `waba-subscriber-bets-segment`
- CSS `display: none !important` para alternativa + `disparo-evo` (desktop e mobile drawer)
- `syncDisparosPricingBoardForSegment()` esconde nós via `hidden` + `style.display`
- `syncIntegrationEnvAccess()` força `display: none` no botão Alternativa para Bets
- `initUiProfile()` chama `syncDisparosPricingBoardForSegment()` ao final

## Validar
Login assinante Bets → Ctrl+F5 → menu lateral sem **API Alternativa**.

## Ajuste (13:40)
Regra `body.waba-ui-production .menu-group-items .tab-button.waba-prod-only { display:inline-flex !important }` vencia o `hidden`. Fix: classe `menu-permission-denied` (já existente no CSS) + especificidade maior em `waba-subscriber-bets-segment` / `waba-disparo-evo-menu-hidden`.
