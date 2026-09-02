# Integrações

- Meta Graph: message templates (criar, listar/paginar, excluir, sync com prune do órfão local, status).
  Criação: o backend acrescenta `QUICK_REPLY` Bloquear e agrupa URL/PHONE antes dos QR.
  Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
  Exclusão: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
- Foto de perfil do chip: o Laboratório envia JPEG/PNG (até 5 MB) à Meta. Upload resumable + `POST /{PHONE_NUMBER_ID}/whatsapp_business_profile` com `profile_picture_handle`. Número precisa estar Ativo. Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/
- Evolution API: instâncias alternativas (fora deste card).
- Encurtador WABA (`/s/:slug`) para botões URL oficiais.
- OpenAI (`OPENAI_API_KEY`) no assistente Utility: few-shot com templates locais aprovados. Sem fine-tune.
- Cabeçalho IMAGE: upload resumable Graph (`POST /{app-id}/uploads` + binário `upload:{session}`). MIME pelo magic dos bytes; `file_name` só ASCII (`header.png`/`header.jpg`); teto IMAGE 5 MB. Doc: https://developers.facebook.com/docs/graph-api/guides/upload

Docs oficiais de templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
