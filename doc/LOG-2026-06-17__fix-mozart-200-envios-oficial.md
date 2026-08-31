# LOG — Mozart 200 envios (2× R$ 30)

**Data:** 2026-06-17

## Problema

`mozart.pmo@gmail.com` comprou 2× pacote R$ 30 / 100 envios mas via apenas 100.

## Causa

- Pedido 1: API **Oficial** (100 envios) ✓
- Pedido 2: estava gravado como API **Alternativa** (100 envios) — saldo separado por plano

O assinante olhava só o saldo **API Oficial** (100), sem somar o da Alternativa.

## Correção dados

- `waba-billing-orders.json`: pedido `0d01ce15-…` → `apiKind: oficial`
- `waba-financeiro-split-settlements.json`: settlement ajustado para fornecedor oficial

**Resultado:** 200 envios API Oficial, 0 Alternativa.

## Melhorias UI

- Toolbar: `200 envios · R$ 60,00` (total disponível + contratado)
- Resumo: linha **Total disponível**
- Repurchase: pré-seleciona o plano onde o usuário já tem mais créditos
