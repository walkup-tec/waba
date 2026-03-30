# Supabase — erro `relation "disparos_campaigns" does not exist`

## Causa

O projeto Waba grava campanhas em **`public.disparos_campaigns`** e **`public.disparos_campaign_leads`**, mas o script inicial em `doc/SQL-2026-03-21__create-disparos-tables.sql` **não incluía** essas tabelas (só `instancias_uso_config`, `disparos_config`, `disparos_message_templates`). Bancos criados só com esse arquivo ficam sem as tabelas de campanha.

## O que fazer

1. Abra o **Supabase** do projeto ligado ao Waba → **SQL Editor**.
2. Cole e execute **um** dos scripts:
   - **`doc/SQL-2026-03-28__create-disparos-campaigns-only.sql`** — só campanhas (recomendado se o resto já existe), ou
   - **`doc/SQL-2026-03-21__create-disparos-tables.sql`** completo (atualizado; inclui campanhas no final).

3. Confira no **Table Editor** se apareceram `disparos_campaigns` e `disparos_campaign_leads`.

4. A consulta de busca passa a funcionar, por exemplo:

```sql
select id, campaign_name, status, sent_count, total_numbers, created_at
from public.disparos_campaigns
order by created_at desc
limit 50;
```

## Observação

Se as tabelas nunca existiram, **dados antigos de campanha não estarão no Postgres** (só existiam em memória do Node, se o insert falhava silenciosamente no catch). Depois de criar as tabelas, **novas** campanhas passam a persistir.

## Palavras-chave

`disparos_campaigns`, `disparos_campaign_leads`, `42P01`, migration-supabase
