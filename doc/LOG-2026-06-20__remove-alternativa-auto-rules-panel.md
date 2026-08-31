# LOG — Remover painel "Envio automático (API Alternativa)"

**Data:** 2026-06-20  
**Pedido:** Tirar da tela o bloco "Envio automático (API Alternativa)".

## Alterações

- `index.html` — removida seção `#dis-alternativa-auto-rules` (título + lista de regras).
- `dist/index.html` — mesmo ajuste (deploy usa dist prebuilt).
- JS `applyDisparoEvoAlternativaLayout()` — removido toggle `rulesPanel.hidden` (elemento não existe mais).

## Pendências

- Redeploy Easypanel `waba_disparador` após push (marker `DEPLOY-2026-06-20-remove-alt-auto-rules-panel`).
- CSS `.alt-dispatch-rules-panel` permanece órfão (sem impacto visual).
