# LOG — 2026-07-09 08:55 — bets_pv porta 3000 (Traefik 502)

## Diagnóstico VPS
- `waba_bets_pv` 1/1 Running, `Endpoint.Ports: null` (sem publish host)
- Container: `node .output/server/index.mjs`, `Exposed: 3000/tcp`
- `ss` dentro do container: `0.0.0.0:3000 LISTEN`
- `wget :80` → Connection refused (esperado)
- Script `traefik-permanent-bets-pv-vps.sh` usava `WABA_PORT=80` (incorreto)

## Correção imediata (VPS)
```bash
docker service update --publish-add published=30211,target=3000,protocol=tcp waba_bets_pv
curl -sS -o /dev/null -w "BETS :30211 → %{http_code}\n" http://127.0.0.1:30211/
/root/restore-landing-routers-vps.sh
curl -sS -o /dev/null -w "bet.waba.info: %{http_code}\n" https://bet.waba.info/
```

## Repo
- `scripts/traefik-permanent-bets-pv-vps.sh` — default `WABA_PORT=3000`

## Erro separado (cadastro)
Log container: `SyntaxError: Expected property name or '}' in JSON` no proxy cadastro WABA — investigar env/body no `betwaba-connect`, não bloqueia GET `/`.

## Palavras-chave
bets_pv 3000, traefik 502, bet.waba.info, publish 30211
