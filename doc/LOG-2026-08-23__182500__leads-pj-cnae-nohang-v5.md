# LOG — Leads PJ: CNAE sem hang (Xvfb)

## Contexto

Extração ficava em `Pesquisando: selecionando CNAE 6619302… (navegador aberto — persistindo)` sem evoluir para Copiar.

## Solução

1. Seleção CNAE em fases (abrir → busca → digitar → checkbox → fechar) com progresso.
2. Timeout por tentativa ~12–35s (default 25s), 2 tentativas; abortável.
3. Se falhar: **não lança** — fecha modal e segue demais filtros/Pesquisar (extração não para).
4. Marker: `DEPLOY-2026-08-23-1825-leads-pj-cnae-nohang-v5` (+ `dist/` no Git).

## Validar

Redeploy → `/health` com marker v5 → mensagem deve sair de “selecionando CNAE” em &lt; ~1 min (sucesso ou “pulado / seguindo”).
