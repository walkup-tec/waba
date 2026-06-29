-- Execute PRIMEIRO no SQL Editor (UTF-8)
-- Limpa importações antigas com encoding quebrado e recria índice único

create table if not exists public.aquecedor_message_templates (
  id uuid primary key default gen_random_uuid(),
  message_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_aquecedor_message_templates_text_unique
  on public.aquecedor_message_templates (message_text);

truncate table public.aquecedor_message_templates restart identity;

select 'Tabela pronta para importação' as status;
