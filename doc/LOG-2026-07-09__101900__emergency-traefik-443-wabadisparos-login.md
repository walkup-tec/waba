# LOG — Emergência Traefik :443 down + wabadisparos login

**Data:** 2026-07-09  
**Contexto:** Usuário no VPS (`root@srv1261237`) reporta `curl (7)` em `https://wabadisparos.com.br/` — porta 443 sem listener (Traefik down). Quando voltava, landing mostrava tela "Acesso WABA" (backend `172.17.0.1:30180` no service `waba_paginadevendas-*`).

## Causa

1. **Traefik 0/1** — OOM/exit 137 ou docker-proxy zumbi; `:443` não escuta.
2. **Backend errado** — `main.yaml` com `waba_paginadevendas-0/-1` → `http://172.17.0.1:30180/` (disparador/login).
3. **Recontaminação** — timers `traefik-permanent-*` e `traefik-easypanel-config-guard`.

## Ação

- Script autocontido: `scripts/emergency-wabadisparos-vps.sh`
- Corrige `fix-wabadisparos-login-vps.sh` (bug Python removido).

## Comandos no VPS

```bash
# Opção A — scp do PC (se SSH ok):
# scp E:\Waba\scripts\emergency-wabadisparos-vps.sh root@72.60.51.127:/root/
bash /root/emergency-wabadisparos-vps.sh
```

## Validação

```bash
ss -tlnp | grep ':443'
curl -sS --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ | head -c 300
# Não deve conter "Acesso WABA"
grep -A6 '"waba_paginadevendas-0"' /etc/easypanel/traefik/config/main.yaml | grep url
# Deve ser http://waba_paginadevendas:3000/
```

## Não fazer

- Rodar `traefik-reconcile-vps.sh` antigo ou `traefik-permanent-*` com `WABA_HOST_PUBLISHED_PORT=30210/30180`
- `docker service update --force easypanel-traefik` quando já estiver 1/1 + :443 up (só quando down)

## Palavras-chave

`emergency-wabadisparos`, `curl 7`, `443 down`, `Acesso WABA`, `30180`, `paginadevendas:3000`
