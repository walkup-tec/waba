-- Tabela de configuracao do Aquecedor (registro unico id=1)
create table if not exists aquecedor_config (
  id int primary key,
  use_recommended boolean not null default true,
  custom_config jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed opcional do registro padrao
insert into aquecedor_config (id, use_recommended, custom_config, updated_at)
values (
  1,
  true,
  '{
    "windowMonWedStartHour": 7,
    "windowMonWedEndHour": 22,
    "windowThuSunStartHour": 6,
    "windowThuSunEndHour": 20,
    "activeWindowMinutes": 60,
    "pauseMonWedMinutes": 14,
    "pauseThuSunMinutes": 17,
    "waitMinSeconds": 180,
    "waitMaxSeconds": 480
  }'::jsonb,
  now()
)
on conflict (id) do update
set
  use_recommended = excluded.use_recommended,
  custom_config = excluded.custom_config,
  updated_at = excluded.updated_at;
