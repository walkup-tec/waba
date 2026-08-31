# LOG — guard v2 auto-fix backend 30211

## Pedido
Fechar gap: bet=502 com :30211 OK → auto forçar URL `172.17.0.1:30211/`.

## Implementado
`scripts/infra/traefik-entrypoint-guard-vps.sh` **v2**:
- `fix-backend` / heal em `run`
- Se probe 502/503/504 + local :30211 200 → patch services bets + entryPoints routers + sleep watch
- Se :30211 down → log redeploy Easypanel

## Validar no VPS após push
```bash
curl -fsSL ".../traefik-entrypoint-guard-vps.sh" -o /tmp/ep-guard.sh
sed -i 's/\r$//' /tmp/ep-guard.sh && bash /tmp/ep-guard.sh install
bash /root/waba-infra/traefik-entrypoint-guard-vps.sh status
```
