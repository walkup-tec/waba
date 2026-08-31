# Restaurar botão URL da campanha Alternativa (11/08)

## Contexto do pedido

Campanha de 11/08 gerava o botão nativo. Depois passou a chegar texto + link + card “Share on WhatsApp”. Usuário: o botão não pode falhar; precisa funcionar de novo.

## Investigação

- Feature original: `4a72c1d` (2026-08-06) — `title` = 1º bloco/linha, `footer: ""`, URL só no botão.
- Regressão: `30004a3` — `title` passou a `\u200b` (ZWSP) para evitar negrito.
- Depois: `0bc5eee` — `viewOnce` tratado como falha → fallback texto+link (print 17:16).

## Solução implementada

Restaurado o payload de `4a72c1d`. Sem fallback texto/link. Lead volta a `pending` se sendButtons falhar. `viewOnce` + nativeFlow/cta_url continua sucesso (Evolution 2.3.x). Marker `DEPLOY-2026-08-20-alternativa-button-restore`.

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`, `dist/index.js`, `dist/deploy-marker.js`
- Este LOG; `doc/memoria.md`

## Como validar

Push `master` + Redeploy `waba_disparador`. `/health` com o marker. Próximo envio: imagem + texto sem URL + botão. Sem `sendText` de prova.

## Palavras-chave

sendButtons, 4a72c1d, ZWSP, title, fallback texto+link, API Alternativa
