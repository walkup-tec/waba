# LOG — Tarifador Bets vigente (API Oficial)

**Data:** 2026-07-08  
**Contexto:** Tabela comercial Bets atualizada pelo usuário.

| Qtde. envios | Valor/envio |
|-------------|-------------|
| 10.000 | R$ 0,38 |
| 20.000 | R$ 0,37 |
| 30.000 | R$ 0,36 |
| 40.000 | R$ 0,35 |
| 50.000 | R$ 0,33 |

Faixa no card: **De 0,33 a 0,38** · subtexto: **Escolha o melhor pacote para você**.

## Alterações

1. **`src/billing/waba-billing.service.ts`** — `DISPAROS_BETS_OFICIAL_SALE_PACKAGES` (checkout PIX/Asaas).
2. **`index.html`** — `DISPAROS_PRICING_TIERS.betsOficial` (tabela de pacotes no painel).
3. **`public-pages/bets.html`** — landing: a partir de R$ 0,33.

Pacote teste 100 envios mantido só no front (`testOnly`).

## Validar

Assinante Bets → contratar créditos API Oficial → tabela com 5 faixas; checkout de 10k = R$ 3.800,00.

## Palavras-chave

`bets`, `tarifador`, `DISPAROS_BETS_OFICIAL`, `betsOficial`, `0,38`, `0,33`
