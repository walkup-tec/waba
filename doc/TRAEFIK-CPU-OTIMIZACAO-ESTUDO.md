# Estudo — Otimização CPU Traefik (Easypanel + WABA)

**Data:** 2026-06-27  
**Agentes:** infra (`waba-infrastructure-specialist`) + backend  
**Objetivo:** reduzir CPU; avaliar desligar access log e dashboard.

## Contexto real do nosso VPS

| Fato | Implicação |
|------|------------|
| Traefik é **`easypanel-traefik`** (Swarm) | **Não** editamos `docker-compose.yml` do repo WABA |
| Config Easypanel | `/etc/easypanel/traefik/config/` (`main.yaml`, opcional `custom.yaml`) |
| Scripts WABA | `traefik-permanent-all-vps.sh`, guard inotify, bootstrap 2min — **manter** |
| CPU snapshot jun/2026 | Traefik ~29% (pico pós-restart); Chatwoot ~14%; n8n ~9%; Next ~18% |

**Conclusão:** desligar logs do Traefik **ajuda se estiverem ligados**; **não** reduz CPU “drasticamente” sozinho. Maior ganho = pausar/migrar **Chatwoot, n8n, Typebot**.

## Pesquisa (Traefik oficial v3.x)

| Opção | Default Traefik | Impacto CPU |
|-------|-----------------|-------------|
| `accessLog` / `TRAEFIK_ACCESSLOG` | **false** | Alto **só se** estiver true + muito tráfego (I/O stdout/arquivo) |
| `log.level` / `TRAEFIK_LOG_LEVEL` | ERROR (se log on) | DEBUG/INFO aumenta muito |
| `api.dashboard` / `TRAEFIK_API_DASHBOARD` | true **se** API on | Baixo a moderado |
| `api.insecure` / `TRAEFIK_API_INSECURE` | **false** | Segurança; pouco CPU se já false |

Refs: [Traefik env vars](https://doc.traefik.io/traefik/reference/static-configuration/env/), [access logs](https://doc.traefik.io/traefik/observe/logs-and-access-logs/), [Easypanel custom config](https://easypanel.io/docs/guides/custom-traefik-config)

## Riscos Easypanel

| Ação | Risco |
|------|-------|
| `TRAEFIK_ACCESSLOG=false` | **Baixo** — alinhado ao default |
| `TRAEFIK_API_DASHBOARD=false` | **Baixo** se não usa dashboard |
| `TRAEFIK_API=false` (desligar API) | **Médio** — Easypanel pode depender da API internamente |
| `TRAEFIK_API_INSECURE=false` | **Recomendado** (já é default) |
| Editar `main.yaml` manualmente | **Alto** — Easypanel sobrescreve; usar **`custom.yaml`** |
| Remover scripts WABA (timers/guard) | **Crítico** — volta 404/502 pós-deploy |

## Plano de ação (ordem)

### Fase 0 — Auditoria (obrigatória)

```bash
bash /root/waba-infra/traefik-config-audit.sh
# ou do repo: bash scripts/infra/traefik-config-audit.sh
docker stats --no-stream | grep -i traefik
```

Anotar se `TRAEFIK_ACCESSLOG=true` ou `accessLog:` em `custom.yaml`.

### Fase 1 — Ganhos seguros (se audit mostrar logs ligados)

**Opção A — Easypanel UI** (se existir env do serviço Traefik):  
`TRAEFIK_ACCESSLOG=false`, `TRAEFIK_LOG_LEVEL=ERROR`

**Opção B — `custom.yaml`** (recomendado Easypanel):

```yaml
# /etc/easypanel/traefik/config/custom.yaml
accessLog: false
log:
  level: ERROR
api:
  dashboard: false
  insecure: false
```

Restart Traefik no Easypanel (Settings → Restart). **Snapshot hPanel antes.**

### Fase 2 — Validar WABA (obrigatório)

```bash
curl -sS http://127.0.0.1:30180/health
curl -sS -o /dev/null -w "%{http_code}\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
/root/traefik-permanent-all-vps.sh run
```

### Fase 3 — Medir antes/depois (15 min idle)

```bash
docker stats --no-stream | grep -i traefik
bash scripts/infra/vps-cpu-report.sh
```

### Fase 4 — Redução “drástica” de CPU (fora do Traefik)

1. Stop Chatwoot / n8n / apps Easypanel não usados  
2. Parar aquecedor WABA em teste  
3. Migrar apps para **srv1787149**

## Expectativa realista

| Medida | Redução CPU total VPS (estimativa) |
|--------|-------------------------------------|
| Access log off (se estava on) | 5–15% do processo Traefik; 2–5% VPS |
| Dashboard off | 1–3% Traefik |
| Stop Chatwoot | ~10–15% VPS |
| Stop n8n | ~5–10% VPS |
| Migrar apps secundários | **20–40% VPS** |

## Não fazer

- Copiar `docker-compose.yml` genérico da web no projeto WABA (não controla Easypanel Traefik).
- Desligar `traefik-permanent-*` / bootstrap / guard.
- `TRAEFIK_API=false` sem testar redeploy Easypanel em horário de baixo tráfego.

## Palavras-chave

`traefik-cpu`, `TRAEFIK_ACCESSLOG`, `custom.yaml`, `easypanel-traefik`, `traefik-config-audit`
