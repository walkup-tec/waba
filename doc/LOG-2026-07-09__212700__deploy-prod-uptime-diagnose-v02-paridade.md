# LOG — 2026-07-09 — Deploy produção uptime diagnose + V02 paridade

## Pedido

Commit + deploy produção; V02 igual à produção (atualizado).

## Produção (master)

| Item | Valor |
|------|-------|
| Commit | `0638e8d` |
| Assunto | `[9ca006a] feat: uptime diagnose playbooks + setup build Google Drive H` |
| Marker | `DEPLOY-2026-07-09-uptime-diagnose-playbooks` |
| Push | `origin/master` OK |

### Entregas

- Diagnóstico uptime (playbooks + UI luzes vermelhas + `POST /admin/infra/uptime-monitor/diagnose`)
- Fix Asaas diagnóstico sem alertas WhatsApp
- `npm run build:h`, `verify:uptime-diagnose`, setup Google Drive H:
- Fix `copy-index-html.mjs` (sem `rm` recursivo — EPERM no Drive)

## V02 (branch v02)

| Item | Valor |
|------|-------|
| Branch | `v02` criada/atualizada a partir de `master` (`0638e8d`) |
| Commit marker | `3765e61` |
| Marker V02 | `DEPLOY-2026-07-09-v02-paridade-prod-uptime-diagnose` |
| Push | `origin/v02` (nova branch remota) |

Código funcional **idêntico** ao master; apenas marker de health difere no branch `v02`.

## Ações pendentes (usuário / VPS)

### 1. Easypanel — produção

Redeploy **`waba_disparador`** (branch `master`) se não auto-deploy.

Validar:

```bash
curl -sS https://waba.draxsistemas.com.br/health | jq .deployMarker
# DEPLOY-2026-07-09-uptime-diagnose-playbooks
```

### 2. Easypanel — V02

Redeploy **`waba_disparador_v02`** (branch **`v02`**).

### 3. VPS — sync dados prod → V02

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/v02/scripts/sync-v02-paridade-producao-vps.sh" -o /tmp/sync-v02.sh
sed -i 's/\r$//' /tmp/sync-v02.sh && chmod +x /tmp/sync-v02.sh
/tmp/sync-v02.sh run
```

Validar:

```bash
curl -sS https://waba.draxsistemas.com.br/version-02/health | jq .deployMarker,.wabaEnv,.basePath
```

### 4. Local V02 (H:)

Se usar `npm run dev:v02` no workspace H::

```powershell
cd "H:\Meu Drive\Drive Profissional\Waba"
Copy-Item .env.v02.example .env.v02   # se ainda não existir — preencher segredos
npm run build:h
npm run dev:v02
```

URL: http://localhost:3012/version-02/

## SSH

Tentativa automática ao VPS falhou (`Permission denied`) — sync dados requer SSH manual pelo usuário.

## Palavras-chave

`deploy produção`, `v02 paridade`, `uptime diagnose`, `0638e8d`, `3765e61`, `sync-v02-paridade-producao-vps.sh`
