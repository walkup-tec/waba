# LOG — Leads PJ fast resume v9.16

## Problema

Após crash ~pág. 12–13, recover refazia LOGIN → CNAE e travava em `LOGIN: abrindo portal…`.

## Solução

Com `resumeFromPage > 1` + `storageState` em disco:

1. Vai direto a `/plataforma/pesquisa` (não abre `/entrar` cego)
2. Se já há resultados/paginação → **pula CNAE/filtros**
3. Senão: 1× Pesquisar com filtros da sessão; se falhar, fallback ao fluxo completo
4. Mensagens de retomada usam prefixo `COPY:` (UI permanece em Copiando)

Marker: `DEPLOY-2026-08-24-1305-leads-pj-fast-resume-v9.16`
