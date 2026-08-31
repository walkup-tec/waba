# LOG — yaml idêntico host/container; bets ainda 404

## Confirmado
- Mount `/etc/easypanel/traefik` → `/data`; arquivo `/data/config/main.yaml`
- bets → `waba_bets_landing_fix` → `172.17.0.1:30211/`
- paginadevendas → só wabadisparos → `30210`
- `:30211` + X-Forwarded → 200 Bets (`class=dark`)
- Cmd Traefik: `["traefik"]` + docker.sock (providers via env)

## Conclusão parcial
Disco/container OK. Falha é runtime: router bets disabled/não match, ou Docker provider sobrescreve. Testar HTTP:80 + API/env + emergency 30180/bets.
