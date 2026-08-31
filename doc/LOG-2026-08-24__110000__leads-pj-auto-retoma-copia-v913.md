# LOG — Leads PJ auto-retoma cópia portal (v9.13)

## Contexto

Após v9.12 em produção, Corban · 2026-08-24 ficou em **Baixar** com **118/1.000** e “Pool esgotado”. O usuário esperava retomada automática da pesquisa de páginas; isso não ocorreu.

## Causa

`resumeDailyPipelinesAfterBoot` só reencolava `status === "scraping"`. Lista já `ready` (Lista 01) era ignorada. O gate “cópia antes do enrich” não reabre jobs finalizados.

## Solução

1. No boot: `ensureIncompletePortalCopiesResume()` detecta campanha portal sem `scrapeCompleted` e páginas &lt; teto UI.
2. Se existe Lista ready com Excel: cria linha **`· cópia portal`** (`dayKey` `YYYY-MM-DD#portal-copy`) sem apagar o Excel.
3. `POST .../resume-scrape` em lista ready também usa essa continuação.
4. Ao concluir a cópia nessa linha: marca ready sem export e deixa o pool para a fila ReceitaWS (próximas listas diárias) — não gera segundo Excel no mesmo passo.

## Validação

- Redeploy `waba_disparador` → `/health` marker `…auto-retoma-copia-v9.13`.
- Histórico: Corban Lista 01 permanece; nova linha “cópia portal” em Copiando com páginas avançando de ~119.

## Palavras-chave

leads-pj, portal-copy, auto-resume, scrapeCompleted, boot, Corban, 118/1000
