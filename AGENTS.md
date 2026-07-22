# Agentes Cursor — Projeto WABA

## Agente Traefik — `traefik-agent` (global)

**Skill canônica (qualquer projeto Cursor):** `~/.cursor/skills/traefik-agent/`
**Rule user:** `~/.cursor/rules/traefik-agent.mdc` (`alwaysApply`)

**Quando usar:** queda de link/sistema por Traefik (404, 502, HTTPS `000`, entryPoints, ACME, routers), ou evolução de correções definitivas — em **WABA ou qualquer outro projeto**.

```
@traefik-agent bet.waba.info 404 de novo
```

```
@traefik-agent login 502 após redeploy — cause Traefik e fixe definitivo
```

### O que este agente faz

1. **Classifica** se a desconexão é Traefik
2. **Consulta** `doc/traefik-causes/REGISTRY.md` + corpus `traefik-crawler/urls.txt` (path oficial `E:\01A-Drax-Servidor\Waba`) via `scripts/traefik-kb-search.py`
3. **Lê** docs oficiais (`doc.traefik.io`) antes de patch
4. **Aplica** correção definitiva (guard/timer/rule)
5. **Registra** causa nova no REGISTRY para não repetir

Skill legada do repo (mesmo tema): `.cursor/skills/traefik-incident-specialist/` — preferir `@traefik-agent`.
Rule projeto: `.cursor/rules/traefik-incident-agent.mdc`

### Guardião de Sistemas

- Rule: `.cursor/rules/guardiao-sistemas-traefik.mdc` + Rule global homônima.
- Serviço: `guardiao-sistemas-traefik.service` — único writer automático do `main.yaml`.
- Registry: `scripts/guardiao-sistemas-traefik-registry.json`.
- Instalação segura: `scripts/guardiao-sistemas-traefik-vps.sh install-audit`; ativar `repair` só após revisar auditoria.
- Sem HUP/force: File provider faz hot-reload; regressão em probe provoca rollback.

---

## Agente de Infraestrutura (principal para VPS)

**Skill:** `.cursor/skills/waba-infrastructure-specialist/`

**Como usar:**

```
@waba-infrastructure-specialist audite o VPS srv1261237
```

```
@waba-infrastructure-specialist CPU alta — otimize a infra
```

```
@waba-infrastructure-specialist HTTPS 502 após redeploy Easypanel
```

### O que este agente faz

1. **Resolve** — Traefik, SSL/acme, 404/502/443, docker-proxy zumbi, restart Docker seguro
2. **Monitora** — scripts em `scripts/infra/` + timer no VPS (`install-vps-monitor.sh`)
3. **Otimiza** — CPU Hostinger, separação de serviços, playbook WABA (aquecedor, apps ociosos)

### Instalar monitor no VPS (uma vez)

```bash
# No SSH root@srv1261237
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh" -o /tmp/install-vps-monitor.sh
sed -i 's/\r$//' /tmp/install-vps-monitor.sh
chmod +x /tmp/install-vps-monitor.sh
/tmp/install-vps-monitor.sh install
/tmp/install-vps-monitor.sh status
```

Logs: `/var/log/waba-infra-audit.log`, `/var/log/waba-infra-cpu.log`, `/var/log/waba-traefik-entrypoint-guard.log`

### Entrypoints Traefik (crítico)

Neste VPS: só **`http`** / **`https`** — nunca `web` / `websecure`.  
Normalização: Guardião de Sistemas (o entrypoint-guard legado não deve operar como writer concorrente).

### Outros agentes do projeto

| Skill | Uso |
|-------|-----|
| `traefik-agent` (global `~/.cursor/skills`) | Desconexões Traefik — preferir este |
| `traefik-incident-specialist` | Legado WABA (mesmo tema) |
| `backend-saas-api-senior` | APIs, services, multi-tenant |
| `frontend-ux-ui-saas-designer` | UI/UX |
| `integrations-apis-specialist` | APIs externas, webhooks |

Documentação completa: `doc/INFRA-AGENT-WABA.md`
