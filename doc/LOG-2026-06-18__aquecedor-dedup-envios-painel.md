# LOG — Aquecedor: duplicata no painel de envios

**Data:** 2026-06-18

## Sintoma
`soma → walkup` e `soma → drax` apareciam 2x no painel (16:35:24 e 16:35:25).

## Causa
Cada envio gravava em **dois lugares**:
- `aquecedor-envios-log.json` (local)
- `logs_envios` (Supabase)

`/aquecedor/envios` mesclava os dois; timestamps com ms diferentes geravam 2 linhas para **1** envio real.

Log local confirmou **1** registro por par no horário citado.

## Correção
- Painel: com Supabase, ignora sucesso do arquivo local; dedup por `origem|destino|dataEnvioBr`
- Motor: `hasRecentAquecedorSendBetween()` bloqueia reenvio do mesmo par em 120s (dois processos)

## Marker
`DEPLOY-2026-06-18-aquecedor-dedup-envios`
