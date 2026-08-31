# Fix Traefik DEFINITIVO — WABA + Evolution

> **Enforcement no Cursor:** a lição static vs dynamic e o formato Easypanel estão na Rule  
> `.cursor/rules/ucp-traefik-static-dynamic.mdc` (`alwaysApply`). Este MD é detalhe operacional —  
> **não substituir a Rule**. Ver também `study-upstream-docs.mdc`.

## Problema recorrente

Após **redeploy no Easypanel**, o Traefik regenera `/etc/easypanel/traefik/config/main.yaml` com upstream errado (`http://servico-swarm:8080`) ou **remove routers** → **404/502** em:

| Serviço | Host |
|---------|------|
| WABA | `waba.draxsistemas.com.br` |
| Landing disparos | `wabadisparos.com.br` |
| Landing bets | `bet.waba.info` |
| Evolution API | `walkup-evo-walkup-api.achpyp.easypanel.host` |

### Classe diferente: `curl (7)` — nada na porta 443

Os scripts **v1** só corrigiam router com Traefik running. **v3** também recupera proxy morto e porta 80 zumbi.

**Sintoma:** `Failed to connect ... port 443` (até de dentro do VPS).

**Causas comuns:** reboot VPS, `docker service` Traefik em 0/1, OOM, update Easypanel, task Swarm `Rejected`, **docker-proxy zumbi na :80**.

**Desde v3 (`traefik-permanent-all-2026-06-20-v3`):** módulo **`traefik-easypanel-bootstrap-vps.sh`** — libera porta 80 zumbi, force Traefik, timer a cada 2 min.

| Situação | Scripts resolvem? |
|----------|-----------------|
| 502 / router sumiu / IP morto no `main.yaml` | Sim (automático após `install`) |
| Traefik running, WABA OK em `:30180`, HTTPS 502 | Sim |
| **Nada escutando em :443** (Traefik down) | Sim (bootstrap v3 + timer) |
| **Porta 80 presa por docker-proxy zumbi** | Sim (bootstrap v3) |
| WABA sem porta publicada no host | v3 tenta `--publish-add 30180` |

## Solução definitiva (uma instalação no VPS)

Script mestre que instala **tudo**:

1. **Restore automático** de routers removidos (backup `main.yaml.bak*` ou golden)
2. **Patch backend** para `172.17.0.1:30180` (WABA) e `172.17.0.1:30181` (Evolution)
3. **Watcher Docker** (redeploy de containers)
4. **Timer 20s** (backup se watcher falhar)
5. **Cron 1 min** (backup extra)
6. **Guarda inotify** — quando Easypanel **reescreve main.yaml**, reaplica fixes na hora

### Instalar (root no VPS) — **recomendado (tudo de uma vez)**

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/bootstrap-vps-definitivo.sh" | bash
```

Ou só Traefik permanent:

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-all-vps.sh" -o /root/traefik-permanent-all-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-all-vps.sh
chmod +x /root/traefik-permanent-all-vps.sh
/root/traefik-permanent-all-vps.sh install
```

### Auto-heal contínuo (timer 2 min no VPS)

Instalado automaticamente pelo bootstrap ou por `install-vps-monitor.sh install`:

- `/root/waba-infra/vps-traefik-autoheal.sh` — checa `bet.waba.info`, `wabadisparos.com.br`, `waba.draxsistemas.com.br/health` e executa `traefik-permanent-all-vps.sh run` se falhar.

### GitHub Actions (opcional — sem SSH manual)

Workflow `.github/workflows/vps-infra-heal.yml` — a cada 5 min + manual. Requer secret `VPS_SSH_PRIVATE_KEY` (e opcional `VPS_HOST`).

### Instalar manual (legado)

```bash
cp /caminho/waba/scripts/traefik-permanent-all-vps.sh /root/
sed -i 's/\r$//' /root/traefik-permanent-all-vps.sh
chmod +x /root/traefik-permanent-all-vps.sh
/root/traefik-permanent-all-vps.sh install
```

### Validar

```bash
/root/traefik-permanent-all-vps.sh run
/root/traefik-permanent-all-vps.sh status
tail -30 /var/log/traefik-permanent-all.log
```

Esperado:

- `waba:200 health:200`
- `evo_fetch:200` ou `401` (401 = API respondeu, falta apikey no probe externo)

### Após cada deploy Easypanel

**Não precisa fazer nada manualmente.** A guarda `traefik-easypanel-config-guard.service` detecta alteração no `main.yaml` e executa `run` automaticamente.

Se algo falhar:

```bash
/root/traefik-permanent-all-vps.sh run
```

## Componentes instalados

| Arquivo | Função |
|---------|--------|
| `/root/traefik-easypanel-bootstrap-vps.sh` | Bootstrap Traefik (porta 80 zumbi + force proxy) |
| `/root/traefik-permanent-all-vps.sh` | Orquestrador (install / run / status) |
| `/root/traefik-permanent-waba-vps.sh` | Fix WABA |
| `/root/traefik-permanent-walkup-evo-vps.sh` | Fix Evolution |
| `/root/traefik-easypanel-config-guard.sh` | inotify no main.yaml |
| `/root/restore-waba-traefik-router-vps.sh` | Restore router WABA |
| `/root/restore-walkup-evo-traefik-router-vps.sh` | Restore router Evolution |

## Serviços systemd

| Unit | Intervalo |
|------|-----------|
| `traefik-easypanel-config-guard.service` | Ao salvar main.yaml |
| `traefik-permanent-waba-watch.service` | Eventos Docker |
| `traefik-permanent-waba-fix.timer` | 20s |
| `traefik-permanent-walkup-evo-watch.service` | Eventos Docker |
| `traefik-permanent-walkup-evo-fix.timer` | 20s |

## Portas host (Swarm publish)

```bash
docker service update --publish-add published=30180,target=3000,protocol=tcp waba_waba_disparador
docker service update --publish-add published=30181,target=8080,protocol=tcp walkup_evo-walkup-api
```

(Os scripts permanentes publicam automaticamente se faltar.)

## Docs relacionadas

- [FIX-TRAEFIK-WABA.md](FIX-TRAEFIK-WABA.md) — detalhes WABA
- [FIX-TRAEFIK-WALKUP-EVO.md](FIX-TRAEFIK-WALKUP-EVO.md) — detalhes Evolution

## Typebot (outro repo)

O Typebot usa `traefik-permanent-vps.sh` no repo typebot-Saas — **não** substituir pelo script WABA.
