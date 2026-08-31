-- Executar no Supabase (SQL Editor) se as tabelas disparos_campaigns / disparos_campaign_leads
-- ainda não existirem. Idempotente (IF NOT EXISTS).
-- O backend Waba espera estes nomes em public.

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
