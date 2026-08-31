# Exemplos — Agente Infra WABA

## Como invocar no Cursor

```
@waba-infrastructure-specialist audite a infra do srv1261237 — CPU está em 74%
```

```
Preciso resolver 502 no waba.draxsistemas.com.br após redeploy Easypanel
```

```
Instale o monitor de infra no VPS e me diga o que configurar
```

## Exemplo: manutenção CPU (2026-06-27)

**Entrada:** Hostinger sugere `docker system prune` + `restart docker`

**Ações corretas:**
1. Snapshot no hPanel
2. `docker system prune` (y) — OK se 0B
3. `systemctl restart docker` (não colar `then` / `Click yes`)
4. Validar Traefik 1/1, health 30180, HTTPS 200, cert Let's Encrypt
5. `ps aux` / `docker stats` — confirmar carga real (n8n, sidekiq, etc.)

**Resultado:** infra OK; CPU elevada = multi-app, não fantasma.

## Exemplo: acme.json corrompido

```bash
python3 -m json.tool /etc/easypanel/traefik/acme.json || echo INVALIDO
cp -a /etc/easypanel/traefik/acme.json /etc/easypanel/traefik/acme.json.bak-$(date +%F-%H%M%S)
printf '{}\n' > /etc/easypanel/traefik/acme.json
chmod 600 /etc/easypanel/traefik/acme.json
docker service update --force easypanel-traefik
# Renovar cert no Easypanel → Domínios → waba.draxsistemas.com.br
```

## Exemplo: relatório pós-auditoria

```markdown
## Status infra — 2026-06-27

| Check | Resultado |
|-------|-----------|
| Docker / Swarm | active / active |
| Traefik | 1/1 |
| WABA /health | 200, deployMarker ok |
| HTTPS + cert | 200, Let's Encrypt até Sep/2026 |
| Load | 2.1 (4 cores) |
| Top container | n8n 12%, traefik 8% |

## Ações
- Monitor instalado (`waba-infra-audit.timer`)

## Próximos passos
- Pausar n8n workflows de teste
- Avaliar mover Chatwoot para srv1787149
```
