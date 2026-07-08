# LOG — 2026-07-06 11:45 — Segmento assinante + tarifador Bet

## Solicitação
- Declarar segmento ao criar assinante (Bets | Outros)
- Tarifador atual (Oficial + Alternativa) para segmento **Outros**
- Tarifador Bet (só API Oficial) para segmento **Bets**
- Origem cadastro: wabadisparos.com.br → Outros; bet.waba.info → Bets
- Bet: sem API Alternativa (menu, compra, campanha)

## Tabela Bet (API Oficial)
| Envios | R$/envio |
|--------|----------|
| 1.000 | 0,40 |
| 3.000 | 0,38 |
| 5.000 | 0,37 |
| 8.000 | 0,36 |
| 10.000 | 0,33 |
| 20.000 | 0,32 |
| 30.000 | 0,31 |

## Arquivos principais
- `src/subscribers/waba-subscriber-segment.ts` (novo)
- `src/subscribers/waba-subscriber.*`
- `src/billing/waba-billing.service.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/index.ts`
- `index.html`, `public-pages/cadastro.html`, `vendas.html`

## V02
http://localhost:3012/version-02/

## Pendências
- bet.waba.info (betwaba-connect): signup ainda mock — integrar POST `/subscribers/register` com `signupOrigin: "bet-waba"` quando for para produção
