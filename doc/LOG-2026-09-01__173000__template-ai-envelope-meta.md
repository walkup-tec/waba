# Envelope Meta no assistente de template (nome, mídia, botão URL)

## Contexto do pedido

Incluir, acima do assistente de Utility, os campos de cadastro Meta: nome do modelo, tipo de variável (Nome/Número), mídia, cabeçalho e botão **Acessar site** com URL estática. Manter a seção atual (texto base + 3 opções). O **Gerar** do rodapé envia as 3 opções com esse envelope.

## Ações executadas

- Campos novos no Laboratório Cloud, acima do workspace de IA.
- Select de texto do botão igual ao Mensageiro da API Alternativa.
- Tipo de ação e tipo de URL não aparecem no front: sempre URL (Visit website) estático.
- `POST .../templates/ai/submit-all` monta HEADER + BODY + BUTTONS conforme a doc da Meta.
- Upload resumable de mídia: `POST .../templates/ai/header-media`.

## Solução implementada

1. **HEADER** — um só, como a Meta exige:
   - `NONE` + texto → `HEADER` `TEXT` (máx. 60).
   - `IMAGE` / `VIDEO` / `DOCUMENT` → `HEADER` com `example.header_handle` (Resumable Upload API).
   - `LOCATION` → `HEADER` `LOCATION`.
2. **BODY** — as 3 reescritas da IA; `{{1}}` segue Nome ou Número.
3. **BUTTONS** — `type: URL`, `text` do select, `url` https sem variável.
4. Nomes enviados: `{modelo}_{1|2|3}`.

Documentação oficial usada:

- https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
- https://developers.facebook.com/docs/graph-api/guides/upload
- https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/

Conceito da doc: routing/criação de template é `POST /{waba-id}/message_templates` com `components`; mídia de HEADER precisa de handle do upload resumable; URL estática não leva `{{1}}` nem `example`.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-validate.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.prompt.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `src/index.ts` (skip multipart no upload de header)
- `index.html`
- `src/deploy-marker.ts`

## Como validar

```bash
npm run test:meta-template-ai
npm run build
```

Preview: `http://127.0.0.1:43123/?ui-preview=template-ai`

Em produção, após Redeploy `waba_disparador`: `GET /health` → `DEPLOY-2026-09-01-173000-template-ai-envelope-meta`.

## Observações de segurança

- Token Meta só no backend; upload não loga bytes nem handle completo em logs de rotina.
- URL precisa ser `https` e estática.
- Sem garantia de aprovação da Meta.

## Palavras-chave

envelope template, header_handle, URL estático, Acessar site, mídia IMAGE VIDEO DOCUMENT, nome do modelo, tipo de variável
