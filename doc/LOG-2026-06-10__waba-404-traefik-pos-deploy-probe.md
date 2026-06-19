# LOG — WABA 404 após deploy probe (10/06)

**Sintoma:** `https://waba.draxsistemas.com.br/` e `/health` → **404 page not found** (text/plain).

**Diagnóstico remoto:** mesmo padrão de 08/06 — Traefik sem router `Host(waba.draxsistemas.com.br)` após redeploy Easypanel; app Node provavelmente OK em `127.0.0.1:30180`.

**Correção:** `scripts/restore-waba-traefik-router-vps.sh` no VPS + `traefik-permanent-waba-vps.sh run`.

**Validar:** `curl -sS -o /dev/null -w "%{http_code}" https://waba.draxsistemas.com.br/health` → 200 + `deployMarker`.

## Resolução (10/06)

- VPS: `curl` script `restore-waba-traefik-router-vps.sh` do GitHub + execução
- Usuário confirmou: **200** — site voltou
