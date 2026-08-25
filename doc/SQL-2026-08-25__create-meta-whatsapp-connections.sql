-- WABA — conexões Meta WhatsApp (Tech Provider, por tenant)
-- Executar no SQL Editor do Supabase (service role / postgres). Não aplicar via app.
-- Data: 2026-08-25

create table if not exists public.meta_whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  owner_email text not null,
  meta_business_id text,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  verified_name text,
  access_token_encrypted text not null,
  token_type text not null default 'bearer',
  token_expires_at timestamptz,
  config_id text,
  status text not null default 'pending_token',
  quality_rating text,
  messaging_limit text,
  last_token_validation_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  connected_at timestamptz,
  disconnected_at timestamptz,
  constraint meta_whatsapp_connections_status_chk
    check (status in (
      'pending_token',
      'pending_confirmation',
      'connected',
      'disconnected',
      'error',
      'invalid_token'
    ))
);

comment on table public.meta_whatsapp_connections is
  'Conexões WhatsApp Cloud API por tenant (Tech Provider). Token somente cifrado. Sem acesso anon.';

comment on column public.meta_whatsapp_connections.tenant_id is
  'Identificador interno estável (subscriber.id quando existir). Não usar e-mail como PK.';

comment on column public.meta_whatsapp_connections.owner_email is
  'E-mail de compatibilidade com o Waba atual. Nunca chave exclusiva da integração.';

comment on column public.meta_whatsapp_connections.access_token_encrypted is
  'Token Graph cifrado (AES-256-GCM). Nunca plaintext.';

create index if not exists idx_meta_whatsapp_connections_tenant_id
  on public.meta_whatsapp_connections (tenant_id);

create index if not exists idx_meta_whatsapp_connections_waba_id
  on public.meta_whatsapp_connections (waba_id);

create index if not exists idx_meta_whatsapp_connections_phone_number_id
  on public.meta_whatsapp_connections (phone_number_id);

create index if not exists idx_meta_whatsapp_connections_status
  on public.meta_whatsapp_connections (status);

create index if not exists idx_meta_whatsapp_connections_owner_email
  on public.meta_whatsapp_connections (owner_email);

-- Uma conexão ativa por tenant + WABA + número
create unique index if not exists uq_meta_whatsapp_connections_active_tenant_waba_phone
  on public.meta_whatsapp_connections (tenant_id, waba_id, phone_number_id)
  where disconnected_at is null
    and status in ('pending_token', 'pending_confirmation', 'connected');

-- O mesmo número ativo não pode pertencer a dois tenants
create unique index if not exists uq_meta_whatsapp_connections_active_phone
  on public.meta_whatsapp_connections (phone_number_id)
  where phone_number_id is not null
    and disconnected_at is null
    and status in ('pending_confirmation', 'connected');

create or replace function public.tg_meta_whatsapp_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_whatsapp_connections_updated_at on public.meta_whatsapp_connections;
create trigger trg_meta_whatsapp_connections_updated_at
before update on public.meta_whatsapp_connections
for each row
execute procedure public.tg_meta_whatsapp_connections_updated_at();

alter table public.meta_whatsapp_connections enable row level security;

revoke all on table public.meta_whatsapp_connections from anon, authenticated;
grant all on table public.meta_whatsapp_connections to service_role;
