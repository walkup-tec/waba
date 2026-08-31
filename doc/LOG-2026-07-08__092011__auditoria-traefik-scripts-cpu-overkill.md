# LOG — 2026-07-08 09:20 — Auditoria Traefik: scripts desnecessários + análise CPU

## Contexto
- Pedido: após ler docs Traefik (static vs dynamic), varrer scripts/processos feitos “à moda antiga” e avaliar sugestão ChatGPT sobre CPU.
- Âncora: Rules `ucp-traefik-static-dynamic` + `study-upstream-docs`; File provider hot-reload.

## Por que a maioria dos loops ficou desnecessária

Com File Provider + `watch`, alteração válida em `main.yaml` já hot-reloada. O Easypanel **reescreve** `main.yaml` com upstream morto / sem Host public — isso **ainda** justifica **um** revisor (patch sob demanda). **Não** justifica 4× timer 20s + 4× `docker events` + 4× cron/minuto + guard inotify disparando `all run` em cascata.

Cada `run` dos permanent scripts tende a: nestar Traefik, inspecionar serviços, reescrever yaml, HUP — isso alimenta **dockerd** e **CPU Traefik** mesmo sem tráfego.

## Inventário (repo → VPS típico)

### Essencial / manter (com uso raro)

| Artefato | Papel |
|----------|--------|
| `traefik-easypanel-bootstrap-vps.sh` | Traefik `0/1` / porta 80 zumbi — **só sob demanda** ou timer **≥5–15 min** |
| `restore-landing-routers-vps.sh` (v6+) | Domínio custom no formato Easypanel — **manual / pós-redeploy** |
| `restore-waba-traefik-router-vps.sh` | Restore Host WABA de backup — **manual** |
| `restore-walkup-evo-traefik-router-vps.sh` | Idem Evolution — **manual** |
| `diagnose-waba-502-vps.sh` / `diagnose-walkup-evo-502-vps.sh` | Diagnóstico pontual |
| `scripts/infra/traefik-config-audit.sh` | Auditoria (CPU, accessLog, contagem routers) |
| `scripts/infra/vps-health-audit.sh` / `vps-cpu-report.sh` | Saúde VPS |

### Overkill (candidatos a desligar no VPS)

| No VPS (se instalado) | Frequência atual | Veredito |
|-----------------------|------------------|----------|
| `traefik-permanent-waba-fix.timer` | **20s** | Desligar ou ≥5 min; WABA já tem permanente histórico |
| `traefik-permanent-walkup-evo-fix.timer` | **20s** | Idem |
| `traefik-permanent-paginadevendas-fix.timer` | **20s** | Preferir restore-landing v6 sob demanda |
| `traefik-permanent-bets-pv-fix.timer` | **20s** | Idem |
| `*-watch.service` (4× `docker events`) | contínuo | **Alto custo dockerd** — desligar se guard/manual existir |
| `/etc/cron.d/traefik-permanent-*-fix` | **1/min** × N | Redundante com timer — remover |
| `traefik-easypanel-config-guard` (inotify → `all run`) | cada write Easypanel | Manter **ou** debounce longo; cuidado com fan-out dos 4 permanents |
| `traefik-easypanel-bootstrap.timer` | **2 min** | Pode ir para 10–15 min se Traefik estável |

### Script orquestrador

| Artefato | Veredito |
|----------|----------|
| `traefik-permanent-all-vps.sh` | Manter como **comando manual** `run`; `install` não deve reativar timers 20s sem revisão |

### Código app (não VPS)

Monitor uptime (`uptime-monitor.service.ts`) **não** controla Traefik — útil; não é overkill de proxy.

## Avaliação da análise ChatGPT (CPU)

| Afirmação | Faz sentido? | Nota WABA |
|-----------|--------------|-----------|
| Traefik ~30% alto p/ poucas conexões | **Sim** | Já medimos ~39% com ACCESSLOG on → ~5% off (LOG 2026-06-27) |
| Load 6.8 em 4 vCPU = sobrecarga | **Sim** | VPS multi-app (Chatwoot, n8n, Typebot, Evolution…) |
| Steal Time ~13% (Hostinger) | **Provável** | Limita teto de CPU; não “conserta” com script Traefik |
| dockerd alto por eventos/redes | **Sim** | Nossos 4× `docker events` + timers agravam |
| Threads Traefik = TLS/roteamento | **Parcial** | Normal multithreaded; piora com accessLog + muitas rules |
| Muitos serviços/routers | **Sim** | Consolidar / pausar apps ociosos = maior ganho |
| Swarm pior que Compose p/ Traefik | **Parcial** | Provider Docker/Swarm consome; File provider do Easypanel é o caminho principal |
| Trocar de proxy agora | **Não** | Otimizar first (já no estudo CPU do repo) |
| Auditar accessLog / log.level | **Sim / já feito** | Revalidar se Easypanel reaplico ACCESSLOG=true |
| `docker events --since 5m` | **Sim** | Blindagem: se flood, desligar watches |

**Conclusão alinhada ao ChatGPT:** não trocar Traefik; problema = soma (apps + dockerd + steal + possible self-heal hiperativo). **Nossa contribuição extra** (não citada por ele): loops permanent 20s/`docker events` são provavelmente **desnecessários** pós-doc e devem ser desligados.

## Recomendação de implementação (ordem)

### Já (baixo risco) — no VPS

```bash
# 1) Ver o que está ativo
systemctl list-units 'traefik-*' --all
ls /etc/cron.d/traefik-* 2>/dev/null

# 2) Desligar overkill (exemplo)
systemctl disable --now \
  traefik-permanent-waba-fix.timer \
  traefik-permanent-walkup-evo-fix.timer \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-watch.service \
  traefik-permanent-walkup-evo-watch.service \
  traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-bets-pv-watch.service 2>/dev/null || true
rm -f /etc/cron.d/traefik-permanent-*-fix

# 3) Bootstrap menos agressivo (opcional)
# systemctl edit traefik-easypanel-bootstrap.timer → OnUnitActiveSec=10min

# 4) Confirmar accessLog
grep -i accessLog /etc/easypanel/traefik/config/custom.yaml
docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -i ACCESS

# 5) Medir
docker stats --no-stream | head
uptime
```

Pós-redeploy Easypanel: `/root/traefik-permanent-all-vps.sh run` **ou** `restore-landing-routers-vps.sh` — sob demanda.

### Código (próximo PR, não destruir ainda)

- Documentar em `traefik-permanent-*.sh`: “timers 20s = legado; preferir disable”.
- Opcional: flag `WABA_TRAEFIK_HEAL_MODE=manual|light|legacy`.
- Guard inotify: chamar só restore necessário, não 4 runs em série.

### Infra produto

- Pausar Chatwoot/n8n/Typebot ociosos; migrar secundários para `srv1787149` (já no skill infra).
- Steal Time: plano Hostinger / VPS maior se `st` sustentado >5–10%.

## O que NÃO apagar do repo agora

Scripts permanent / restore / bootstrap — ainda úteis **manuais**. Apagar código sem soft-disable no VPS = risco de perder ferramenta no próximo 404.

## Palavras-chave
traefik overkill, timer 20s, docker events CPU, steal time Hostinger, accessLog, permanent-all manual, auditoria scripts
