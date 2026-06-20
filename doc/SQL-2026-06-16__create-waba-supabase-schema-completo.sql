-- WABA — schema completo Supabase (projeto novo)
-- Executar no SQL Editor do projeto: wcexaxeenvuigktyomdq
-- Ordem: rodar este arquivo inteiro de uma vez.

-- =============================================================================
-- AQUECEDOR — fila, instâncias, ciclo, logs
-- =============================================================================

create table if not exists public.aquecedor (
  id bigserial primary key,
  mensagem text not null default '',
  status text not null default 'PENDENTE',
  scheduled_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  instancia text,
  numero_destino text,
  created_at timestamptz not null default now()
);

create index if not exists idx_aquecedor_status_scheduled
  on public.aquecedor (status, scheduled_at);

-- Banco de textos do aquecedor (fila `aquecedor` consome um por envio)
create table if not exists public.aquecedor_message_templates (
  id uuid primary key default gen_random_uuid(),
  message_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_aquecedor_message_templates_active_created
  on public.aquecedor_message_templates (active, created_at desc);

create table if not exists public.controle_instancia (
  instancia text primary key,
  numero_whatsapp text not null default ''
);

create table if not exists public.controle_ciclo (
  id int primary key,
  ciclo_global int not null default 0
);

insert into public.controle_ciclo (id, ciclo_global)
values (1, 0)
on conflict (id) do nothing;

create table if not exists public.logs_envios (
  id bigserial primary key,
  ciclo_global int,
  instancia_origem text not null,
  instancia_destino text not null,
  data_envio timestamptz not null default now()
);

create index if not exists idx_logs_envios_data_envio
  on public.logs_envios (data_envio desc);

create or replace view public.logs_envios_br as
select
  id,
  ciclo_global,
  instancia_origem,
  instancia_destino,
  data_envio as created_at,
  (data_envio at time zone 'America/Sao_Paulo')::timestamp without time zone as data_envio_br
from public.logs_envios;

create table if not exists public.aquecedor_config (
  id int primary key,
  use_recommended boolean not null default true,
  custom_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.aquecedor_config (id, use_recommended, custom_config, updated_at)
values (
  1,
  true,
  '{
    "windowMonWedStartHour": 7,
    "windowMonWedEndHour": 22,
    "windowThuSunStartHour": 6,
    "windowThuSunEndHour": 20,
    "activeWindowMinutes": 60,
    "pauseMonWedMinutes": 14,
    "pauseThuSunMinutes": 17,
    "waitMinSeconds": 180,
    "waitMaxSeconds": 480
  }'::jsonb,
  now()
)
on conflict (id) do update
set
  use_recommended = excluded.use_recommended,
  custom_config = excluded.custom_config,
  updated_at = excluded.updated_at;

-- =============================================================================
-- INSTÂNCIAS — flags Aquecedor / Disparador
-- =============================================================================

create table if not exists public.instancias_uso_config (
  instance_name text primary key,
  use_aquecedor boolean not null default true,
  use_disparador boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_instancias_uso_config_updated_at
  on public.instancias_uso_config (updated_at desc);

-- =============================================================================
-- DISPAROS — config, templates, campanhas
-- =============================================================================

create table if not exists public.disparos_config (
  id int primary key,
  custom_config jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.disparos_config (id, custom_config, updated_at)
values (
  1,
  '{
    "lockTtlSeconds": 600,
    "delayMinSeconds": 120,
    "delayMaxSeconds": 320,
    "maxPerHourPerInstance": 40,
    "maxPerDayPerInstance": 130,
    "workingDays": ["seg", "ter", "qua", "qui", "sex"],
    "startHour": 8,
    "endHour": 22,
    "messageMode": "ai",
    "aiBriefing": "",
    "aiTone": "consultivo",
    "aiCta": "Responda no link abaixo",
    "aiAudience": "CORBAN",
    "shortenerProvider": "cleanuri",
    "shortenerDomain": "",
    "whatsappTargetNumber": ""
  }'::jsonb,
  now()
)
on conflict (id) do update
set
  custom_config = excluded.custom_config,
  updated_at = excluded.updated_at;

create table if not exists public.disparos_message_templates (
  id uuid primary key,
  message_text text not null,
  alias text not null default '',
  segment text not null default '',
  source text not null default 'spreadsheet',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_disparos_templates_active_created
  on public.disparos_message_templates (active, created_at desc);

create table if not exists public.disparos_campaigns (
  id uuid primary key,
  campaign_name text not null,
  status text not null default 'paused',
  total_numbers int not null default 0,
  sent_count int not null default 0,
  config_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint disparos_campaigns_status_chk check (
    status in ('draft', 'running', 'paused', 'finished')
  )
);

create index if not exists idx_disparos_campaigns_status_created
  on public.disparos_campaigns (status, created_at desc);

create table if not exists public.disparos_campaign_leads (
  id uuid primary key,
  campaign_id uuid not null references public.disparos_campaigns (id) on delete cascade,
  phone text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint disparos_campaign_leads_status_chk check (
    status in ('pending', 'sent', 'failed')
  )
);

create index if not exists idx_disparos_campaign_leads_campaign_status
  on public.disparos_campaign_leads (campaign_id, status);

create index if not exists idx_disparos_campaign_leads_campaign_id
  on public.disparos_campaign_leads (campaign_id);
