# LOG — Script Traefik permanente Evolution (walkup)

**Data:** 2026-06-08  
**Contexto:** Evolution API retornando 404 via Traefik após redeploy Easypanel; mesma causa do Typebot/WABA.

## Solicitação
Aplicar solução Traefik do projeto Typebot para estabilizar conexão Evolution (`walkup_evo-walkup-api`).

## Análise
- Typebot: `scripts/traefik-permanent-vps.sh` — patch `main.yaml` → `172.17.0.1:PORTA`, watcher + cron.
- WABA: `scripts/traefik-permanent-waba-vps.sh` — só `waba_waba_disparador` (30180).
- Evolution **não** estava coberta.

## Arquivos criados
- `scripts/traefik-permanent-walkup-evo-vps.sh`
- `scripts/diagnose-walkup-evo-502-vps.sh`
- `doc/FIX-TRAEFIK-WALKUP-EVO.md`

## Parâmetros Evolution
| Item | Valor |
|------|-------|
| Swarm | `walkup_evo-walkup-api` |
| Rede | `easypanel-walkup` |
| Host público | `walkup-evo-walkup-api.achpyp.easypanel.host` |
| Porta app | 8080 |
| Porta host | 30181 |

## Pendência
Instalar no VPS: `/root/traefik-permanent-walkup-evo-vps.sh install`
