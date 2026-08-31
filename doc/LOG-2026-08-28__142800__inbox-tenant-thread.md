# Inbox: conversa some após envio (tenant / connection_id)

## Contexto

O marker `DEPLOY-2026-08-28-121400-inbox-envio-conversa` já estava em `GET /health` em produção. O operador enviou de novo e a conversa continuou fora da lista do Inbox.

O deploy drift foi descartado. A lista ainda filtrava um único `connection_id` (a conexão Meta mais recente). Envio, webhook e resposta podiam gravar o fio em outra linha de conexão do mesmo tenant.

Docs oficiais usadas:

- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/

A Cloud API não devolve histórico inbound genérico. Inbound entra só por webhook `messages[]`. `statuses[]` não traz o corpo da mensagem.

## Sintoma

Chip do Inbox visível; lista de conversas vazia depois do envio (Laboratório ou WhatsApp do contato).

## Causa

`GET /inbox/conversations` usava `findConnectedByTenant` / `findOpenByTenant` (um row) e `listForInbox` com `.eq("connection_id", connection.id)`. A conversa do mesmo contato em outra conexão ficava invisível. Responder exigia `conversation.connectionId ===` essa conexão recente.

## Solução

1. Listar pelo tenant e pelos `phone_number_id` dos chips ligados, sem filtrar um único `connection_id`.
2. `upsertForContact` reutiliza o fio existente por `tenant_id + contact_wa_id`.
3. Resposta do Inbox envia pela conexão da conversa (`pending_confirmation` aceito nesse caminho).
4. Webhook `statuses` sem wamid local cria a conversa outbound se o chip estiver ligado.
5. Após envio aceito no Laboratório, a UI abre a aba Inbox nesse fio.

Switch cinza continua sem persistir inbound.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-inbox.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-conversation.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-messaging.service.ts`
- `src/integrations/whatsapp/meta-cloud-provider.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-inbox.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validação

- `npm run test:meta-phase6` / `phase7` / `phase8` / `phase9` — passou (inclui duas conexões no mesmo tenant).
- Marker: `DEPLOY-2026-08-28-142800-inbox-tenant-thread`
- Em produção: Redeploy `waba_disparador` e conferir `GET /health`. Enviar **uma** mensagem de teste e ver o Inbox abrir o fio. Sem rajada de `sendText`.

## Palavras-chave

inbox, connection_id, tenant, conversa vazia, webhook statuses, Cloud API, Laboratório
