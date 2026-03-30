# Disparador — recuperar campanha após deploy, expediente e continuidade

## Contexto

Campanha (ex.: nome parecido com «CLT 02 V8») «sumiu» após atualização; objetivos: retomar do último número enviado, expediente 08h–22h seg–dom, ativar e listar.

## Onde os dados vivem

- **Lista** `GET /disparos/campanhas` já une **Postgres** (`disparos_campaigns` / `config_snapshot`) + memória.
- **Disparo em si** usa **memória** (`disparosCampaignsMemory` + `disparosCampaignLeadsMemory`). Após **restart**, se a campanha estava só no banco com status `running`, o tick não enviava até reidratar.

**Se a linha não existir no Supabase** (falha de insert no dia ou ambiente sem `SUPABASE_*`), **não há como reconstruir** a lista de destinos só pelo código deste repositório — seria necessário backup (planilha original, export SQL, etc.).

## O que foi implementado

1. **`hydrateRunningCampaignsFromDbOnStartup`** — ao subir o servidor (com `ENABLE_BACKGROUND_PROCESSING` e fora de manutenção), busca campanhas com `status = running` e chama `hydrateCampaignFromDbIfNeeded` para cada uma (campanha + leads).

2. **`PATCH /disparos/campanhas/:id/config`** — mescla um JSON parcial no `config_snapshot` atual, aplica `parseDisparosConfig` e persiste em `disparos_campaigns.config_snapshot` (e memória, se a campanha estiver carregada).

## Continuidade «a partir do último disparado»

Não é preciso ajuste extra: leads com `status = sent` (e `sent_count` no cabeçalho) já vêm do banco; o processador pega o **primeiro lead `pending`**. Garanta que `sent_count` e os leads no banco estejam coerentes (como após envios normais).

## Passos para você (operacional)

### 1) Achar o `id` da campanha no Supabase

SQL (Table Editor ou SQL Editor):

```sql
select id, campaign_name, status, sent_count, total_numbers, created_at
from disparos_campaigns
where campaign_name ilike '%CLT%'
order by created_at desc;
```

Copie o **`id`** (UUID).

### 2) Expediente seg–dom, 8h–22h

`PATCH` (substitua `PORT` e `UUID`):

```http
PATCH /disparos/campanhas/UUID/config
Content-Type: application/json

{
  "workingDays": ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
  "startHour": 8,
  "endHour": 22
}
```

Exemplo curl:

```bash
curl -s -X PATCH "http://localhost:3000/disparos/campanhas/UUID/config" ^
  -H "Content-Type: application/json" ^
  -d "{\"workingDays\":[\"seg\",\"ter\",\"qua\",\"qui\",\"sex\",\"sab\",\"dom\"],\"startHour\":8,\"endHour\":22}"
```

(PowerShell: use `Invoke-RestMethod` ou aspas simples no JSON.)

### 3) Ativar

```http
POST /disparos/campanhas/UUID/estado
Content-Type: application/json

{ "ativa": true }
```

Isso também **hidrata** a campanha na memória se ainda não estiver.

### 4) Listagem

Recarregue a aba Disparos; `GET /disparos/campanhas` deve mostrar a campanha se a linha existir no banco.

## Arquivos alterados

- `src/index.ts` — `hydrateRunningCampaignsFromDbOnStartup`, rota `PATCH .../config`, chamada no `app.listen`.

## Palavras-chave

`disparos_campaigns`, `hydrateCampaignFromDbIfNeeded`, `PATCH disparos campanhas config`, expediente-disparador, startup-hydrate
