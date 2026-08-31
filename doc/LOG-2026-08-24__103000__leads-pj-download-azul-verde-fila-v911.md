# LOG — Leads PJ: fila diária + botão Excel azul/verde

## Contexto

1. Fila: enriquecer até o teto do dia; gerar Excel parcial; resto continua no pool no dia seguinte.
2. Botão Baixar Excel: sem sublinhado; azul se não baixou; verde após download.

## Fila (já no backend — confirmado)

- `takeFromPool(dailyLimit)` (~2880/dia com delay 30s)
- Virada SP: `finalizeEnrichDayNow` → Excel Lista NN do enriquecido; leftover volta ao pool
- `armGlobalEnrichQueue` / 1 campanha ativa por dia
- Comentário no service: «botão azul → verde» via `markDownloaded` / `downloadedAt`

## UI (v9.11)

- Classes `mlc-dl-pending` (azul) / `mlc-dl-done` (verde)
- `text-decoration: none` no link
- Após clique: refresh silencioso do histórico (~900ms) para pintar verde
- Botões por `campaignDownloads` (Lista 01…) ou Excel da linha

Marker: `DEPLOY-2026-08-24-1030-leads-pj-download-azul-verde-v9.11`

## Palavras-chave

`fila diária`, `downloadedAt`, `Baixar Excel`, `azul`, `verde`, `v9.11`
