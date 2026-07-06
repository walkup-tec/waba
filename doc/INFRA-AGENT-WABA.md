# Agente de Infraestrutura WABA

Guia para usar o especialista de infra no Cursor e no VPS.

## Problema que motivou (jun/2026)

- CPU ~74% no hPanel com poucos testers
- Hostinger sugeriu `docker system prune` + `restart docker`
- Diagnóstico: **infra saudável** (Traefik 1/1, HTTPS 200, Let's Encrypt OK)
- CPU = **carga real** de vários apps no mesmo VPS (n8n, Sidekiq, Next.js, Traefik, WABA, etc.)

## Agente no Cursor

| Item | Caminho |
|------|---------|
| Skill | `.cursor/skills/waba-infrastructure-specialist/SKILL.md` |
| Regra | `.cursor/rules/waba-infra-agent.mdc` |
| Índice agentes | `AGENTS.md` |

**Invocar:**

```
@waba-infrastructure-specialist [seu pedido]
```

Exemplos:
- `audite produção e diga o que está consumindo CPU`
- `502 no waba após deploy — corrija passo a passo`
- `instale monitor contínuo no VPS`

## Monitor contínuo (VPS)

Scripts em `scripts/infra/`:

| Script | Função |
|--------|--------|
| `vps-health-audit.sh` | Docker, Traefik, WABA, HTTPS, cert |
| `vps-cpu-report.sh` | Top processos + docker stats |
| `install-vps-monitor.sh` | Timer systemd a cada 15 min |

### Instalação (SSH root, uma vez)

Copiar do repo local (se tiver o código no VPS):

```bash
mkdir -p /root/waba-infra
# ou curl do GitHub após push em master
bash /caminho/waba/scripts/infra/install-vps-monitor.sh install
```

Ou via GitHub (após commit/push):

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh" -o /tmp/install-vps-monitor.sh
sed -i 's/\r$//' /tmp/install-vps-monitor.sh
chmod +x /tmp/install-vps-monitor.sh
/tmp/install-vps-monitor.sh install
```

Verificar:

```bash
/tmp/install-vps-monitor.sh status
tail -50 /var/log/waba-infra-audit.log
```

## Otimização CPU — ordem recomendada

1. `bash /root/waba-infra/vps-cpu-report.sh` — identificar container
2. Parar **aquecedor WABA** quando não estiver testando
3. Pausar serviços Easypanel não usados
4. Revisar workflows **n8n** agendados
5. Médio prazo: mover apps secundários para **srv1787149**

## Traefik (já instalado)

`/root/traefik-permanent-all-vps.sh` — ver `doc/FIX-TRAEFIK-DEFINITIVO.md`

Não desinstalar timers/guard — evitam 404/502 pós-deploy.

## Cursor Automation (opcional)

Agendar no Cursor Automations (Agents Window):

- **Trigger:** cron diário ou manual
- **Prompt:** Ler `/var/log/waba-infra-audit.log` (usuário cola últimas linhas) e aplicar skill infra
- **Tools:** terminal quando SSH disponível

## Palavras-chave memória

`infra-agent`, `waba-infrastructure-specialist`, `vps-cpu-report`, `waba-infra-audit`, `Hostinger CPU`, `srv1261237`
