# LOG — Botão Atualizar no card Saldos

**Data:** 2026-06-15

## Pedido
Botão "Atualizar" no card **Saldos** para recarregar saldo após compra sem F5 na página.

## Alteração
- `index.html`: header `disparos-resumo-saldos-head` com botão `#disparos-resumo-saldos-refresh-btn`
- Clique chama `loadDisparosCredits()` (mesmo endpoint `/billing/disparos/credits`)
- Estado "Atualizando..." enquanto carrega

## Validar
Disparos → card Saldos → **Atualizar** após pagar PIX.
