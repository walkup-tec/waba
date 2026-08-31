# LOG: 404 PATCH/DELETE campanha — hidratação vs lista

## Causa

`GET /disparos/campanhas` seleciona só `id, campaign_name, status, total_numbers, sent_count, created_at`.

`hydrateCampaignFromDbIfNeeded` pedia **`config_snapshot` na mesma query**. Se a coluna não existir no Supabase ou a seleção falhar, **toda a hidratação falhava**, a campanha não entrava na memória e `PATCH`/`DELETE` devolviam 404 mesmo com a campanha visível na lista.

## Correção

- Hidratar primeiro com as **mesmas colunas base do GET** (sem `config_snapshot`).
- Segunda query opcional só para `config_snapshot`; se falhar, usa `DISPAROS_DEFAULTS`.
- Fallback do `PATCH` (update + select) também **sem** `config_snapshot` no `.select()`.

## Validar

Reiniciar `node dist/index.js` e repetir editar/excluir em campanha listada só pelo Supabase.
