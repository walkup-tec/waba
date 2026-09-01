-- Assistente IA de templates Meta — histórico GPT x resultado real da Meta.
-- Executar no SQL Editor do Supabase antes de ativar a interface.

create table if not exists public.meta_whatsapp_template_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  waba_id text not null,
  created_by text not null,
  base_text text not null,
  requested_category text not null default 'UTILITY',
  recommended_category text not null,
  utility_compatibility integer not null,
  risk_level text not null,
  eligible_for_utility boolean not null,
  reason text not null,
  result_json jsonb not null,
  model text not null,
  openai_response_id text,
  prompt_version text not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  constraint meta_template_ai_score_chk
    check (utility_compatibility between 0 and 100),
  constraint meta_template_ai_risk_chk
    check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  constraint meta_template_ai_requested_category_chk
    check (requested_category in ('UTILITY', 'MARKETING')),
  constraint meta_template_ai_recommended_category_chk
    check (recommended_category in ('UTILITY', 'MARKETING'))
);

create table if not exists public.meta_whatsapp_template_ai_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  analysis_id uuid not null
    references public.meta_whatsapp_template_ai_analyses (id) on delete cascade,
  connection_id uuid not null references public.meta_whatsapp_connections (id),
  template_id uuid not null references public.meta_whatsapp_templates (id) on delete cascade,
  meta_template_id text,
  option_index integer,
  submitted_template_json jsonb not null,
  submitted_category text not null,
  meta_status text,
  meta_category text,
  meta_rejected_reason text,
  submitted_at timestamptz not null default now(),
  meta_outcome_at timestamptz,
  constraint meta_template_ai_submission_option_chk
    check (option_index is null or option_index between 0 and 2),
  unique (tenant_id, analysis_id, template_id)
);

create index if not exists idx_meta_template_ai_tenant_created
  on public.meta_whatsapp_template_ai_analyses (tenant_id, created_at desc);

create index if not exists idx_meta_template_ai_submission_template
  on public.meta_whatsapp_template_ai_submissions (tenant_id, template_id);

create index if not exists idx_meta_template_ai_submission_meta
  on public.meta_whatsapp_template_ai_submissions (tenant_id, meta_template_id)
  where meta_template_id is not null;

alter table public.meta_whatsapp_template_ai_analyses enable row level security;
alter table public.meta_whatsapp_template_ai_submissions enable row level security;
revoke all on table public.meta_whatsapp_template_ai_analyses from anon, authenticated;
revoke all on table public.meta_whatsapp_template_ai_submissions from anon, authenticated;
grant all on table public.meta_whatsapp_template_ai_analyses to service_role;
grant all on table public.meta_whatsapp_template_ai_submissions to service_role;

comment on table public.meta_whatsapp_template_ai_analyses is
  'Análises internas do Assistente de Templates. Não representam decisão oficial da Meta.';

comment on table public.meta_whatsapp_template_ai_submissions is
  'Uma análise pode originar até três templates submetidos separadamente à Meta.';
