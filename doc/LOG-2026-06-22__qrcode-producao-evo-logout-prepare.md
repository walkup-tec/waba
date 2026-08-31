# LOG — QRCode produção: logout/restart EVO antes do connect

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-qrcode-evo-logout-prepare`

## Sintoma (produção)

Modal «Conectar instância» → **Erro ao atualizar QRCode da instância.** (mensagem genérica do `catch` no frontend = fetch interrompido ou rede).

Health produção: `evoApiBase=http://172.17.0.1:30181` (Evolution interna Docker).

## Causa provável

1. Instância **já existe** na EVO (desconectada) — `connect` sem **logout/restart** não devolve QR.
2. Backend tentava **várias URLs × 3 retries × 45s** → request longo; proxy/browser corta → erro genérico no UI.
3. Mensagem do `catch` não distinguia timeout/rede da falha EVO.

## Correção

### Backend (`src/index.ts`)

- `prepareEvoInstanceForQrConnect`: `DELETE logout` + `POST restart` antes do connect.
- `fetchInstanceQrCodeFromEvo(options)`: menos rotas, timeout 30s / 2 retries no `registrar-qrcode`.
- Create EVO: timeout 25s / 2 retries (409 continua OK).
- `ensureAquecedorInstanceRegistered` com try/catch (não derruba QR).

### Frontend (`index.html`)

- Timeout `registrar-qrcode`: **120s**.
- Mensagens claras para timeout e «Failed to fetch».

## Validar produção

1. Deploy → `/health` marker `DEPLOY-2026-06-22-qrcode-evo-logout-prepare`.
2. Instância desconectada → Atualizar QR → QR em até ~60s ou mensagem EVO explícita (502).
3. Se persistir: conferir Evolution em `172.17.0.1:30181` no host (Easypanel).

## Palavras-chave

qrcode, registrar-qrcode, evolution logout, prepareSession, produção, 172.17.0.1:30181
