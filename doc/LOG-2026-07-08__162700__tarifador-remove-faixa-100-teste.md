# LOG — Tarifador: removida faixa 100 envios (R$ 0,03)

**Data:** 2026-07-08  
**Contexto:** Remover linha de teste `100 | R$ 0,03 | R$ 30,00` do tarifador para todos os segmentos.

## Solução

**`index.html`**
- Removido tier `testOnly` (100 envios) de `oficial`, `betsOficial` e `alternativa`.
- `getDisparosPricingTiers()` filtra `testOnly` como rede de segurança.

Backend `DISPAROS_TEST_PACKAGES` mantido (checkout interno); não aparece mais na UI.

## Validar

Contratar créditos → tabela inicia em 1.000 (Outros) ou 10.000 (Bets), sem linha 100.
