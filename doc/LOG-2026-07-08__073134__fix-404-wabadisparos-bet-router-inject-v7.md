# LOG — 2026-07-08 07:31 — Fix 404 wabadisparos.com.br + bet.waba.info (router inject v7)

## Contexto
- Pedido: `https://wabadisparos.com.br/` e `https://bet.waba.info/` fora do ar (404 Easypanel).
- Timers `traefik-permanent-*` já instalados no VPS (08/07 ~07:14), mas `run` na instalação não criou router — só patcheava URLs em blocos existentes.
- SSH da máquina local continua sem acesso (`Permission denied`).

## Diagnóstico (08/07 ~07:31)
| URL | HTTP |
|-----|------|
| `wabadisparos.com.br` | **404** |
| `bet.waba.info` | **404** |
| `waba-paginadevendas.achpyp.easypanel.host` | **200** |
| `waba-bets-pv.achpyp.easypanel.host` | **404** |

**Causa raiz:**
1. **wabadisparos:** serviço `waba_paginadevendas` OK; falta router Traefik para domínio custom (nunca existiu em backup → `ensure_waba_public_router` falhava silenciosamente).
2. **bet.waba.info:** serviço `waba_bets_pv` down no Swarm/Easypanel (host interno também 404) — Traefik sozinho não resolve.

## Solução implementada (repo)
1. **`scripts/traefik-permanent-waba-vps.sh` v7** (`waba-traefik-2026-07-08-v7`):
   - `ensure_waba_public_router`: se backup ausente, **injeta** `Host(public)` na regra do host Easypanel OU cria router dedicado clonando o `service`.
   - Landings: detecção porta **80**, probe `wget --spider /` (sem `/health`).
   - `reload_traefik_config` após injeção.
2. **Wrappers paginadevendas/bets_pv v2:** sempre baixam core atualizado; `WABA_PORT=80`; removem `WABA_BACKEND_URL` fixo em `:3000`.
3. **`scripts/fix-wabadisparos-bet-now-vps.sh`:** one-shot — wake Swarm, `traefik-permanent-all`, run paginadevendas + bets_pv.

## Arquivos alterados
- `scripts/traefik-permanent-waba-vps.sh`
- `scripts/traefik-permanent-paginadevendas-vps.sh`
- `scripts/traefik-permanent-bets-pv-vps.sh`
- `scripts/fix-wabadisparos-bet-now-vps.sh` (novo)

## Como aplicar no VPS (root@srv1261237)

Após `git push` no `master` (scripts no GitHub):

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-wabadisparos-bet-now-vps.sh" -o /root/fix-wabadisparos-bet-now-vps.sh
sed -i 's/\r$//' /root/fix-wabadisparos-bet-now-vps.sh
chmod +x /root/fix-wabadisparos-bet-now-vps.sh
/root/fix-wabadisparos-bet-now-vps.sh
```

Se `bets_pv` easypanel continuar 404 → **Easypanel → projeto waba → serviço `bets_pv` → Redeploy**.

## Validação
```bash
curl -sS -o /dev/null -w "wabadisparos:%{http_code}\n" https://wabadisparos.com.br/
curl -sS -o /dev/null -w "bet:%{http_code}\n" https://bet.waba.info/
grep -n "wabadisparos\|bet.waba" /etc/easypanel/traefik/config/main.yaml | head
tail -30 /var/log/fix-wabadisparos-bet-now.log
```

## Palavras-chave
traefik router inject, ensure_waba_public_router v7, wabadisparos 404, bet.waba.info, bets_pv down, fix-wabadisparos-bet-now
