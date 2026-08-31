# Aquecedor — Salvar configurações 1 clique (regressão)

## Problema

Botão **Salvar configurações** no Aquecedor exigia dois cliques ou parecia não fazer nada (botão voltava ao estado inicial).

## Causas

1. **Regressão:** `saveAquecedorConfig()` retornava no 1º clique se `!aquecedorEditMode` — só expandia painel sem salvar.
2. **Blur vs click:** foco em input numérico do expediente cancelava o 1º clique no botão.
3. **Expediente pendente:** usuário preenchia dias/horas mas não clicava "Adicionar lote" — save falhava silenciosamente na validação ou não incluía o lote.
4. **Auto-refresh:** `loadAquecedorConfig()` na atualização manual podia sobrescrever formulário durante edição.

## Solução

- Removido gate `!aquecedorEditMode`; save expande painel e grava no mesmo clique.
- `mousedown` + `preventDefault` em `#aquecedor-save-btn`.
- `mergePendingAquecedorExpedienteBatchIfNeeded()` — inclui lote do formulário ao salvar.
- `aquecedorConfigSaveInFlight` + skip `loadAquecedorConfig` quando editando/salvando.
- Ao incluir lote pendente, desmarca "Usar padrão recomendado".

## Arquivos

- `index.html`

## Palavras-chave

aquecedor, salvar configurações, double click, expediente, blur, edit mode
