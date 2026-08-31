# LOG — Substituir window.confirm por modal stylizado

**Data:** 2026-06-23

## Contexto

Botão «Refazer seleção» usava `window.confirm` (alerta nativo do navegador).

## Solução

- Modal reutilizável `#waba-confirm-overlay` + `showWabaConfirm()` / `closeWabaConfirm()`.
- «Refazer seleção» e «Pular validação» (wizard QR) migrados para o modal.
- Removidos todos os `window.confirm` do `index.html`.

## Validação

`node agent-tools/check-index-scripts.mjs` → OK.

## Palavras-chave

`showWabaConfirm`, `waba-confirm-overlay`, `window.confirm`
