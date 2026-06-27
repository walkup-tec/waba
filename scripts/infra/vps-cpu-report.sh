#!/bin/bash
# Relatório de CPU / memória por container Docker
# Uso: bash vps-cpu-report.sh [--alert-load N]
# Versão: waba-infra-cpu-2026-06-27-v1
set -euo pipefail

ALERT_LOAD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --alert-load)
      ALERT_LOAD="${2:-8}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
host="$(hostname -s 2>/dev/null || hostname)"
load_1m="$(uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}' | tr -d ' ')"

echo "=== WABA CPU Report === $ts ($host) ==="
echo "load_1m=$load_1m"
echo ""
echo "Top processes:"
ps aux --sort=-%cpu 2>/dev/null | head -8 || true
echo ""
echo "Docker stats (no-stream):"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null \
  | sort -t$'\t' -k2 -hr 2>/dev/null | head -20 || echo "(docker stats unavailable)"
echo ""
echo "Swarm services:"
docker service ls --format "table {{.Name}}\t{{.Replicas}}\t{{.Image}}" 2>/dev/null | head -25 || true

if [[ -n "$ALERT_LOAD" ]]; then
  load_int="${load_1m%%.*}"
  if [[ "$load_int" =~ ^[0-9]+$ ]] && (( load_int >= ALERT_LOAD )); then
    echo ""
    echo "ALERT: load_1m=$load_1m >= threshold=$ALERT_LOAD"
    exit 2
  fi
fi

exit 0
