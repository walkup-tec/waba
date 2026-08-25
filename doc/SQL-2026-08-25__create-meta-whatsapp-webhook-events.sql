-- WABA — auditoria de webhooks Meta WhatsApp (Tech Provider)
-- Executar no SQL Editor do Supabase. Não aplicar via app.
-- Data: 2026-08-25
-- Não armazena texto de mensagem nem tokens.

create table if not exists public.meta_whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  tenant_id uuid,
  waba_id text,
  phone_number_id text,
  event_type text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  error text,
  constraint meta_whatsapp_webhook_events_status_chk
    check (status in (
      'received',
      'processed',
      'duplicate',
      'unmatched_tenant',
      'ignored',
      'error'
    ))
);

comment on table public.meta_whatsapp_webhook_events is
  'Idempotência e auditoria de webhooks Cloud API. Sem corpo de mensagem e sem tokens.';

comment on column public.meta_whatsapp_webhook_events.event_key is
  'Chave determinística (wamid/status id ou hash). Unique global.';

comment on column public.meta_whatsapp_webhook_events.tenant_id is
  'Resolvido no servidor via phone_number_id/waba_id. Nunca aceito do payload como tenant.';

comment on column public.meta_whatsapp_webhook_events.payload_hash is
  'SHA-256 hex do raw body. Não é o payload em claro.';

create unique index if not exists uq_meta_whatsapp_webhook_events_event_key
  on public.meta_whatsapp_webhook_events (event_key);

create index if not exists idx_meta_whatsapp_webhook_events_tenant_received
  on public.meta_whatsapp_webhook_events (tenant_id, received_at desc);

create index if not exists idx_meta_whatsapp_webhook_events_phone
  on public.meta_whatsapp_webhook_events (phone_number_id);

alter table public.meta_whatsapp_webhook_events enable row level security;

revoke all on table public.meta_whatsapp_webhook_events from anon, authenticated;
grant all on table public.meta_whatsapp_webhook_events to service_role;
