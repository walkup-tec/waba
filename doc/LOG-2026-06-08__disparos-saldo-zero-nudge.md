# LOG — Disparos saldo zero nudge

**Data:** 2026-06-08  
**Pedido:** lembrete visual pulsante quando saldo de envios disponível = 0.

## Contexto aberto
- Tela assinante `tab-disparos` com resumo lateral mostrando "Ainda disponíveis: 0".

## Alterações
- `index.html` (copiado para `dist/` via build):
  - CSS: `.is-depleted` no card disponíveis, animações pulse, banner topo, card lateral, overlay em `.disparos-config-panel` com `body.disparos-saldo-zero`.
  - HTML: `#disparos-credits-top-nudge`, `#disparos-credits-nudge`.
  - JS: `canUserBuyDisparosCredits()`, `goToDisparosAddCredits()`, `syncDisparosCreditsEmptyNudge()`; chamada em `syncDisparosResumoSide()` e `loadDisparosCredits()` (cache limpo).
  - Listeners nos botões de nudge.

## Comandos
- `npm run build` — OK.

## Validação pendente
- F5 em `http://localhost:3012/version-02/` com assinante saldo 0 → ver pulse + CTA.
- Clicar "Adicionar créditos" → aba contratação.
- Staff sem menu `disparos-lancamento` não deve ver nudge.

## Próximos passos
- Commit/deploy se aprovado pelo usuário.
- Atualizar `src/deploy-marker.ts` no deploy.
