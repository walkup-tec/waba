# Correção: campanha Alternativa sem botão (texto+link)

## Contexto do pedido

Campanha API Alternativa em produção chegou no WhatsApp como texto + URL + card “Share on WhatsApp”, sem botão. Imagem ok. Usuário proibiu preview antes do texto e URL no corpo. Pedido: imagem → texto → botão.

## Comandos / ações

- Health produção: `DEPLOY-2026-08-20-warmth-chip-lookup` (patch do botão nunca tinha ido ao `master`).
- Ajuste em `src/index.ts` + marker. `npm run build`.

## Solução implementada

1. `viewOnceMessage` com nativeFlow/cta_url deixa de ser tratado como falha (Evolution 2.3.7).
2. Texto sempre com `stripUrls` (remove também linha “Mais informações:” órfã). `linkPreview: false` no sendButtons e no sendText residual.
3. Sem `ensureMessageContainsLink` no motor Alternativa. Se sendButtons falhar HTTP, envia só o texto (sem URL) — nunca o card de preview.
4. Marker `DEPLOY-2026-08-20-alternativa-url-button`.

## Arquivos criados/alterados

- `src/index.ts`, `src/deploy-marker.ts`, `dist/index.js`, `dist/deploy-marker.js`
- Este LOG; `doc/memoria.md`; `.cursor/project-memory/02-BUSINESS_RULES.md`, `04-INTEGRATIONS.md`, `06-CURRENT_STATUS.md`, `08-DEPLOY.md`

## Como validar

Após push `master` + Redeploy EasyPanel `waba_disparador`: `/health` com o marker. Próximo envio da campanha Alternativa: imagem, texto sem URL/preview, botão nativo. Mensagens já entregues (print 17:16) não mudam. Sem `sendText` de prova.

## Observações de segurança

Sem log de chaves. Sem probe de envio.

## Palavras-chave

sendButtons, viewOnceMessage, fallback texto+link, linkPreview, API Alternativa, botão URL
