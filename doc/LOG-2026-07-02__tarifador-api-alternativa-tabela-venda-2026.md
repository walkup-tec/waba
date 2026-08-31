# LOG — Tarifador API Alternativa (tabela venda 2026)

**Data:** 2026-07-02  
**Contexto:** Atualizar tabela de preços da API Alternativa conforme imagem enviada pelo usuário (7 faixas de volume).

## Tabela aplicada

| Envios | R$/envio | Total (centavos) |
|--------|----------|------------------|
| 1.000  | 0,20     | 20000            |
| 3.000  | 0,19     | 57000            |
| 5.000  | 0,17     | 85000            |
| 8.000  | 0,16     | 128000           |
| 10.000 | 0,15     | 150000           |
| 20.000 | 0,14     | 280000           |
| 30.000 | 0,13     | 390000           |

Pacotes de teste (100 envios) mantidos no frontend.

## Alterações

1. **`index.html`**
   - `DISPAROS_PRICING_TIERS.alternativa` — 7 faixas comerciais.
   - Card API Alternativa: «De R$ 0,13 a R$ 0,20»; mínimo **R$ 200,00**.
   - Correção HTML: `</article>` + `<aside class="disparos-choice-note">` (tag quebrada na edição anterior).

2. **`src/billing/waba-billing.service.ts`**
   - `DISPAROS_ALTERNATIVA_SALE_PACKAGES` alinhado à tabela.
   - `validateCheckoutInput` valida pacotes alternativa contra a lista.

3. **Build:** `npm run build` → `dist/index.html` + `dist/billing/waba-billing.service.js`.

## Como validar

- Abrir hub de créditos / compra Disparos → card API Alternativa mostra faixa e mínimo corretos.
- Selecionar pacote 1.000 envios → total R$ 200,00.
- Checkout backend rejeita combinações fora da tabela.

## Segurança

- Apenas valores pré-definidos no servidor; frontend não define preço final.

## Palavras-chave

`tarifador`, `api-alternativa`, `DISPAROS_PRICING_TIERS`, `DISPAROS_ALTERNATIVA_SALE_PACKAGES`, `waba-billing`
