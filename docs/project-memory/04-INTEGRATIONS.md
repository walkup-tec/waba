# Integrações

- Meta Graph: message templates (criar, listar/paginar, excluir, sync com prune do órfão local, status).
  Criação: o backend acrescenta `QUICK_REPLY` Bloquear e agrupa URL/PHONE antes dos QR.
  Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
  Exclusão: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
- Evolution API: instâncias alternativas (fora deste card).
- Encurtador WABA (`/s/:slug`) para botões URL oficiais.
- OpenAI (`OPENAI_API_KEY`) no assistente Utility: few-shot com templates locais aprovados. Sem fine-tune.

Docs oficiais de templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
