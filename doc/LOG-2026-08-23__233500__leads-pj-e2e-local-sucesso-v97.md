# LOG — Leads PJ E2E local sucesso v9.7

## Contexto

Usuário pediu teste ponta a ponta em ambiente controlado, sem publicar em produção até funcionar.

## Evidência de sucesso (local)

```
RESULT {"ok":true,"count":20,"scrapeCompleted":true,"doneReason":"MAX_PAGES",
  "sample":[{"cnpj":"98414477000118","nome":"SUPER MERCADO RISPOLI LTDA"}, ...]}
```

Fluxo: LOGIN → FILTERS/CNAE → SEARCH (scroll+click) → COPY página 1 com 20 cards.

## Correções incluídas

1. CNAE/FILTERS: só evaluate + `sleepNode` / `withNodeTimeout` (sem `page.waitForTimeout`/locator xpath)
2. Pesquisar: `scrollIntoView` antes do mouse click (botão em y~2661)
3. Parser de cards: achar bloco `Encontrado` + CNPJ + nome (regex antiga cortava/ falhava)
4. SEARCH: não aceitar só paginação sem CNPJ
5. Marker: `DEPLOY-2026-08-23-2330-leads-pj-cnae-cdp-safe-v9.7`

## Validação

- Script: `node scripts/e2e-leads-pj-local.cjs` (worktree, credenciais `.env.v02` do parent)
- **Não** push/Redeploy até autorização

## Palavras-chave

leads-pj, e2e-local, cnae-cdp-safe, readScreenCardsLight, scrollIntoView, v9.7
