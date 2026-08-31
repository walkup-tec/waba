-- WABA — templates Meta WhatsApp (Tech Provider, Fase 7)
-- Executar no SQL Editor do Supabase. Não aplicar via app.
-- Data: 2026-08-25
-- Sem tokens. components_json é o conteúdo do template, não o payload Graph de envio.

create table if not exists public.meta_whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  waba_id text not null,
  meta_template_id text,
  name text not null,
  language text not null,
  category text,
  status text,
  components_json jsonb,
  quality_score text,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz
);

comment on table public.meta_whatsapp_templates is
  'Templates Cloud API por tenant/WABA. Sem token. Status/categoria conforme a Meta.';

comment on column public.meta_whatsapp_templates.category is
  'Valor retornado pela Meta (ex.: MARKETING, UTILITY, AUTHENTICATION). Não inventar categoria.';

comment on column public.meta_whatsapp_templates.status is
  'PENDING, APPROVED, REJECTED, PAUSED, DISABLED ou outro estado oficial da Meta.';

create unique index if not exists uq_meta_whatsapp_templates_tenant_waba_name_lang
  on public.meta_whatsapp_templates (tenant_id, waba_id, name, language);

create unique index if not exists uq_meta_whatsapp_templates_tenant_meta_id
  on public.meta_whatsapp_templates (tenant_id, meta_template_id)
  where meta_template_id is not null;

create index if not exists idx_meta_whatsapp_templates_tenant_conn
  on public.meta_whatsapp_templates (tenant_id, connection_id, updated_at desc);

alter table public.meta_whatsapp_templates enable row level security;
revoke all on table public.meta_whatsapp_templates from anon, authenticated;
grant all on table public.meta_whatsapp_templates to service_role;

create or replace function public.tg_meta_whatsapp_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_whatsapp_templates_updated_at on public.meta_whatsapp_templates;
create trigger trg_meta_whatsapp_templates_updated_at
before update on public.meta_whatsapp_templates
for each row
execute procedure public.tg_meta_whatsapp_templates_updated_at();
