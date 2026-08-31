# LOG — Remoção faixa teste 100 envios · R$ 5,00

**Data:** 2026-06-21  
**Pedido:** Remover da tabela de preços a faixa 100 envios × R$ 0,05 = R$ 5,00 (API Oficial e Alternativa).

## Alterações

- `index.html` — removido tier `{ shipments: 100, pricePerSend: 0.05, totalCents: 500, testOnly: true }` de `DISPAROS_PRICING_TIERS.oficial` e `.alternativa`.
- `src/billing/waba-billing.service.ts` — removido `{ shipments: 100, valueCents: 500 }` de `DISPAROS_TEST_PACKAGES` (checkout não aceita mais esse pacote).
- `dist/` — atualizado via `npm run build`.

## Mantido

Pacote teste **100 envios · R$ 30,00** (`0,03`/`3000` centavos) permanece para testes internos.

## Validação

Abrir modal «Contratar» → tabela não deve listar linha 100 / 0,05 / R$ 5,00.

## Palavras-chave

`DISPAROS_PRICING_TIERS`, `DISPAROS_TEST_PACKAGES`, pacote teste, tarifador
