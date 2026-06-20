-- Banco de mensagens do Aquecedor (textos variados; fila `aquecedor` consome um por ciclo)
create table if not exists public.aquecedor_message_templates (
  id uuid primary key default gen_random_uuid(),
  message_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_aquecedor_message_templates_active_created
  on public.aquecedor_message_templates (active, created_at desc);

-- Opcional: migrar textos já usados na fila antiga (produção com milhares de linhas)
-- insert into public.aquecedor_message_templates (message_text)
-- select distinct mensagem
-- from public.aquecedor
-- where trim(mensagem) <> ''
--   and mensagem not ilike '%automática do aquecedor%'
--   and mensagem not ilike '%teste do aquecedor%'
-- on conflict do nothing;
