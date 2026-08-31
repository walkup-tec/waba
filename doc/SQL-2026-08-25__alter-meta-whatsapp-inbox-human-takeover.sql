-- WABA — Inbox humana (Tech Provider, Fase 8)
-- Executar no SQL Editor do Supabase. Não aplicar via app.
-- Data: 2026-08-25
-- human_takeover: atendente assumiu; Fase 9 o chatbot não responde.
-- last_message_preview: evita N+1 na lista da Inbox.

alter table public.meta_whatsapp_conversations
  add column if not exists human_takeover boolean not null default false;

alter table public.meta_whatsapp_conversations
  add column if not exists last_message_preview text;

comment on column public.meta_whatsapp_conversations.human_takeover is
  'true quando um atendente assumiu a conversa. Reservado para o chatbot da Fase 9.';

comment on column public.meta_whatsapp_conversations.last_message_preview is
  'Trecho curto da última mensagem. Só Inbox; sem payload Graph.';

create index if not exists idx_meta_whatsapp_conversations_tenant_status
  on public.meta_whatsapp_conversations (tenant_id, status, last_message_at desc);

create index if not exists idx_meta_whatsapp_conversations_tenant_assigned
  on public.meta_whatsapp_conversations (tenant_id, assigned_to, last_message_at desc)
  where assigned_to is not null;
