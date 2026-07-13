# LOG — 2026-07-10 — Pós-purge Admin menus (usuário rodou no SSH)

## Contexto

Usuário confirmou que executou o purge via SSH no VPS. Perguntou se falta algo.

## Checklist pós-purge (validação manual no painel)

1. **Admin → Push** — histórico vazio (sem as linhas do print)
2. **Admin → Campanhas** — lista vazia
3. **Admin → Chamados** — lista vazia
4. **Admin → Financeiro**
   - Fornecedores: **ainda preenchidos**
   - Rateio do lucro: **ainda preenchido**
   - Pedidos / informações registradas: **ainda presentes**
   - Histórico de splits/liquidações: **vazio**
5. **Admin → Dashboard** — métricas de campanhas/chamados/push zeradas; financeiro de pedidos pode continuar refletindo orders preservados

## O que NÃO precisa (em geral)

- Redeploy Easypanel — desnecessário se o script gravou em `/app/data`
- Reinício do container — só se a UI ainda mostrar dados em cache; nesse caso Ctrl+F5 ou `docker service update --force` do `waba_disparador` (último recurso)

## Se usou `--with-supabase`

Campanhas/leads no Supabase também devem estar vazias. Se **não** passou `--with-supabase` e ainda há campanhas “fantasma” no runtime, rodar de novo com a flag ou limpar tabelas `disparos_campaigns` / `disparos_campaign_leads`.

## Backup

Deve existir em `/app/data/_backups/purge-admin-menus-<timestamp>/` — manter por alguns dias.

## Palavras-chave

`pós-purge`, `validação admin`, `split-config keep`, `push histórico`
