# Tarifador Bets — tabela vigente 1k–50k (0,42 → 0,33)

## Contexto

Atualização da tabela de preços API Oficial para assinantes **Bets** conforme planilha do usuário.

| Envios | R$/envio | Total |
|--------|----------|-------|
| 1.000 | 0,42 | R$ 420 |
| 2.000 | 0,41 | R$ 820 |
| 5.000 | 0,40 | R$ 2.000 |
| 10.000 | 0,38 | R$ 3.800 |
| 20.000 | 0,37 | R$ 7.400 |
| 30.000 | 0,36 | R$ 10.800 |
| 40.000 | 0,35 | R$ 14.000 |
| 50.000 | 0,33 | R$ 16.500 |

## Alterações

- `index.html` — `DISPAROS_PRICING_TIERS.betsOficial` + card `De R$ 0,33 a R$ 0,42`
- `src/billing/waba-billing.service.ts` — `DISPAROS_BETS_OFICIAL_SALE_PACKAGES` (checkout PIX)

## Validar

Login Bets → Contratar → modal tabela com 8 faixas; checkout aceita pacotes 1k/2k/5k novos.

## Palavras-chave

`betsOficial`, `DISPAROS_BETS_OFICIAL_SALE_PACKAGES`, tarifador, `0,42`, `0,33`
