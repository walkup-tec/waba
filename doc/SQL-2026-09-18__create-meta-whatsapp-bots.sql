-- WABA — bots do Inbox Cloud META (FARM BM)
-- Executar no SQL Editor do Supabase quando for persistir em banco.
-- NÃO aplicar via app. NÃO aplicar em produção sem autorização.
-- Data: 2026-09-18
-- Sem tokens. Isolamento por tenant_id.
-- A implementação atual usa store em disco (data/meta-whatsapp/bots/).
-- Estas tabelas são o contrato opcional para migração futura.

create table if not exists public.meta_whatsapp_bots (
  id text primary key,
  tenant_id text not null,
  name text not null,
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meta_whatsapp_bots is
  'Fluxos reutilizáveis de bot por tenant. Sem tokens. Um bot pode ser associado a vários números Inbox.';

create index if not exists idx_meta_whatsapp_bots_tenant_updated
  on public.meta_whatsapp_bots (tenant_id, updated_at desc);

alter table public.meta_whatsapp_bots enable row level security;
revoke all on table public.meta_whatsapp_bots from anon, authenticated;
grant all on table public.meta_whatsapp_bots to service_role;

create table if not exists public.meta_whatsapp_bot_phone_links (
  tenant_id text not null,
  phone_number_id text not null,
  bot_id text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, phone_number_id)
);

comment on table public.meta_whatsapp_bot_phone_links is
  'Associação número Inbox (phone_number_id) → bot reutilizável. Isolado por tenant.';

create index if not exists idx_meta_whatsapp_bot_phone_links_bot
  on public.meta_whatsapp_bot_phone_links (tenant_id, bot_id);

alter table public.meta_whatsapp_bot_phone_links enable row level security;
revoke all on table public.meta_whatsapp_bot_phone_links from anon, authenticated;
grant all on table public.meta_whatsapp_bot_phone_links to service_role;

create table if not exists public.meta_whatsapp_bot_runs (
  tenant_id text not null,
  conversation_id text not null,
  run jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, conversation_id)
);

comment on table public.meta_whatsapp_bot_runs is
  'Estado da execução do bot por conversa Inbox. Sem tokens.';

alter table public.meta_whatsapp_bot_runs enable row level security;
revoke all on table public.meta_whatsapp_bot_runs from anon, authenticated;
grant all on table public.meta_whatsapp_bot_runs to service_role;

create table if not exists public.meta_whatsapp_bot_claims (
  tenant_id text not null,
  message_id text not null,
  conversation_id text not null,
  bot_id text not null,
  handled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, message_id)
);

comment on table public.meta_whatsapp_bot_claims is
  'Idempotência por messageId/wamid persistido. Impede o bot e a Fase 9 responderem o mesmo inbound.';

alter table public.meta_whatsapp_bot_claims enable row level security;
revoke all on table public.meta_whatsapp_bot_claims from anon, authenticated;
grant all on table public.meta_whatsapp_bot_claims to service_role;
