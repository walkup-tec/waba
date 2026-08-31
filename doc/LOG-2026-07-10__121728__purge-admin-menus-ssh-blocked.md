# LOG — Purge Admin menus (produção) bloqueado por SSH

**Data:** 2026-07-10 12:17:28
**Contexto:** Executar `scripts/purge-admin-menus-production.cjs` em produção (`/app/data` no container `waba_disparador`, VPS srv1261237).

## Comandos executados

1. Shell OK: `Write-Output "shell-ok"`
2. Paths: `E:\Waba` = **ausente** (unidade E: não montada); `H:\...\Waba` OK; script em H: OK
3. Copiado script H: → `D:\Waba\scripts\purge-admin-menus-production.cjs` (D: é espelho local, não E:)
4. SSH:
   - `ssh -o BatchMode=yes -o ConnectTimeout=10 root@srv1261237.hstgr.cloud "echo ok"` → **Permission denied (publickey,password)**
   - `ssh ... root@72.60.51.127 "echo ok"` → **Permission denied (publickey,password)**
5. `C:\Users\Usuario\.ssh` contém só `known_hosts` — **sem chave privada**
6. Chave de produção vive no GitHub Actions secret `VPS_SSH_PRIVATE_KEY` (workflows grant-credits / vps-infra-heal)
7. Dry-run local `data/v02` (H:): tudo 0
8. Dry-run local `D:\Waba\data\v02` (NÃO produção): intakes 9, settlements 4, tickets 11, push 0, menu-seen -1, disparos-local 1; dirs campaign-intakes 9, support-tickets 5
9. Health público: `/live` timeout ou 404 landing; `/health` 404 landing (Traefik → landing, não app)
10. `gh` não autenticado — não dá para listar secrets / disparar Actions daqui

## Apply produção

**NÃO executado** — sem SSH.

## Comandos exatos para o usuário (com chave)

No VPS (após `ssh -i ~/.ssh/waba_vps root@72.60.51.127`):

```
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1)
echo "Container: $CONTAINER"
# scp do PC: scp -i ~/.ssh/waba_vps scripts/purge-admin-menus-production.cjs root@72.60.51.127:/tmp/
docker cp /tmp/purge-admin-menus-production.cjs "$CONTAINER":/tmp/purge-admin-menus-production.cjs
docker exec "$CONTAINER" node /tmp/purge-admin-menus-production.cjs --data-dir /app/data
docker exec "$CONTAINER" node /tmp/purge-admin-menus-production.cjs --data-dir /app/data --apply --with-supabase
docker exec "$CONTAINER" wget -qO- http://127.0.0.1:30210/live
```

**NUNCA apagar:** `waba-financeiro-split-config.json`, `waba-billing-orders.json`.

## Alternativa sem chave local

- Instalar chave privada em `~\.ssh` e repetir SSH, **ou**
- Workflow Actions one-shot com secret `VPS_SSH_PRIVATE_KEY`

## Validação

- Apply: **bloqueado**
- Dry-run produção: **não obtido**
- Dry-run D:\Waba\data\v02: counts acima (local only; **não** apply)

## Segurança

- Sem exposição de segredos
- Não rodou `--apply` em nenhum data-dir

## Keywords

`purge-admin-menus`, `waba_disparador`, `/app/data`, `VPS_SSH_PRIVATE_KEY`, `srv1261237`, `split-config`, `billing-orders`
