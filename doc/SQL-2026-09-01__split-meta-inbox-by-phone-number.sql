-- Separa conversas Meta por número oficial receptor.
-- Idempotente. Aplicar no SQL Editor do Supabase antes/depois do deploy do código.
-- Chave: tenant_id + phone_number_id + contact_wa_id.

begin;

drop index if exists public.uq_meta_whatsapp_conversations_tenant_conn_contact;

do $$
declare
  source record;
  receiver_phone text;
  target_id uuid;
  target_connection_id uuid;
begin
  for source in
    select *
      from public.meta_whatsapp_conversations
     order by created_at
  loop
    for receiver_phone in
      select distinct case
        when m.direction = 'inbound' then nullif(trim(m.to_wa_id), '')
        when m.direction = 'outbound' then nullif(trim(m.from_wa_id), '')
        else null
      end
        from public.meta_whatsapp_messages m
       where m.tenant_id = source.tenant_id
         and m.conversation_id = source.id
         and case
           when m.direction = 'inbound' then nullif(trim(m.to_wa_id), '')
           when m.direction = 'outbound' then nullif(trim(m.from_wa_id), '')
           else null
         end is not null
       order by 1
    loop
      if source.phone_number_id is null then
        update public.meta_whatsapp_conversations
           set phone_number_id = receiver_phone,
               updated_at = now()
         where id = source.id;
        source.phone_number_id := receiver_phone;
      end if;

      if receiver_phone = source.phone_number_id then
        continue;
      end if;

      select c.id
        into target_id
        from public.meta_whatsapp_conversations c
       where c.tenant_id = source.tenant_id
         and c.phone_number_id = receiver_phone
         and c.contact_wa_id = source.contact_wa_id
         and c.id <> source.id
       order by c.created_at
       limit 1;

      if target_id is null then
        select m.connection_id
          into target_connection_id
          from public.meta_whatsapp_messages m
         where m.tenant_id = source.tenant_id
           and m.conversation_id = source.id
           and case
             when m.direction = 'inbound' then nullif(trim(m.to_wa_id), '')
             when m.direction = 'outbound' then nullif(trim(m.from_wa_id), '')
             else null
           end = receiver_phone
         order by m.created_at desc
         limit 1;

        insert into public.meta_whatsapp_conversations (
          tenant_id, connection_id, phone_number_id, contact_wa_id,
          contact_phone, contact_name, status, assigned_to, unread_count,
          human_takeover, created_at, updated_at
        ) values (
          source.tenant_id,
          coalesce(target_connection_id, source.connection_id),
          receiver_phone,
          source.contact_wa_id,
          source.contact_phone,
          source.contact_name,
          source.status,
          source.assigned_to,
          0,
          source.human_takeover,
          source.created_at,
          now()
        )
        returning id into target_id;
      end if;

      update public.meta_whatsapp_messages m
         set conversation_id = target_id,
             updated_at = now()
       where m.tenant_id = source.tenant_id
         and m.conversation_id = source.id
         and case
           when m.direction = 'inbound' then nullif(trim(m.to_wa_id), '')
           when m.direction = 'outbound' then nullif(trim(m.from_wa_id), '')
           else null
         end = receiver_phone;

      target_id := null;
      target_connection_id := null;
    end loop;
  end loop;

  -- Recalcula os resumos de cada fio sem alterar status/responsável.
  with stats as (
    select
      m.tenant_id,
      m.conversation_id,
      max(m.created_at) as last_message_at,
      max(m.created_at) filter (where m.direction = 'inbound') as last_inbound_at,
      max(m.created_at) filter (where m.direction = 'outbound') as last_outbound_at,
      (array_agg(coalesce(m.text_content, '[' || m.type || ']') order by m.created_at desc))[1]
        as last_message_preview
    from public.meta_whatsapp_messages m
    group by m.tenant_id, m.conversation_id
  )
  update public.meta_whatsapp_conversations c
     set last_message_at = stats.last_message_at,
         last_inbound_at = stats.last_inbound_at,
         last_outbound_at = stats.last_outbound_at,
         last_message_preview = stats.last_message_preview,
         updated_at = now()
    from stats
   where stats.tenant_id = c.tenant_id
     and stats.conversation_id = c.id;
end $$;

create unique index if not exists uq_meta_whatsapp_conversations_tenant_phone_contact
  on public.meta_whatsapp_conversations (tenant_id, phone_number_id, contact_wa_id)
  where phone_number_id is not null;

comment on column public.meta_whatsapp_conversations.contact_wa_id is
  'wa_id do contato. Cada número oficial receptor mantém seu próprio fio.';

commit;
