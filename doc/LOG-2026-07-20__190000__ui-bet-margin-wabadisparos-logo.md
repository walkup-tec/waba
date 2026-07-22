# LOG — Ajuste UI bet.waba.info + wabadisparos logo

- **Data:** 2026-07-20 ~19:00
- **Pedido:** Reduzir margem superior do badge "Feito para o mercado de Bets" em bet.waba.info; aumentar logo DRAX·WABA em wabadisparos.com.br em +15%.

## Alterações

### bet.waba.info (`D:\betwaba-connect`)
- Arquivo: `src/routes/index.tsx` (hero)
- Padding: `pt-16 sm:pt-24 md:pt-32` → `pt-8 sm:pt-12 md:pt-14`

### wabadisparos.com.br (`D:\pv-waba-disparador`)
- Arquivo: `src/routes/index.tsx` (`Logo` size=`nav`)
- Altura: `h-[2.5875rem]` → `h-[2.9756rem]` (+15%)
- attrs: width 207→238, height 41→47

## Validar (após build/redeploy)

1. Redeploy Easypanel `waba_bets_pv` (repo betwaba-connect)
2. Redeploy Easypanel `waba_paginadevendas` (repo pv-waba-disparador)
3. Conferir visual nos dois domínios

## Palavras-chave

`bet.waba.info`, hero padding, `wabadisparos`, logo +15%, `pv-waba-disparador`, `betwaba-connect`
