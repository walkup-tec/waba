# LOG — Push resume agora (disparo Cloud travado de novo)

## Pedido

Disparador Cloud travou de novo. Subir push para Redeploy e **continuar** o lote (não void).

## O que sobe

Marker: `DEPLOY-2026-09-03-200100-cloud-resume-agora`

Inclui:
- resume no boot dos `running`/`queued` com fila
- retries em boot+3s e boot+10s
- watchdog ~20s
- `cloudBroadcastProtect` no `/health`
- fix vídeo header-media v2

## Após Redeploy

```bash
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; h=json.load(sys.stdin); print(h.get("deployMarker")); print(h.get("cloudBroadcastProtect"))'
```

Esperado: marker `…200100-cloud-resume-agora` e a barra do Cloud voltar a subir.

## Palavras-chave

resume agora, travou, jandira, 200100, redeploy
