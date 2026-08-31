# LOG — Split rateio grava automaticamente

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-waba-split-autosave-persist`

## Problema

Usuário incluía participantes no rateio do lucro com **Incluir**, recarregava a página e a lista vinha vazia.

**Causa:** «Incluir» só atualizava memória no navegador. Era obrigatório clicar **Salvar split**; além disso o backend exigia soma 100% já no save, bloqueando cadastro parcial.

## Correção

- **Auto-save** ao incluir/remover participante ou fornecedor.
- **Auto-save** com debounce ao editar PIX / % / master na lista.
- **Salvar split** absorve linha pendente do formulário antes de gravar.
- Backend: soma 100% exigida só no **repasse** (settlement), não no cadastro da config.
- Validação: % rateio > 0 ao incluir.

## Arquivos

- `index.html`
- `src/billing/waba-financeiro-split.service.ts`
- `src/deploy-marker.ts`
