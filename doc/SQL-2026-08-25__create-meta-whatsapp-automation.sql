-- WABA — automação/chatbot Meta WhatsApp (Tech Provider, Fase 9)
-- Executar no SQL Editor do Supabase. Não aplicar via app.
-- Data: 2026-08-25
-- Sem tokens. Isolamento por tenant_id + connection_id.

-- ---------------------------------------------------------------------------
-- Settings (automação on/off + horário comercial + rate limit)
-- ---------------------------------------------------------------------------
create table if not exists public.meta_whatsapp_automation_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  enabled boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  business_days smallint[] not null default '{1,2,3,4,5}',
  business_start text not null default '08:00',
  business_end text not null default '18:00',
  rate_limit_count integer not null default 10,
  rate_limit_window_seconds integer not null default 300,
  rate_limit_takeover boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_meta_wa_auto_settings_rate_count check (rate_limit_count >= 1 and rate_limit_count <= 100),
  constraint chk_meta_wa_auto_settings_rate_window check (rate_limit_window_seconds >= 30 and rate_limit_window_seconds <= 86400)
);

comment on table public.meta_whatsapp_automation_settings is
  'Controle de chatbot por conexão. Desligar não desconecta a WABA. Sem tokens.';

comment on column public.meta_whatsapp_automation_settings.business_days is
  'ISO: 1=segunda … 7=domingo.';

create unique index if not exists uq_meta_whatsapp_automation_settings_tenant_conn
  on public.meta_whatsapp_automation_settings (tenant_id, connection_id);

alter table public.meta_whatsapp_automation_settings enable row level security;
revoke all on table public.meta_whatsapp_automation_settings from anon, authenticated;
grant all on table public.meta_whatsapp_automation_settings to service_role;

create or replace function public.tg_meta_whatsapp_automation_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_whatsapp_automation_settings_updated_at
  on public.meta_whatsapp_automation_settings;
create trigger trg_meta_whatsapp_automation_settings_updated_at
before update on public.meta_whatsapp_automation_settings
for each row
execute procedure public.tg_meta_whatsapp_automation_settings_updated_at();

-- ---------------------------------------------------------------------------
-- Flows
-- ---------------------------------------------------------------------------
create table if not exists public.meta_whatsapp_automation_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  name text not null,
  status text not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_meta_wa_auto_flows_status check (status in ('active', 'inactive'))
);

comment on table public.meta_whatsapp_automation_flows is
  'Fluxos de automação por tenant/conexão. Sem tokens. First matching rule wins.';

create index if not exists idx_meta_whatsapp_automation_flows_tenant_conn
  on public.meta_whatsapp_automation_flows (tenant_id, connection_id, updated_at desc);

create unique index if not exists uq_meta_whatsapp_automation_flows_default
  on public.meta_whatsapp_automation_flows (tenant_id, connection_id)
  where is_default = true;

alter table public.meta_whatsapp_automation_flows enable row level security;
revoke all on table public.meta_whatsapp_automation_flows from anon, authenticated;
grant all on table public.meta_whatsapp_automation_flows to service_role;

create or replace function public.tg_meta_whatsapp_automation_flows_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_whatsapp_automation_flows_updated_at
  on public.meta_whatsapp_automation_flows;
create trigger trg_meta_whatsapp_automation_flows_updated_at
before update on public.meta_whatsapp_automation_flows
for each row
execute procedure public.tg_meta_whatsapp_automation_flows_updated_at();

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------
create table if not exists public.meta_whatsapp_automation_rules (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.meta_whatsapp_automation_flows (id) on delete cascade,
  tenant_id uuid not null,
  priority integer not null default 100,
  trigger_type text not null,
  trigger_value text,
  action_type text not null,
  action_payload jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_meta_wa_auto_rules_priority check (priority >= 1 and priority <= 10000),
  constraint chk_meta_wa_auto_rules_trigger check (
    trigger_type in (
      'ANY_INBOUND',
      'FIRST_INBOUND',
      'KEYWORD',
      'EXACT_TEXT',
      'OUTSIDE_BUSINESS_HOURS',
      'INSIDE_BUSINESS_HOURS'
    )
  ),
  constraint chk_meta_wa_auto_rules_action check (
    action_type in (
      'SEND_TEXT',
      'SEND_TEMPLATE',
      'SET_STATUS',
      'ASSIGN_HUMAN',
      'ENABLE_HUMAN_TAKEOVER',
      'DISABLE_AUTOMATION',
      'DELAY'
    )
  )
);

comment on table public.meta_whatsapp_automation_rules is
  'Regras do fluxo. Matching literal (trim/case/acento). Sem regex do frontend. Sem tokens.';

create index if not exists idx_meta_whatsapp_automation_rules_flow_priority
  on public.meta_whatsapp_automation_rules (tenant_id, flow_id, priority asc, created_at asc);

alter table public.meta_whatsapp_automation_rules enable row level security;
revoke all on table public.meta_whatsapp_automation_rules from anon, authenticated;
grant all on table public.meta_whatsapp_automation_rules to service_role;

create or replace function public.tg_meta_whatsapp_automation_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_whatsapp_automation_rules_updated_at
  on public.meta_whatsapp_automation_rules;
create trigger trg_meta_whatsapp_automation_rules_updated_at
before update on public.meta_whatsapp_automation_rules
for each row
execute procedure public.tg_meta_whatsapp_automation_rules_updated_at();

-- ---------------------------------------------------------------------------
-- Runs (idempotência + auditoria)
-- ---------------------------------------------------------------------------
create table if not exists public.meta_whatsapp_automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid,
  conversation_id uuid not null,
  message_id uuid not null,
  flow_id uuid,
  rule_id uuid,
  status text not null default 'received',
  action_type text,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint chk_meta_wa_auto_runs_status check (
    status in ('received', 'skipped', 'matched', 'sent', 'blocked', 'error')
  )
);

comment on table public.meta_whatsapp_automation_runs is
  'Um processamento inicial por inbound (tenant_id + message_id). Sem tokens. Sem corpo da mensagem.';

create unique index if not exists uq_meta_whatsapp_automation_runs_tenant_message
  on public.meta_whatsapp_automation_runs (tenant_id, message_id);

create index if not exists idx_meta_whatsapp_automation_runs_conv_created
  on public.meta_whatsapp_automation_runs (tenant_id, conversation_id, created_at desc);

alter table public.meta_whatsapp_automation_runs enable row level security;
revoke all on table public.meta_whatsapp_automation_runs from anon, authenticated;
grant all on table public.meta_whatsapp_automation_runs to service_role;
