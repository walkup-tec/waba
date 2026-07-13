# Agentes Cursor — Projeto WABA

## Agente Traefik — Incidentes (desconexões)

**Skill:** `.cursor/skills/traefik-incident-specialist/`

**Quando usar:** queda de link/sistema por Traefik (404, 502, HTTPS `000`, entryPoints, ACME, routers), ou evolução de correções definitivas.

```
@traefik-incident-specialist bet.waba.info 404 de novo
```

```
@traefik-incident-specialist login 502 após redeploy — cause Traefik e fixe definitivo
```

### O que este agente faz

1. **Classifica** se a desconexão é Traefik
2. **Consulta** `doc/traefik-causes/REGISTRY.md` + corpus `E:\Waba\traefik-crawler\urls.txt` (`scripts/traefik-kb-search.py`)
3. **Lê** docs oficiais (`doc.traefik.io`) antes de patch
4. **Aplica** correção definitiva (guard/timer/rule)
5. **Registra** causa nova no REGISTRY para não repetir

Rule: `.cursor/rules/traefik-incident-agent.mdc`

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
Guard: `scripts/infra/traefik-entrypoint-guard-vps.sh` — doc `doc/TRAEFIK-ENTRYPOINTS-HTTP-HTTPS.md`

### Outros agentes do projeto

| Skill | Uso |
|-------|-----|
| `traefik-incident-specialist` | Desconexões Traefik + RAG URLs + causas definitivas |
| `backend-saas-api-senior` | APIs, services, multi-tenant |
| `frontend-ux-ui-saas-designer` | UI/UX |
| `integrations-apis-specialist` | APIs externas, webhooks |

Documentação completa: `doc/INFRA-AGENT-WABA.md`
