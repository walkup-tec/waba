# LOG — Lista desconectado vs QR já conectada (1261)

- **Data:** 2026-07-21 ~20:52
- **Sintoma:** Instância `1261` na lista como desconectado; modal QR diz «já está conectada»
- **Número:** usuário citou `51982001261`; EVO/WhatsApp reporta `555182001261` → display `5182001261`
- **Causa:** EVO `connectionState` = **open** (correto). Lista usava snapshot/cache sem enrich live; refresh em background aplicava payload com `render: false`
- **Fix:**
  1. `buildInstancesSnapshotForAuth` → `enrichInstanceItemsWithLiveConnection` + patch status no cache (sem apagar outras instâncias)
  2. UI: refresh full re-render na aba Instâncias
  3. UI: HTTP 409 «já conectada» tratado como sucesso + `fullRefresh`
- **Validação:** `connectionState/1261` = open; probe `trulyOpen: true`

## Palavras-chave

1261, já está conectada, snapshot cache stale, enrichInstanceItemsWithLiveConnection, 5182001261
