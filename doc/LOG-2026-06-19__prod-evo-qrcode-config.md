# LOG — Produção QRCode EVO (V02 local OK, prod falha)

**Data:** 2026-06-19

## Sintoma
- V02 local (`localhost:3012`): QRCode OK
- Produção (`waba.draxsistemas.com.br`): «Evolution API indisponível. Verifique EVO_API_URL no servidor.»

## Causa provável
1. **`RUNTIME_MODE=production`** — sem `EVO_TLS_INSECURE=1`, HTTPS Easypanel falha TLS (local dev auto-liga).
2. **`EVO_API_URL` interno** (`http://walkup-evo-walkup-api:8080`) — overlay Swarm/Traefik → 404/502.
3. Deploy antigo sem timeout 45s + retry (commit `7d478ad` ou posterior necessário).

## Correção código (`DEPLOY-2026-06-19-prod-evo-qrcode`)
- TLS auto para `https://*.easypanel.host`
- `/health` expõe `evoApiBase`, `evoTlsInsecure`, `evoHttpTimeoutMs`
- Log startup `[evo] base=...`

## Easypanel — serviço `waba_disparador` (obrigatório)
```
EVO_API_URL=https://walkup-evo-walkup-api.achpyp.easypanel.host
EVO_INSTANCES_URL=https://walkup-evo-walkup-api.achpyp.easypanel.host/instance/fetchInstances
EVO_API_KEY=<mesma do local>
EVO_TLS_INSECURE=1
EVO_HTTP_TIMEOUT_MS=45000
```
Alternativa mesmo VPS (sem TLS):
```
EVO_API_URL=http://172.17.0.1:30181
EVO_INSTANCES_URL=http://172.17.0.1:30181/instance/fetchInstances
```

## Pós-deploy
1. Redeploy Git `master`
2. `GET /version-02/health` ou `/health` → `deployMarker: DEPLOY-2026-06-19-prod-evo-qrcode`
3. Conferir `evoApiBase` aponta URL correta (não `walkup-evo-walkup-api:8080`)
4. Testar wizard QRCode
