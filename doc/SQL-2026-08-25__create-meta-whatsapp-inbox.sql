-- WABA — conversas e mensagens Meta WhatsApp (Tech Provider, Fase 6)
-- Executar no SQL Editor do Supabase. Não aplicar via app.
-- Data: 2026-08-25
-- Sem tokens. text_content só o necessário para Inbox futura.
-- last_inbound_at observa a janela de atendimento; o envio NÃO é bloqueado por heurística.

create table if not exists public.meta_whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  phone_number_id text,
  contact_wa_id text not null,
  contact_phone text,
  contact_name text,
  status text not null default 'open',
  assigned_to text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_whatsapp_conversations_status_chk
    check (status in ('open', 'pending', 'closed')),
  constraint meta_whatsapp_conversations_unread_chk
    check (unread_count >= 0)
);

comment on table public.meta_whatsapp_conversations is
  'Conversas Cloud API por tenant. Sem CRM. assigned_to reservado para atendimento humano.';

comment on column public.meta_whatsapp_conversations.last_inbound_at is
  'Último inbound conhecido. Usado só para observar janela de 24h; não bloqueia envio.';

comment on column public.meta_whatsapp_conversations.contact_wa_id is
  'wa_id do contato. Unique por tenant+conexão para não duplicar lead.';

create unique index if not exists uq_meta_whatsapp_conversations_tenant_conn_contact
  on public.meta_whatsapp_conversations (tenant_id, connection_id, contact_wa_id);

create index if not exists idx_meta_whatsapp_conversations_tenant_last
  on public.meta_whatsapp_conversations (tenant_id, last_message_at desc);

create table if not exists public.meta_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid not null references public.meta_whatsapp_conversations (id),
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  wamid text,
  direction text not null,
  type text not null,
  status text not null,
  from_wa_id text,
  to_wa_id text,
  text_content text,
  template_name text,
  template_language text,
  provider text not null default 'meta-cloud',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_whatsapp_messages_direction_chk
    check (direction in ('inbound', 'outbound')),
  constraint meta_whatsapp_messages_status_chk
    check (status in (
      'queued',
      'accepted',
      'sent',
      'delivered',
      'read',
      'failed'
    ))
);

comment on table public.meta_whatsapp_messages is
  'Mensagens Cloud API. Sem token e sem payload Graph completo.';

comment on column public.meta_whatsapp_messages.wamid is
  'ID da Meta. Unique quando presente. Idempotência de inbound e de status.';

comment on column public.meta_whatsapp_messages.status is
  'Após POST Graph 200: accepted. delivered/read só via webhook statuses.';

create unique index if not exists uq_meta_whatsapp_messages_wamid
  on public.meta_whatsapp_messages (wamid)
  where wamid is not null;

create index if not exists idx_meta_whatsapp_messages_tenant_conv
  on public.meta_whatsapp_messages (tenant_id, conversation_id, created_at desc);

create index if not exists idx_meta_whatsapp_messages_tenant_wamid
  on public.meta_whatsapp_messages (tenant_id, wamid);

alter table public.meta_whatsapp_conversations enable row level security;
alter table public.meta_whatsapp_messages enable row level security;

revoke all on table public.meta_whatsapp_conversations from anon, authenticated;
revoke all on table public.meta_whatsapp_messages from anon, authenticated;
grant all on table public.meta_whatsapp_conversations to service_role;
grant all on table public.meta_whatsapp_messages to service_role;
