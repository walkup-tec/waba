#!/bin/bash
# Auditoria estática do Traefik Easypanel — logs, API, métricas, CPU
# Uso: bash traefik-config-audit.sh
# Versão: traefik-config-audit-2026-06-27-v1
set -euo pipefail

SVC="${TRAEFIK_SWARM_SVC:-easypanel-traefik}"
CFG="/etc/easypanel/traefik/config"

echo "=== Traefik Config Audit === $(date -Is) ==="
echo "service=$SVC"
echo ""

echo "--- Swarm replicas ---"
docker service ls --filter "name=${SVC}" --format '{{.Name}} {{.Replicas}} {{.Image}}' 2>/dev/null || echo "(service not found)"
echo ""

echo "--- Container CPU (instant) ---"
cid="$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)"
if [[ -n "$cid" ]]; then
  docker stats --no-stream --format "traefik: CPU={{.CPUPerc}} MEM={{.MemUsage}}" "$cid" 2>/dev/null || true
else
  echo "traefik container not running"
fi
echo ""

echo "--- Env vars (ACCESSLOG / LOG / API / METRICS) ---"
docker service inspect "$SVC" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE '^TRAEFIK_(ACCESSLOG|LOG|API|METRICS|PING|PROVIDERS)' || echo "(none or inspect failed)"
echo ""

echo "--- Command/Args (accesslog, api, log) ---"
docker service inspect "$SVC" --format '{{json .Spec.TaskTemplate.ContainerSpec.Args}}' 2>/dev/null \
  | tr ',' '\n' | grep -iE 'accesslog|accessLog|api\.|log\.|dashboard|metrics' || echo "(no matching args)"
echo ""

echo "--- custom.yaml (if exists) ---"
if [[ -f "${CFG}/custom.yaml" ]]; then
  grep -nE 'accessLog|accesslog|log:|api:|metrics:|dashboard' "${CFG}/custom.yaml" 2>/dev/null || echo "(no log/api keys in custom.yaml)"
else
  echo "(no ${CFG}/custom.yaml)"
fi
echo ""

echo "--- main.yaml size + routers count ---"
if [[ -f "${CFG}/main.yaml" ]]; then
  wc -c "${CFG}/main.yaml" 2>/dev/null || true
  grep -c '^\s*-\s*rule:' "${CFG}/main.yaml" 2>/dev/null || echo "routers: ?"
else
  echo "(no main.yaml)"
fi
echo ""

echo "--- Traefik service logs (access/error, last 30) ---"
docker service logs "$SVC" --tail 30 2>&1 | grep -iE 'access|error|warn|acme' | tail -15 || echo "(no filtered logs)"
echo ""

echo "--- Timers WABA (overhead fix routers — não desligar) ---"
systemctl is-active traefik-easypanel-config-guard.service 2>/dev/null || true
systemctl is-active traefik-easypanel-bootstrap.timer 2>/dev/null || true
systemctl is-active traefik-permanent-waba-fix.timer 2>/dev/null || true
echo ""
echo "Done. Compare ACCESSLOG/API before changing anything."
