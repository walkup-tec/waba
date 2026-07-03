-- Execute por ÚLTIMO
select
  count(*) filter (where active) as ativas,
  count(*) as total
from public.aquecedor_message_templates;

select message_text
from public.aquecedor_message_templates
where message_text ilike '%poliniza%'
order by created_at
limit 5;
