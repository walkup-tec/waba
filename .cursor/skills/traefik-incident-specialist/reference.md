# Referência — Agente Traefik Incidentes

## Corpus RAG

| Path | Conteúdo |
|------|----------|
| `E:\Waba\traefik-crawler\urls.txt` | ~50k URLs Traefik (canônico) |
| `E:\Waba\traefik-crawler\output\stats.json` | Contagem por domínio |
| `scripts/traefik-kb-search.py` | Busca por palavras-chave no corpus |
| `doc/traefik-causes/REGISTRY.md` | Causas → fixes definitivos WABA |

Preferir fontes trust:

1. `doc.traefik.io`
2. `community.traefik.io`
3. `github.com/traefik/*`
4. `blog.traefik.io` / `plugins.traefik.io`
5. Integrações: Authelia, Authentik, CrowdSec, Docker, K8s (só se o incidente for disso)

## Modelo Traefik neste VPS (Easypanel)

| Camada | Onde | Ação |
|--------|------|------|
| Static / install | env entryPoints, providers | raro; restart só se `0/1` |
| Dynamic / routing | `main.yaml` routers/services/TLS | patch + file watch / HUP leve; **não** force |

EntryPoints reais:

- `TRAEFIK_ENTRYPOINTS_HTTP` → nome **`http`**
- `TRAEFIK_ENTRYPOINTS_HTTPS` → nome **`https`**

## Scripts canônicos (VPS)

| Script | Função |
|--------|--------|
| `scripts/infra/traefik-entrypoint-guard-vps.sh` | Corrige `web`→`http`, `websecure`→`https`; bet 502→`172.17.0.1:30211` |
| `scripts/infra/traefik-443-watchdog-vps.sh` | Recupera Traefik/:443 |
| `scripts/infra/heal-waba-login-vps.sh` | Republish `:30180` + backends pós-redeploy |
| `scripts/restore-landing-routers-vps.sh` | Landings (paginadevendas / bets) |
| `/root/traefik-easypanel-bootstrap-vps.sh` | Bootstrap se Traefik down |
| `/root/traefik-permanent-all-vps.sh` | Suite permanente (cuidado com thrash) |

## Incidente histórico (aprendizado)

**2026-07-10 — `bet.waba.info` 404 SPA**

- Causa: routers com `entryPoints: ["websecure"]` enquanto o Traefik só tem `https`
- Fix: entrypoint-guard + Rule `traefik-entrypoints-http-https.mdc`
- Doc: `doc/TRAEFIK-ENTRYPOINTS-HTTP-HTTPS.md`

**Thrash Traefik `0/1`**

- Causa: vários timers `permanent-*-fix` + HUP/force simultâneos
- Fix: só bootstrap + 443-watchdog + entrypoint-guard

## Mapeamento sintoma → query kb

| Sintoma | Queries sugeridas no kb_search |
|---------|--------------------------------|
| 404 host | `entryPoints router Host rule` |
| 502 | `bad gateway service loadbalancer servers` |
| TLS / ACME | `acme letsencrypt certificate resolver` |
| Docker Swarm | `docker swarm provider labels` |
| Middleware auth | `forwardAuth middleware` |
| Redeploy | `hot reload dynamic configuration file provider` |

## URLs oficiais prioritárias

- https://doc.traefik.io/traefik/getting-started/configuration-overview/
- https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
- https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
- https://easypanel.io/docs/guides/custom-traefik-config
