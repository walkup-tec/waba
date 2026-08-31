# QRCode reconexão 5181082477 — ghost open bloqueava QR

## Contexto

Usuário tentou reconectar **5181082477**, renomeou exibição para **Final--2477**, mas ao «Atualizar QR» recebia:
*"Já existe uma instância ativa/conectada com este nome. Use outro nome para registrar."*

## Diagnóstico

| Item | Valor |
|------|--------|
| Nome técnico Evolution | `digital-corban-2477` (inalterado) |
| Alias WABA (UI) | `Final--2477` — só rótulo (`/alias`), não renomeia na EVO |
| `fetchInstances` | `connectionStatus: open` |
| `connectionState` live | `connecting` (ghost open) |
| UI | **desconectado** (usa live quando `refresh=1`) |

O endpoint `POST /instancias/registrar-qrcode` bloqueava se `fetchInstances` dizia `open`, mesmo com sessão **não** live-open — impedindo reconexão por QR.

## Solução

- Bloquear QR só se `connectionState` **live** = `open`.
- Ghost open (`fetch=open`, live=`connecting`/`close`) → permite gerar QR.
- Frontend: checagem duplicada usa `liveConnectionStatus` quando disponível.

Marker: `DEPLOY-2026-07-01-qrcode-reconnect-live-open-guard`

## Uso correto

- **Nome no modal QR** = nome técnico (`digital-corban-2477`), não o alias `Final--2477`.
- Para renomear na Evolution: fluxo de renomear instância (não só alias).

## Palavras-chave

`5181082477`, `digital-corban-2477`, `Final--2477`, `ghost-open`, `registrar-qrcode`, `fetchInstances`
