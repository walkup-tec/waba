# LOG — Créditos: compra no topo, saldo no Histórico

**Pedido:** Bloco «Seu saldo» sai do topo da tela e vai para aba Histórico; aba «Contratar créditos» mostra só compra no início.

## Alterações (`index.html`)

- `#disparos-credits-panel` movido para dentro de `#disparos-credits-hub-panel-history` (acima da lista Compras/Bonificações).
- Ordem da página: intro → abas → **Contratar** (cards API) → **Histórico** (saldo + extrato).
- JS: `isDisparosCreditsHubHistoryTabActive()`; painel de saldo visível só na aba Histórico.
- Modal repurchase: monta apenas cards de compra (sem duplicar saldo).

## Validar

1. Créditos → aba Contratar: só cards Oficial/Alternativa no topo.
2. Aba Histórico: saldo completo + compras/bonificações.

## Palavras-chave

`creditos-hub`, `disparos-lancamento`, `historico`, `seu saldo`
