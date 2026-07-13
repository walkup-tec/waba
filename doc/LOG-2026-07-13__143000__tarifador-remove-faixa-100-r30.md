# LOG — Remover faixa 100 envios R$ 0,03 / R$ 30 do tarifador

**Data:** 2026-07-13 ~14:30  
**Pedido:** Em produção, não ter a faixa 100 · R$ 0,03 · R$ 30,00 nem para Outros nem para Bets.

## Alterações

1. **UI** `index.html` / `dist/index.html` — removidas linhas `testOnly` em `oficial` e `alternativa`; tabela usa `resolveDisparosSaleTiersForDisplay`.
2. **Backend** `waba-billing.service.ts` — removido `DISPAROS_TEST_PACKAGES` e bypass de mínimo; checkout não aceita mais 100/R$30.
3. Bets já não tinha a faixa na UI (`betsOficial` começa em 5.000); backend também deixa de aceitar o pacote teste.

Marker: `DEPLOY-2026-07-13-tarifador-sem-faixa-100`

## Validar após Redeploy

- Tarifador Outros (Oficial e Alternativa): primeira linha ≥ 1.000 envios  
- Tarifador Bets: primeira linha ≥ 5.000  
- Tentar PIX 100 envios → erro de pacote/mínimo  

## Keywords
`tarifador`, `faixa 100`, `0.03`, `DISPAROS_TEST_PACKAGES`, `Outros`, `Bets`
