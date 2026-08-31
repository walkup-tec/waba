# Fix — API Alternativa voltou no menu Bets (regressão pós-restore index.html)

## Causa

`git checkout index.html` removeu regras de segmento Bets. CSS `body.waba-ui-production .integration-env-btn[alternativa] { display: inline-flex }` vencia `hidden` do JS.

## Correção restaurada

- CSS `:not(.waba-subscriber-bets-segment)` + `display: none !important` para faixa e menu `disparo-evo`
- `normalizeIntegrationEnv` / `selectDisparosApiKind` bloqueiam alternativa para Bets
- `enforceBetsSubscriberIntegrationEnv()` + `syncIntegrationEnvAccess` sem alternativa
- `initUiProfile` não restaura `alternativa` do localStorage para Bets
- Toast ao clicar Alternativa (Bets)

## Validar

Login assinante Bets → Ctrl+F5 → sem botão **API Alternativa** na faixa nem no menu lateral.
