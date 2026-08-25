# LOG — Fase 6 envio Cloud API + persistência Inbox

## Contexto

Envio real de texto/template pela WhatsApp Cloud API na conexão Meta do tenant autenticado. Persistência mínima para Inbox futura. Sem chatbot, UI de Inbox, CRUD de templates, commit, push ou deploy.

## Solução

1. Contrato `WhatsAppProvider` com `MetaCloudProvider` e `EvolutionProvider` (este último não roteia os fluxos Evolution existentes).
2. Tenant só da sessão; token só decrypt no servidor; Graph `POST /{PHONE_NUMBER_ID}/messages` com `META_GRAPH_VERSION`.
3. Tabelas `meta_whatsapp_conversations` e `meta_whatsapp_messages`.
4. Webhook Fase 5 persiste inbound e aplica statuses sem regressão.
5. Eventos internos `onInboundMessage` / `onOutboundMessage` / `onConversationCreated` / `onConversationUpdated`.
6. LAB: formulário de teste no painel Laboratório → Conectar WhatsApp.

## Arquivos

SQL: `doc/SQL-2026-08-25__create-meta-whatsapp-inbox.sql`

## Como validar

```bash
npm run test:meta-phase6
npm run test:meta-phase5
```

Aplicar o SQL no Supabase. Envio real só após conexão `connected` + código no ar.

## Segurança

Resposta pública passa por `stripMetaSecrets`. Sem token no frontend. RLS + `service_role` nas tabelas.

## Palavras-chave

fase6, MetaCloudProvider, WhatsAppProvider, sendText, sendTemplate, meta_whatsapp_messages, janela-24h, wamid
