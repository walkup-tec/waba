# Fix Traefik DEFINITIVO — WABA + Evolution

## Problema recorrente

Após **redeploy no Easypanel**, o Traefik regenera `/etc/easypanel/traefik/config/main.yaml` com upstream errado (`http://servico-swarm:8080`) ou **remove routers** → **404/502** em:

| Serviço | Host |
|---------|------|
| WABA | `waba.draxsistemas.com.br` |
| Evolution API | `walkup-evo-walkup-api.achpyp.easypanel.host` |

### Classe diferente: `curl (7)` — nada na porta 443

Os scripts **não substituem** o Traefik Easypanel quando o **processo/proxy inteiro está parado** (`docker ps | grep traefik` vazio, `ss` sem `:443`). Isso não é router errado — é **Easypanel Traefik down**.

**Sintoma:** `Failed to connect ... port 443` (até de dentro do VPS).

**Causas comuns:** reboot VPS, `docker service` Traefik em 0/1, OOM, update Easypanel, task Swarm `Rejected`.

**Desde v2 (`traefik-permanent-all-2026-06-20-v2`):** `run` tenta `docker service update --force easypanel-traefik` e republicar `:30180` no WABA antes do patch do `main.yaml`. Se Traefik não existir no Swarm, só o painel Easypanel resolve.

| Situação | Scripts resolvem? |
|----------|-----------------|
| 502 / router sumiu / IP morto no `main.yaml` | Sim (automático após `install`) |
| Traefik running, WABA OK em `:30180`, HTTPS 502 | Sim |
| **Nada escutando em :443** (Traefik down) | Só com v2 `run` ou manual |
| WABA sem porta publicada no host | v2 tenta `--publish-add 30180` |

## Solução definitiva (uma instalação no VPS)

Script mestre que instala **tudo**:

1. **Restore automático** de routers removidos (backup `main.yaml.bak*` ou golden)
2. **Patch backend** para `172.17.0.1:30180` (WABA) e `172.17.0.1:30181` (Evolution)
3. **Watcher Docker** (redeploy de containers)
4. **Timer 20s** (backup se watcher falhar)
5. **Cron 1 min** (backup extra)
6. **Guarda inotify** — quando Easypanel **reescreve main.yaml**, reaplica fixes na hora

### Instalar (root no VPS)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-all-vps.sh" -o /root/traefik-permanent-all-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-all-vps.sh
chmod +x /root/traefik-permanent-all-vps.sh
/root/traefik-permanent-all-vps.sh install
```

Ou com cópia local do repo:

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
