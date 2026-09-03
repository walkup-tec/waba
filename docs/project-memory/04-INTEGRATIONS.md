# Integrações

- Meta Graph: message templates (criar, listar/paginar, excluir, sync com prune do órfão local, status).
  Criação: o backend acrescenta `QUICK_REPLY` Bloquear e agrupa URL/PHONE antes dos QR.
  Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
  Exclusão: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
- Portfólio / chips: `GET /{WABA_ID}/phone_numbers` com paginação (`limit` + `after`). Várias conexões Embedded Signup do mesmo BM unem chips por `phoneNumberId` (`unionPortfolioNumbers`), sem descartar a 2ª lista. Docs: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/phone_numbers/ e https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/
- Foto de perfil do chip: o Laboratório envia JPEG/PNG (até 5 MB) à Meta. Upload resumable + `POST /{PHONE_NUMBER_ID}/whatsapp_business_profile` com `profile_picture_handle`. Número precisa estar Ativo. Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/
- Evolution API: instâncias alternativas (fora deste card).
- Encurtador WABA (`/s/:slug`) para botões URL oficiais. No disparo Cloud, cada campanha ganha um alias; o clique no `/s/` incrementa o disparo (`campaignId` no link). Esse clique só aparece no relatório da campanha do assinante quando o atendente tem Laboratório.
- Webhook Cloud `statuses` atualiza o disparo (`wamid`) e, após janela quieta, fecha o relatório da campanha vinculada. Status `failed` grava `errorCode` e `error_user_msg` no lead. Recusa do POST Graph grava o código da Graph. O operacional lê isso em `sendIssues`. Webhook `message_template_status_update` com `APPROVED` grava o instante da aprovação para o relatório do assinante. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- Messages API (`POST /{phone-number-id}/messages`, `type: template`): destino E.164 sem `+`. Cabeçalho IMAGE/VIDEO/DOCUMENT do Disparo Cloud envia só `{ id }` após `POST /{PHONE_NUMBER_ID}/media`. Sem arquivo local no tenant, o disparo recusa e pede o mesmo arquivo no template aprovado (`POST /templates/:id/header-media`). URL lookaside/fbcdn nunca vai como `{ link }` (131053 / HTTP 403). A mesma foto em 3 templates não é recusada pela Meta; o que quebra é o link de exemplo compartilhado. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages e https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/
- OpenAI (`OPENAI_API_KEY`) no assistente Utility: few-shot com templates locais aprovados. Sem fine-tune.
- Cabeçalho IMAGE: upload resumable Graph (`POST /{app-id}/uploads` + binário `upload:{session}`). MIME pelo magic dos bytes; `file_name` só ASCII (`header.png`/`header.jpg`). Sem teto de tamanho no Waba; recusa da Graph aparece no alerta. Doc: https://developers.facebook.com/docs/graph-api/guides/upload
- Mídia da campanha do assinante (wizard): PNG/JPEG 1080×1080 ou MP4 `video/mp4` até 16 MB (H.264, AAC ou sem áudio). Recusa MOV, WebM, 3GP, AVI. Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/

Docs oficiais de templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
