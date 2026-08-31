# Referência — Infraestrutura WABA

## VPS

| Host | Uso | Notas |
|------|-----|-------|
| `srv1261237` | Produção atual | Easypanel, WABA, Evolution, n8n, outros |
| `srv1787149` | Novo pós-upgrade Hostinger | Migração planejada — não apagar 1261237 antes de validar |

SSH: `ssh root@72.60.51.127` (ou hostname Hostinger)

## Serviços Swarm (críticos)

| Serviço | Função |
|---------|--------|
| `easypanel-traefik` | HTTPS :443, routers |
| `waba_waba_disparador` | App WABA `:30180` |
| `walkup_evo-walkup-api` (nome pode variar) | Evolution `:30181` |

## Scripts em `/root/` (VPS)

| Script | Função |
|--------|--------|
| `traefik-permanent-all-vps.sh` | Orquestrador — `install` / `run` / `status` |
| `traefik-easypanel-bootstrap-vps.sh` | Porta 80 zumbi + force Traefik |
| `traefik-permanent-waba-vps.sh` | Fix router/backend WABA |
| `traefik-permanent-walkup-evo-vps.sh` | Fix Evolution |
| `traefik-easypanel-config-guard.sh` | inotify em `main.yaml` |
| `waba-infra/vps-health-audit.sh` | Auditoria (após `install-vps-monitor`) |
| `waba-infra/vps-cpu-report.sh` | Relatório CPU |
| `waba-infra/traefik-config-audit.sh` | Audit ACCESSLOG/API Traefik |

## Logs VPS

| Arquivo | Conteúdo |
|---------|----------|
| `/var/log/traefik-permanent-all.log` | Fixes Traefik |
| `/var/log/traefik-easypanel-bootstrap.log` | Bootstrap proxy |
| `/var/log/traefik-permanent-waba-fix.log` | WABA router |
| `/var/log/waba-infra-audit.log` | Monitor WABA infra |
| `/var/log/waba-infra-cpu.log` | Monitor CPU |

## Traefik / ACME

- Config: `/etc/easypanel/traefik/config/main.yaml`
- ACME: `/etc/easypanel/traefik/acme.json` (600, root)
- JSON inválido → `unexpected end of JSON input` nos logs Traefik
- Cert válido: issuer Let's Encrypt, CN = domínio

## Hostinger — limites CPU

- Alerta visual ~74% ≠ throttling imediato
- Throttling: uso muito alto (**~100–110%+**) por **>3 horas** → CPU limitada temporariamente
- Mitigação: reduzir containers ociosos ou upgrade/separar VPS

## Deploy WABA

| Canal | O que atualiza |
|-------|----------------|
| Easypanel Git | Container `waba_disparador` (imagem) |
| GitHub Actions FTP | Arquivos estáticos/bundle — **não** substitui `/app/data` |

Marker deploy: `GET /health` → `deployMarker`, `serverBootId`

## Docs repo

- `doc/FIX-TRAEFIK-DEFINITIVO.md`
- `doc/FIX-TRAEFIK-WABA.md`
- `doc/FIX-TRAEFIK-WALKUP-EVO.md`
- `doc/deploy-preservacao-dados-producao.md`
- `doc/INFRA-AGENT-WABA.md`

## Processos típicos no `ps` (normais)

- `traefik`, `dockerd`, `containerd`
- `next-server`, `sidekiq`, `puma` — apps Easypanel
- `n8n`, `node dist/server.js` — automação / Node apps

Não confundir com docker-proxy zumbi: zumbi = porta presa **sem** serviço Traefik 1/1.
