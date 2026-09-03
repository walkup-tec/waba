# LOG — Proteção do Disparo Cloud (anti-interrupt)

## Contexto

Após o lote Jandira 2 (`5552c6f7`) voltar a entregar, o usuário pediu proteger o disparador Cloud para outras atualizações do sistema não pararem o envio.

## Proteção (3 camadas)

1. **Resume no boot** (já em `193200`) — após Redeploy, retoma `running`/`queued` com fila.
2. **Watchdog ~20s** — se o loop morrer sem o processo cair, retoma sozinho.
3. **`/health.cloudBroadcastProtect`** + rule `waba-disparo-cloud-protect.mdc` — `blockRedeploy=true` = não Redeployar `waba_disparador` enquanto houver fila.

FTP / push sem Redeploy Node e outros serviços (landing, heal publish) continuam OK.

## Marker

`DEPLOY-2026-09-03-194500-cloud-broadcast-protect`

## Validar

```bash
npm run test:broadcast-header
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin).get("cloudBroadcastProtect"),indent=2))'
```

## Palavras-chave

cloudBroadcastProtect, blockRedeploy, watchdog, resume, jandira, proteção disparo cloud
