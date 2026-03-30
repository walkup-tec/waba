-- Config de uso por instância (Aquecedor / Disparador)
create table if not exists public.instancias_uso_config (
  instance_name text primary key,
  use_aquecedor boolean not null default true,
  use_disparador boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_instancias_uso_config_updated_at
  on public.instancias_uso_config (updated_at desc);

-- Configuração central do Disparador (registro único id=1)
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

-- Base de templates de mensagens importadas/manual
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

-- Campanhas do Disparador (lista + snapshot de config por campanha)
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

-- Destinos (leads) por campanha: pending → sent | failed
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
