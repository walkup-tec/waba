#!/usr/bin/env bash
# =============================================================================
# traefik-heal-disable-overkill-vps.sh
# Desliga apenas self-heal hiperativo do Traefik (timers 20s, docker events,
# cron/minuto). NÃO pausa nem para containers, serviços Swarm, WABA, Evolution,
# Redis, Postgres, Typebot, Chatwoot, n8n, etc.
#
# Seguro para disponibilidade do app: processos de negócio continuam 1/1.
# Efeito colateral aceito: após redeploy Easypanel que apague Host custom,
# pode ser preciso rodar restore manual (não há auto-heal a cada 20s).
#
# Uso (root no VPS):
#   bash traefik-heal-disable-overkill-vps.sh status
#   bash traefik-heal-disable-overkill-vps.sh apply
#
# Nunca faz: docker service scale|pause|update --replicas 0, prune, restart
# docker, force Traefik, editar main.yaml, mexer em volumes.
# =============================================================================
set -euo pipefail

VERSION="traefik-heal-disable-overkill-2026-07-08-v1"
LOG="${LOG:-/var/log/traefik-heal-disable-overkill.log}"

# Units de polling / eventos (OVERKILL)
DISABLE_UNITS=(
  traefik-permanent-waba-fix.timer
  traefik-permanent-waba-watch.service
  traefik-permanent-walkup-evo-fix.timer
  traefik-permanent-walkup-evo-watch.service
  traefik-permanent-paginadevendas-fix.timer
  traefik-permanent-paginadevendas-watch.service
  traefik-permanent-bets-pv-fix.timer
  traefik-permanent-bets-pv-watch.service
)

# Cron redundante com timer
CRON_GLOBS=(
  /etc/cron.d/traefik-permanent-waba-fix
  /etc/cron.d/traefik-permanent-walkup-evo-fix
  /etc/cron.d/traefik-permanent-paginadevendas-fix
  /etc/cron.d/traefik-permanent-bets-pv-fix
)

# Mantidos de propósito (recuperação sem polling agressivo)
KEEP_UNITS=(
  traefik-easypanel-bootstrap.timer
  traefik-easypanel-config-guard.service
)

log() {
  local msg="$*"
  echo "[$(date '+%F %T')] $msg" | tee -a "$LOG"
}

unit_active() {
  systemctl is-active "$1" 2>/dev/null || echo inactive
}

show_status() {
  echo "=== $VERSION — status ==="
  echo ""
  echo "Serão DESLIGADOS (heal hiperativo — NÃO são apps WABA):"
  for u in "${DISABLE_UNITS[@]}"; do
    if systemctl list-unit-files "$u" &>/dev/null 2>&1; then
      printf "  %-48s %s\n" "$u" "$(unit_active "$u")"
    else
      printf "  %-48s %s\n" "$u" "(não instalado)"
    fi
  done
  echo ""
  echo "Cron files:"
  for f in "${CRON_GLOBS[@]}"; do
    if [[ -e "$f" ]]; then
      printf "  %s (existe)\n" "$f"
    else
      printf "  %s (ausente)\n" "$f"
    fi
  done
  echo ""
  echo "MANTIDOS (recuperação leve; não pausam apps):"
  for u in "${KEEP_UNITS[@]}"; do
    if systemctl list-unit-files "$u" &>/dev/null 2>&1; then
      printf "  %-48s %s\n" "$u" "$(unit_active "$u")"
    else
      printf "  %-48s %s\n" "$u" "(não instalado)"
    fi
  done
  echo ""
  echo "Serviços de negócio (somente leitura — NÃO alterados por este script):"
  if command -v docker >/dev/null 2>&1; then
    docker service ls --format 'table {{.Name}}\t{{.Replicas}}\t{{.Image}}' 2>/dev/null \
      | grep -E 'NAME|waba|walkup|easypanel-traefik|paginadevendas|bets_pv' || true
  else
    echo "  (docker indisponível)"
  fi
  echo ""
  echo "load: $(uptime)"
}

disable_unit() {
  local u="$1"
  if ! systemctl list-unit-files "$u" &>/dev/null 2>&1; then
    log "skip (não instalado): $u"
    return 0
  fi
  systemctl disable --now "$u" 2>/dev/null || systemctl stop "$u" 2>/dev/null || true
  log "disabled --now: $u → $(unit_active "$u")"
}

apply_safe() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Erro: rode como root no VPS." >&2
    exit 1
  fi

  log "=== APPLY $VERSION ==="
  log "Garantia: nenhum docker service/container será pausado, scaled ou removido."

  for u in "${DISABLE_UNITS[@]}"; do
    disable_unit "$u"
  done

  for f in "${CRON_GLOBS[@]}"; do
    if [[ -e "$f" ]]; then
      rm -f "$f"
      log "removed cron: $f"
    fi
  done

  systemctl daemon-reload 2>/dev/null || true

  log "KEEP intactos:"
  for u in "${KEEP_UNITS[@]}"; do
    log "  $u → $(unit_active "$u")"
  done

  echo ""
  echo "=========================================="
  echo " Overkill de heal DESLIGADO"
  echo "=========================================="
  echo " Apps WABA / Evolution / Redis / DB: intocados."
  echo " Se Host custom sumir após redeploy Easypanel:"
  echo "   /root/traefik-permanent-all-vps.sh run"
  echo "   # ou restore-landing-routers-vps.sh"
  echo " Log: $LOG"
  echo ""
  show_status
}

case "${1:-}" in
  status|"")
    show_status
    if [[ "${1:-}" == "" ]]; then
      echo "Uso: $0 status | apply"
      echo "  apply = só desliga timers/watches/cron de heal (sem tocar em apps)."
    fi
    ;;
  apply)
    apply_safe
    ;;
  *)
    echo "Uso: $0 status | apply" >&2
    exit 1
    ;;
esac
