# LOG — menu Campanhas com efeito no primeiro acesso

**Data:** 2026-06-11  
**Pedido:** após contratar disparos, exibir menu Campanhas com efeito visual só na primeira vez que o usuário acessa.

## Alterações (`index.html`)
- Botão **Campanhas** (`data-tab="disparos"`) em API não oficial — visível só com créditos pagos.
- Efeito: pulse verde + badge **Novo** até o primeiro clique em Campanhas.
- Persistência: `localStorage` `waba.campanhas.menu.seen:{email}`.
- Ao abrir aba `disparos`, marca como visto e remove o efeito.

## Validação
- Login com assinante com PIX pago → menu Campanhas aparece com destaque.
- Clicar Campanhas → efeito some e não volta no reload.
- Outro e-mail → efeito independente por conta.
