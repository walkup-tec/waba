# LOG — UI passo 3 validação: remover links extras

**Data:** 2026-06-21  
**Pedido:** Remover da tela «Já enviei CONFIRMAR» e «Abrir conversa no WhatsApp».

## Alterações
- Removidos HTML, CSS e JS de `#register-inbound-sent-btn` e `#register-inbound-wa-open`
- Mantidos: instruções numeradas, spinner de aguardo, «Tentar validação novamente», «Pular validação»
- Marker: `DEPLOY-2026-06-21-validacao-inbound-ui-cleanup`

## Arquivos
- `index.html`
- `src/deploy-marker.ts`

## Nota deploy
O hybrid `a41ba4b` entrou no commit `7193069`; marker health atualizado para ui-cleanup após este patch.
