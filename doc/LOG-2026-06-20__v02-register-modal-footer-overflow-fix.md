# LOG — Modal integração instância: rodapé escondendo validação

**Data:** 2026-06-20  
**Sintoma:** Passo 3 (Validar) — checks de recepção/resposta cortados pelo rodapé do modal.

## Causa
- `.reg-wizard-body` e `.reg-wizard-pane` com `overflow: hidden` e altura fixa.
- Passo 3 acumulava instruções + waiting + 2 checks — conteúdo maior que área útil.

## Correção
- Layout flex: pane ativo com scroll interno; footer fixo (`flex-shrink: 0`).
- Passo 3 dividido em `reg-wizard-pane-intro` + `reg-wizard-pane-progress`.
- Classe `reg-pane-validating`: oculta instruções longas quando validação inicia.
- `scrollRegisterWizardToProgress()` rola para último check visível.
- Subtitle atualizado.

## Arquivos
- `index.html`, `dist/index.html`
