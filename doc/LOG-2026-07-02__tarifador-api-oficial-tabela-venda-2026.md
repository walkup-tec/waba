# LOG — Tarifador API Oficial: nova tabela de venda

**Data:** 2026-07-02

## Contexto

Atualizar tabela de preço de venda dos envios **API Oficial** conforme planilha anexada pelo usuário.

## Nova tabela (venda)

| Qtde. envios | Valor por envio | Total |
|-------------|-----------------|-------|
| 1.000 | R$ 0,32 | R$ 320,00 |
| 3.000 | R$ 0,31 | R$ 930,00 |
| 5.000 | R$ 0,30 | R$ 1.500,00 |
| 8.000 | R$ 0,29 | R$ 2.320,00 |
| 10.000 | R$ 0,27 | R$ 2.700,00 |
| 20.000 | R$ 0,26 | R$ 5.200,00 |
| 30.000 | R$ 0,25 | R$ 7.500,00 |

Pacotes de teste (100 envios) mantidos.

## Alterações

- `index.html` — `DISPAROS_PRICING_TIERS.oficial` (modal Contratar + tabela PIX)
- `index.html` — card API Oficial: faixa **De R$ 0,25 a R$ 0,32**; mínimo **R$ 320,00**
- `src/billing/waba-billing.service.ts` — validação checkout: pacote oficial deve bater envios + centavos
- `npm run build` → `dist/index.html` + `dist/billing/waba-billing.service.js`

API Alternativa: **sem alteração** na rodada anterior; **atualizada nesta** com 7 faixas (1k–30k, R$ 0,13–0,20). Ver `doc/LOG-2026-07-02__tarifador-api-alternativa-tabela-venda-2026.md`.

## Como validar

1. Disparos → Contratar → API Oficial → tabela com 7 faixas (+ teste se visível)
2. Selecionar 1.000 envios → total R$ 320,00 → PIX
3. Card investimento: «De R$ 0,25 a R$ 0,32»

## Palavras-chave

`tarifador`, `DISPAROS_PRICING_TIERS`, `API Oficial`, `billing`, `checkout`, `tabela-preco`
