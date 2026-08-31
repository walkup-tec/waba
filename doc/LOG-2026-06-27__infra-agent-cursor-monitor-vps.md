# LOG — Agente Infra Cursor + monitor VPS

## Pedido

Usuário pediu agente de infraestrutura no Cursor para:
1. Resolver problema de CPU/Traefik
2. Monitorar infra constantemente
3. Otimizar continuamente

Contexto: manutenção Hostinger (`docker system prune` + `restart docker`) em srv1261237 — infra OK (HTTPS 200, Let's Encrypt); CPU ~74% = multi-app real.

## Solução implementada

### Cursor Agent

| Artefato | Caminho |
|----------|---------|
| Skill principal | `.cursor/skills/waba-infrastructure-specialist/SKILL.md` |
| Referência VPS | `.cursor/skills/waba-infrastructure-specialist/reference.md` |
| Exemplos | `.cursor/skills/waba-infrastructure-specialist/examples.md` |
| Regra Cursor | `.cursor/rules/waba-infra-agent.mdc` |
| Índice | `AGENTS.md` |
| Doc usuário | `doc/INFRA-AGENT-WABA.md` |

Invocação: `@waba-infrastructure-specialist [pedido]`

### Scripts VPS (`scripts/infra/`)

- `vps-health-audit.sh` — Docker, Swarm, Traefik, WABA, HTTPS, cert
- `vps-cpu-report.sh` — ps top + docker stats + alerta load
- `install-vps-monitor.sh` — systemd timer 15 min → `/var/log/waba-infra-*.log`

## Próximo passo no VPS (usuário)

```bash
# Copiar scripts do repo ou curl após push master
bash scripts/infra/install-vps-monitor.sh install   # ou /tmp após curl GitHub
bash scripts/infra/vps-cpu-report.sh
```

## Otimização CPU (playbook no skill)

1. Identificar top containers (`docker stats`)
2. Parar aquecedor WABA em teste
3. Pausar apps Easypanel ociosos (n8n, etc.)
4. Migrar apps para srv1787149 a médio prazo

## Validar

- Cursor: `@waba-infrastructure-specialist audite o VPS`
- VPS: `systemctl status waba-infra-audit.timer`
- Logs: `tail /var/log/waba-infra-audit.log`

## Segurança

Scripts não expõem segredos; não alteram `/app/data`.
