# LOG — 2026-07-10 — Landings/Traefik fora (:443 000)

## Sintoma

- `traefik-sync-landings-dynamic-vps.sh` → HUP + landings 404
- Log: `ERRO: Traefik down`, depois 404
- `curl https://wabadisparos.com.br/` → `(7) Failed to connect ... port 443` → **000**

## Diagnóstico

Classe: **nada escutando em :443** (Traefik down / docker-proxy). Sync de landings sozinho **não** resolve — precisa bootstrap Traefik primeiro.

## Recuperação (ordem)

```bash
# 1) Diagnóstico
docker service ls | grep -E 'traefik|paginadevendas|bets_pv|waba_disparador'
ss -tlnp | grep -E ':80|:443|:30180|:30210' || netstat -tlnp | grep -E ':80|:443|:30180|:30210'
curl -sS --max-time 5 http://127.0.0.1:30180/health | head -c 200; echo
curl -sS -o /dev/null -w "30210:%{http_code}\n" --max-time 5 http://127.0.0.1:30210/ || true

# 2) Traefik down → bootstrap (só se :443 down / Traefik 0/1)
bash /root/traefik-easypanel-bootstrap-vps.sh run
# ou:
# bash /root/traefik-permanent-all-vps.sh run

# 3) Confirmar :443
ss -tlnp | grep ':443'
curl -sS -o /dev/null -w "443-local:%{http_code}\n" --max-time 10 \
  --resolve waba.draxsistemas.com.br:443:127.0.0.1 \
  https://waba.draxsistemas.com.br/health

# 4) Landings (depois que Traefik está up)
bash /root/traefik-sync-landings-dynamic-vps.sh
curl -sS -o /dev/null -w "disparos:%{http_code} bet:%{http_code}\n" --max-time 15 \
  https://wabadisparos.com.br/ https://bet.waba.info/
```

Se landings ainda 404 com Traefik up: backends devem ser `172.17.0.1:30210` (paginadevendas) — ver `restore-landing-routers-vps.sh`.

## Palavras-chave

`Traefik down`, `443 000`, `bootstrap`, `landings 404`
