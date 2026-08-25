# LOG — Fase 7 templates WhatsApp Cloud API

## Contexto do pedido

Implementar gerenciamento de templates da WABA por tenant conectado no fluxo Tech Provider: listar, criar, sincronizar, acompanhar aprovação/rejeição via webhook e usar no envio. UI na seção Laboratório. Sem Inbox UI, chatbot, IA, automação, commit, push ou deploy.

## Ações executadas

- SQL `meta_whatsapp_templates` (RLS, unique tenant+WABA+name+language, sem token)
- Cliente Graph GET/POST `/{WABA_ID}/message_templates` com `META_GRAPH_VERSION` e paginação de cursor
- Endpoints autenticados de listagem, criação e sync
- Webhook `message_template_status_update` atualiza status local
- `MetaCloudProvider.sendTemplate()` só após template local APPROVED do mesmo tenant/conexão
- Tela Laboratório → Templates WhatsApp

## Solução

1. Sessão → tenant_id → conexão `connected` → decrypt do token → Graph.
2. Frontend envia só DTO (name, language, category, components). BODY obrigatório; exemplos de `{{n}}` só se o usuário informar.
3. Sync faz upsert; não apaga locais ausentes numa página parcial.
4. Status/categoria persistidos como a Meta devolve.

## Arquivos criados/alterados

SQL: `doc/SQL-2026-08-25__create-meta-whatsapp-templates.sql`

## Como validar

```bash
npm run test:meta-phase7
npm run test:meta-phase5
npm run test:meta-phase6
```

Aplicar o SQL no Supabase. Criação/listagem real exige conexão `connected` e código no ar.

## Segurança

DTO público sem token. Logs `[META][TEMPLATE][*]` sanitizados. RLS + `service_role`.

## Palavras-chave

fase7, message_templates, meta_whatsapp_templates, whatsapp-templates, App Review whatsapp_business_management
