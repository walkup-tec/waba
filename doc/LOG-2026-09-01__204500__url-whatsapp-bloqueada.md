# LOG — Meta recusou as 3 opções (URL WhatsApp no botão)

## Contexto do pedido

Usuário enviou 3 templates Utility (Grupo Walkup) e o modal mostrou **0 de 3 cadastrados**, todos com:

> A Meta recusou o template. Confira nome, idioma, categoria, corpo e exemplos.

Business Manager ficou sem templates novos. Pedido: encontrar o erro na integração e corrigir.

## Sintoma observado

- Graph HTTP **400** nas três opções (mesmo texto).
- BM vazio: o `POST /{waba-id}/message_templates` não persistiu.
- Mensagem genérica: o backend descartava `error_user_msg` / `error_data.details` da Graph.

## Hipótese principal

Envelope compartilhado (não o corpo de cada opção): botão URL com host **proibido** pela Meta (`wa.me`, `whatsapp.com`, `whatsapp.net`, `api.whatsapp.com`).

Formulário anterior usava link WhatsApp no botão. A Meta documenta botão URL como site `https` estático — não deep-link WhatsApp.

- Doc componentes: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
- CTA URL: site `https`, até 2000 caracteres; variável só no path/query, com exemplo.
- Hosts WhatsApp no botão geram 400 (restricted domains), não análise de 24 h.

Confiança: **Alto** no 400 estrutural compartilhado; **Médio-Alto** em `wa.me` como payload exato (Graph real não está neste ambiente).

## Solução

1. Recusar `wa.me` / `whatsapp.com` / `whatsapp.net` **antes** da Graph (front + shell + `validateTemplateCreate`).
2. Modal passa a mostrar o detalhe seguro da Meta (`error_user_msg` / `details`), sem token.
3. Campo URL: dica explícita; placeholder de site, não WhatsApp.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-validate.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-graph-errors.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `index.html`
- testes phase7 + template-ai
- `src/deploy-marker.ts` → `DEPLOY-2026-09-01-204500-url-whatsapp-bloqueada`

## Como validar

```bash
npm run test:meta-template-ai
npm run test:meta-phase7
```

Em produção, após Redeploy do `waba_disparador`:

- `GET /health` → marker `…-url-whatsapp-bloqueada`
- URL do botão = site https (ex.: página de retorno). **Não** `wa.me`.
- Se a Meta ainda recusar, o modal deve mostrar o texto dela, não só a frase genérica.

## Segurança

Logs: `graphCode` + detalhe público. Sem token, `appsecret`, body com PII.

## Palavras-chave

`template_url_restricted`, `wa.me`, `whatsapp.com`, Graph 400, `error_user_msg`, botão URL, Utility, submit-all
