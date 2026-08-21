# LOG — Remover placeholders LOGO da wabadisparos

- **Data:** 2026-07-21 ~12:30
- **Pedido:** Remover faixa "LOGO 1…LOGO 6" em https://wabadisparos.com.br/

## Solução

- Repo: `D:\pv-waba-disparador` (`walkup-tec/pv-waba-disparador`)
- Arquivo: `src/routes/index.tsx` — função `SocialProof`
- Removido o bloco de placeholders; mantidos métricas e depoimentos

## Validar

Após redeploy Easypanel `waba_paginadevendas`: conferir que a faixa LOGO sumiu na seção Prova Social.

## Palavras-chave

`wabadisparos`, `SocialProof`, `LOGO 1`, placeholders, `pv-waba-disparador`
