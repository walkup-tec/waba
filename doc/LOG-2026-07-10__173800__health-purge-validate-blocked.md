# LOG - 2026-07-10 - Validacao /health purge (bloqueada)

## Contexto
Pedido: fetch https://waba.draxsistemas.com.br/health e reportar sizeBytes + updatedAt para campaignIntakes, supportTickets, pushMessages, financeiroSettlements, financeiroSplit, billingOrders, disparosLocal; confirmar purge se alvos ~30-100 bytes e keep ainda grandes.

## Resultado
**Bloqueado:** /health retorna **HTTP 502** (corpo HTML SPA 404 / "Only HTML requests are supported here" com Accept JSON). Catalogo dataPersistence **nao disponivel**.

## Tentativas
- curl.exe / Invoke-RestMethod em waba.draxsistemas.com.br/health → 502
- /version-02/health, /ready, /api/health → 502
- --resolve 72.60.51.127 → 502
- ssh root@72.60.51.127 → Permission denied (sem chave local)
- :30210/health publico → HTML 404 (nao JSON do app Node)

## Referencia SSH (LOG sucesso anterior, nao e /health)
doc/LOG-2026-07-10__173600__purge-admin-menus-sucesso.md: intakes/push/tickets/settlements ~36-40; billingOrders 7780; split-config 1211.

## Pendencia
Restaurar rota Traefik/backend waba_disparador ate /health JSON 200; revalidar catalogo.

## Palavras-chave
health 502, purge validate, dataPersistence catalog, traefik
