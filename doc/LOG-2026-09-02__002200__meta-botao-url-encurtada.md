# LOG — Botão Meta sempre com URL curta WABA

## Contexto do pedido

Independente do link informado no assistente de template, a Meta deve receber sempre uma URL nossa, no mesmo método do encurtador da campanha de API Alternativa.

## Método reaproveitado (campanha)

Na etapa «5) Encurtador URL»:

1. Destino = `responseUrl` (http/https) ou `wa.me` do número.
2. Acrescenta `_n8n_link_nonce`.
3. `createWabaShortUrl` grava o slug e devolve `https://{domínio}/s/{slug}`.
4. Clique público: `GET /s/:slug` → 302 para o destino.

Doc de componentes Meta (botão URL = `https` estático):  
https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components

A Meta recusa `wa.me` **no botão**. O destino do usuário pode ser WhatsApp: o botão aponta para o nosso domínio.

## Solução

- Campo do assistente = **destino** (http/https, inclusive `wa.me`).
- No `submit-all`, uma URL curta WABA por lote (as 3 opções compartilham o mesmo botão).
- Graph recebe só `https://{domínio}/s/{slug}`.
- Se o encurtador falhar, o lote não vai à Meta (`template_shorten_failed`).

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-short-url.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `index.html`
- testes + `src/deploy-marker.ts`

Marker: `DEPLOY-2026-09-02-002200-meta-botao-url-encurtada`

## Como validar

```bash
npm run test:meta-template-ai
npm run test:meta-phase7
```

Após Redeploy: informar `https://wa.me/...` ou um site; o modal deve mostrar «Botão na Meta: https://…/s/…».

## Segurança

Log só com host do destino e do curto. Sem token. Destino pode conter telefone no `wa.me` e não é logado completo.

## Palavras-chave

`createWabaShortUrl`, `/s/:slug`, `_n8n_link_nonce`, botão URL Meta, `metaButtonUrl`, Utility
