# LOG — 100 créditos obotmoney@gmail.com (produção)

**Data:** 2026-07-09  
**Pedido:** Conceder 100 envios de crédito para `obotmoney@gmail.com` em produção.

## Assinante (produção)

| Campo | Valor |
|-------|--------|
| E-mail | `obotmoney@gmail.com` |
| Nome | Teste Landing 03 |
| Segmento | Bets |
| ID | `e9b999c7-d239-4cfa-a36f-4da30b503bb0` |
| Saldo antes | 0 envios contratados |

**Nota:** e-mail correto é `obotmoney@gmail.com` (não `obotmobey@gmail.com`).

## Ações executadas

1. Confirmado assinante em produção via `GET /admin/subscribers` (master walkup).
2. Criado patch `promote-from-v02` **billing-only** (não altera senha do assinante existente).
3. Script `scripts/grant-disparos-credits-production.cjs` (remoto + `--apply-data-dir /app/data`).
4. Workflow GitHub **Grant Disparos Credits (SSH)** — aplica pedido `paid` em `/app/data/waba-billing-orders.json` via `docker exec`.
5. Commits: `61fa30c`, `6cbea8a` em `master`.

## Pendência (crédito ainda não aplicado)

- **2026-07-09 02:08** — Workflow `Grant Disparos Credits (SSH)` disparado (push trigger `2ef9a70`) → **falhou**: secret `VPS_SSH_PRIVATE_KEY` não configurado no GitHub Actions.
- Run: https://github.com/walkup-tec/waba/actions/runs/28989071075
- API remota retorna `Bundle de assinante inválido` até **redeploy** do `waba_disparador` com commit `61fa30c+`.
- SSH local indisponível (`Permission denied`).

## Como concluir (escolha uma)

### Opção A — GitHub Actions (requer secret SSH)

1. GitHub → **Settings → Secrets and variables → Actions** → criar `VPS_SSH_PRIVATE_KEY` (chave privada OpenSSH root@srv1261237).
2. Opcional: `VPS_HOST` = `72.60.51.127`
3. Actions → **Grant Disparos Credits (SSH)** → **Run workflow**:
   - email: `obotmoney@gmail.com`
   - count: `100`
   - api: `oficial`

Ou re-disparar com novo push em `.github/grant-triggers/` (idempotente via `requestId`).

### Opção B — Easypanel shell (`/app`)

```bash
node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 100 --apply-data-dir /app/data
```

### Opção C — Após redeploy Easypanel

```bash
node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 100
```

## Validação

Login como `obotmoney@gmail.com` → Disparos → Créditos: **100 envios API Oficial** disponíveis.

Admin → Assinantes: `contractedShipments: 100`.

## Palavras-chave

`obotmoney`, grant créditos, produção, billing-only promote, grant-disparos-credits-production
