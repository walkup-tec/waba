# Banco de Dados

## Modelagem

Uso de Supabase para partes da operação. Assinantes e vários estados locais em JSON em `data/` / `/app/data`.

## Tabelas / arquivos principais

| Persistência | Descrição |
|--------------|-----------|
| `waba-subscribers.json` | Cadastro de assinantes (e-mail, WhatsApp, segmento, etc.) |
| Supabase | Campanhas, leads e aquecedor quando `SUPABASE_*` configurado |

## Relacionamentos

_A preencher conforme mapeamento definitivo._

## Migrações importantes

| Data | Migração | Impacto |
|------|----------|---------|
| 2026-09-01 | `doc/SQL-2026-09-01__split-meta-inbox-by-phone-number.sql` | Separa fios/mensagens por receptor e alinha `connection_id` ao número oficial |
| 2026-09-01 | `doc/SQL-2026-09-01__create-meta-template-ai-analyses.sql` | Registra previsão da IA, opções, submissão humana e resultado posterior da Meta |

## Índices relevantes

- `uq_meta_whatsapp_conversations_tenant_phone_contact`: unicidade por
  `tenant_id + phone_number_id + contact_wa_id`.
