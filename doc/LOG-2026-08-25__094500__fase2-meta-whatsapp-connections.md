# LOG — Fase 2 Tech Provider Meta (conexões por tenant)

## Contexto

Após auditoria aprovada: persistir conexões Meta no Supabase (não JSON), tenant_id estável, AES-256-GCM, cortar vazamento de token no Embedded Signup.

## Ações

- Migration SQL `doc/SQL-2026-08-25__create-meta-whatsapp-connections.sql`
- Módulo `src/integrations/meta-whatsapp/`
- Callback `POST /integrations/meta/whatsapp/callback`
- Exchange legado deixa de devolver `accessToken`
- Testes `npm run test:meta-phase2`

## Não feito (fora da Fase 2)

Webhook, envio, templates, App Review, commit, deploy, menu.

## Palavras-chave

meta, tech-provider, supabase, aes-256-gcm, tenant_id, embedded-signup
