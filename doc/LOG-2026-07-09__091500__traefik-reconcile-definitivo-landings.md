# LOG — 2026-07-09 09:15 — Solução definitiva Traefik landings (reconcile v1)

## Problema
Landings `wabadisparos.com.br` e `bet.waba.info` fora (404/502/000). Backends locais OK (`30210`, `30211` → 200) mas HTTPS falhava.

## Causa raiz (doc Traefik + inspeção VPS)

| Fator | Efeito |
|-------|--------|
| **File provider** (`main.yaml`) hot-reload via HUP | Routers/services corretos até Easypanel regenerar |
| Easypanel reescreve `main.yaml` | Host custom some ou backend vira `tasks.*` |
| `fix_host_windows` em `traefik-permanent-waba-vps.sh` | **Cross-contamination**: needle `wabadisparos`/`bet.waba` alterava URL de **outros** routers → `waba_disparador` apontou para `30210` |
| 5 timers (20s) + bootstrap (2min) + guard | Force updates em loop → Traefik **OOM exit 137** → `:443` down |
| `export WABA_HOST_PUBLISHED_PORT=30210` na sessão SSH | `traefik-permanent-all` publicou porta errada no disparador |

## Solução definitiva (repo)

1. **`scripts/traefik-reconcile-vps.sh`** (v1) — patch **atômico**:
   - `waba_waba_disparador*` → `172.17.0.1:30180`
   - `waba_paginadevendas*` → `172.17.0.1:30210`
   - `waba_bets_pv*` → `172.17.0.1:30211`
   - Router `Host()` → `service` correto por host
   - HUP (sem `docker restart` Traefik)

2. **`traefik-permanent-waba-vps.sh`** — removido `fix_host_windows`

3. **`traefik-permanent-all-vps.sh`** v5 — `run` chama só reconcile; `unset` env contaminada

4. **`fix-wabadisparos-bet-now-vps.sh`** v3 — bootstrap + reconcile

5. Portas apps: PV e Bets escutam **3000** (Nitro SSR), não 80

## Recuperação imediata no VPS

```bash
# 1) Parar timers que brigam (manter bootstrap + guard)
systemctl disable --now traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-waba-fix.timer 2>/dev/null || true

# 2) Copiar script do repo (ou curl após push master)
# scp scripts/traefik-reconcile-vps.sh root@srv1261237:/root/
chmod +x /root/traefik-reconcile-vps.sh
/root/traefik-reconcile-vps.sh

# 3) Validar
curl -sS -o /dev/null -w "waba:%{http_code} waba:%{http_code}\n" \
  --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
curl -sS -o /dev/null -w "disparos:%{http_code} bet:%{http_code}\n" \
  https://wabadisparos.com.br/ https://bet.waba.info/
```

## Referências Traefik
- https://doc.traefik.io/traefik/getting-started/configuration-overview/ (static vs dynamic)
- https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/ (File provider + watch)
- https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/ (rule + service)

## Palavras-chave
traefik-reconcile, fix_host_windows, cross-contamination, OOM 137, 172.17.0.1, main.yaml easypanel
