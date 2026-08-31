# LOG — Fase 8 Inbox humana Cloud API

## Contexto do pedido

Primeira Inbox de atendimento humano sobre `meta_whatsapp_conversations` / `meta_whatsapp_messages`. Leve e rápida (lista paginada, preview denormalizado, polling pausável). Base futura para chatbot/IA. Sem Evolution, aquecedor, campanhas, Asaas, LAB legado, commit, push ou deploy.

## Solução

1. Laboratório: Conexão, Inbox, Templates.
2. Três colunas: lista, histórico, ações.
3. Envio reutiliza `MessagingService` → `MetaCloudProvider`.
4. `human_takeover` no assume/release para a Fase 9.
5. Histórico só do banco local; Graph só no envio.

## Arquivos

SQL: `doc/SQL-2026-08-25__alter-meta-whatsapp-inbox-human-takeover.sql`

## Como validar

```bash
npm run test:meta-phase8
npm run test:meta-phase6
npm run test:meta-phase7
```

Aplicar o SQL no Supabase. Inbox real exige conexão `connected` e webhook persistindo inbound.

## Segurança

DTO sem token. IDOR por tenant+conexão. Read interno não envia read receipt à Meta.

## Palavras-chave

fase8, inbox, human_takeover, last_message_preview, customer-care-window, assigned_to
