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
    "delayMinSeconds": 90,
    "delayMaxSeconds": 240,
    "maxPerHourPerInstance": 60,
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
