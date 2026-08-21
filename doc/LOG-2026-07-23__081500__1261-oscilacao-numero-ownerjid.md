# LOG — 1261: oscilação status + número "—"

## Diagnóstico EVO (2026-07-23)

Instância **1261** (`ownerJid` `555182001261@s.whatsapp.net`):

| Fonte | Valor |
|-------|--------|
| `GET /instance/connectionState/1261` | **`close`** |
| `fetchInstances` item | **`connecting`**, `number: null`, ownerJid preenchido |
| Última queda | `401` / `device_removed` / Stream Errored (conflict) ~10:21 UTC |

### Oscilação conectado ↔ desconectado

1. Cache WABA às vezes ainda tinha `open` antigo.
2. Enrich só atualizava status se `connectionState` respondesse; se falhasse, mantinha **open fantasma**.
3. `fetchInstances` e `connectionState` **divergem** (connecting vs close) — típico de loop pós-`device_removed`.
4. UI usava `includes("open")` e `connectionStatus` do cache sem preferir `liveConnectionStatus`.

### Número "—"

1. EVO: campo `number` = `null`; telefone só em `ownerJid`.
2. UI lia só `number|phone|owner|ownerNumber` — **não** `ownerJid`.
3. Cache podia persistir `number` vazio sem backfill.

## Correção

- UI: `ownerJid` + status strict `=== "open"` + prefer `liveConnectionStatus`.
- Backend enrich: backfill número; se live falhar, não manter open stale; gravar number no cache.
- Marker: `DEPLOY-2026-07-23-1261-numero-status-estavel`

## Operação (usuário)

1261 **precisa reconectar via QR** (sessão derrubada por conflict/device_removed). Código estabiliza a UI; não restaura o vínculo WhatsApp sozinho.

## Validar

1. Redeploy Node + FTP.
2. Lista: 1261 mostra número `5182001261` (ou formatado) mesmo desconectado.
3. Status não “pisca” conectado sem `connectionState=open`.
4. QR → open estável.

## Palavras-chave

1261, device_removed, ownerJid, number null, oscilação, ghost open, connecting vs close
