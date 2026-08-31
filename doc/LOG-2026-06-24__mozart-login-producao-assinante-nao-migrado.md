# LOG — Login Mozart produção (assinante não migrado)

## Sintoma

`mozart.pmo@gmail.com` → **E-mail ou senha inválidos** em `https://waba.draxsistemas.com.br`.

## Causa raiz

1. Conta existe só em **`data/v02/waba-subscribers.json`** (V02), **não** em `/app/data` de produção.
2. Script de promoção **nunca foi executado** no servidor (tentativa remota falhou: endpoint `404` — produção ainda em deploy `DEPLOY-2026-06-22-*`).
3. Senha de produção ≠ V02 até rodar promote (copia o **mesmo hash** do V02).

## Solução (ordem)

### 1) Redeploy produção (Easypanel `waba_disparador`, branch `master`)

Validar: `GET /health` → `deployMarker` ≥ `DEPLOY-2026-06-24-mozart-promote-bundle-scripts`

### 2) Promover Mozart no shell do container

```bash
cd /app
node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --apply-data-dir /app/data
```

(Reiniciar container se necessário.)

**Alternativa remota** (após redeploy, com `.env` master):

```bash
node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --remote https://waba.draxsistemas.com.br
```

### 3) Login

- E-mail: `mozart.pmo@gmail.com`
- Senha: **a mesma do V02** (localhost:3012)

## Ajuste deploy

- `Dockerfile` + `prepare-ftp-bundle.mjs` passam a incluir `scripts/` e `data/v02/` para o promote no servidor.

## Palavras-chave

mozart login produção, promote-from-v02, assinante não encontrado
