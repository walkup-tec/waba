# LOG — Uptime falso Fetch failed (probe local)

**Data:** 2026-07-13 13:55  
**Sintoma:** Monitor marca landings/WABA fora do ar com `fetch failed`.  
**Realidade:** HTTPS público drax/bet/disparos → **200** (sites no ar).

## Causa
Probe do uptime roda **dentro do container** Swarm e chama a URL pública. Hairpin NAT / TLS de volta ao próprio VPS → `TypeError: fetch failed` (falso negativo).

## Correção
`checkHttpTarget` passa a preferir probe no host gateway:
- bet → `http://172.17.0.1:30211/`
- disparos → `http://172.17.0.1:30210/`
- waba → `http://172.17.0.1:30180/health`
- Se local falhar, tenta URL pública
- `WABA_HOST_GW` / `WABA_UPTIME_DRAX_LOCAL_URL` opcionais

Marker: `DEPLOY-2026-07-13-uptime-local-probe-fix`

## Keywords
`uptime`, `fetch failed`, `hairpin`, `172.17.0.1`, `30210`, `30211`, `30180`
