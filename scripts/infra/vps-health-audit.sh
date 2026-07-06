#!/bin/bash
# Auditoria de saúde — WABA + Traefik + Docker (VPS Hostinger / Easypanel)
# Uso: bash vps-health-audit.sh [--json]
# Versão: waba-infra-audit-2026-06-27-v1
set -euo pipefail

JSON_MODE=0
[[ "${1:-}" == "--json" ]] && JSON_MODE=1

ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
host="$(hostname -s 2>/dev/null || hostname)"
issues=()

note_issue() { issues+=("$1"); }

docker_active="$(systemctl is-active docker 2>/dev/null || echo unknown)"
swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo unknown)"

traefik_replicas="$(docker service ls --format '{{.Name}} {{.Replicas}}' 2>/dev/null | awk '/easypanel-traefik/ {print $2; exit}' || true)"
waba_replicas="$(docker service ls --format '{{.Name}} {{.Replicas}}' 2>/dev/null | awk '/waba_waba_disparador/ {print $2; exit}' || true)"

port_443="$(ss -tlnp 2>/dev/null | grep -c ':443 ' || true)"
port_30180="$(ss -tlnp 2>/dev/null | grep -c ':30180 ' || true)"

health_code="000"
health_body=""
if health_body="$(curl -sS --max-time 10 -w "\n%{http_code}" http://127.0.0.1:30180/health 2>/dev/null)"; then
  health_code="$(echo "$health_body" | tail -n1)"
  health_body="$(echo "$health_body" | sed '$d' | head -c 400)"
else
  note_issue "waba_health_unreachable"
fi

https_code="000"
if https_code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
  --resolve waba.draxsistemas.com.br:443:127.0.0.1 \
  https://waba.draxsistemas.com.br/health 2>/dev/null)"; then
  :
else
  https_code="000"
  note_issue "https_health_failed"
fi

cert_subject=""
cert_issuer=""
cert_not_after=""
if cert_info="$(echo | openssl s_client -connect 127.0.0.1:443 -servername waba.draxsistemas.com.br 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates 2>/dev/null)"; then
  cert_subject="$(echo "$cert_info" | awk -F= '/subject=/ {print $2}' | head -1)"
  cert_issuer="$(echo "$cert_info" | awk -F= '/issuer=/ {print $2}' | head -1)"
  cert_not_after="$(echo "$cert_info" | awk -F= '/notAfter=/ {print $2}' | head -1)"
  if echo "$cert_issuer" | grep -qi 'Easypanel' && ! echo "$cert_issuer" | grep -qi 'Let'; then
    note_issue "cert_self_signed_easypanel"
  fi
else
  note_issue "cert_read_failed"
fi

load_avg="$(uptime | sed 's/.*load average: //' | tr -d ' ')"
mem_avail_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"

[[ "$docker_active" != "active" ]] && note_issue "docker_not_active"
[[ "$swarm_state" != "active" && "$swarm_state" != "manager" ]] && note_issue "swarm_not_active"
[[ "${traefik_replicas:-}" != "1/1" ]] && note_issue "traefik_not_1_1"
[[ "${waba_replicas:-}" != "1/1" ]] && note_issue "waba_not_1_1"
[[ "$port_443" -eq 0 ]] && note_issue "port_443_closed"
[[ "$port_30180" -eq 0 ]] && note_issue "port_30180_closed"
[[ "$health_code" != "200" ]] && note_issue "health_not_200"
[[ "$https_code" != "200" ]] && note_issue "https_not_200"

if [[ "$JSON_MODE" -eq 1 ]]; then
  issues_json="[]"
  if ((${#issues[@]})); then
    issues_json="$(printf '"%s",' "${issues[@]}" | sed 's/,$//')"
    issues_json="[${issues_json}]"
  fi
  printf '{"ts":"%s","host":"%s","docker":"%s","swarm":"%s","traefik":"%s","waba":"%s","health_code":"%s","https_code":"%s","load":"%s","mem_avail_kb":%s,"issues":%s}\n' \
    "$ts" "$host" "$docker_active" "$swarm_state" "${traefik_replicas:-unknown}" "${waba_replicas:-unknown}" \
    "$health_code" "$https_code" "$load_avg" "$mem_avail_kb" "$issues_json"
  exit 0
fi

echo "=== WABA Infra Audit === $ts ($host) ==="
echo "docker=$docker_active swarm=$swarm_state load=$load_avg mem_avail_kb=$mem_avail_kb"
echo "traefik=${traefik_replicas:-?} waba=${waba_replicas:-?} :443=$port_443 :30180=$port_30180"
echo "health_local=$health_code https=$https_code"
echo "cert_subject=$cert_subject"
echo "cert_issuer=$cert_issuer"
echo "cert_not_after=$cert_not_after"
if ((${#issues[@]})); then
  echo "ISSUES:"
  printf ' - %s\n' "${issues[@]}"
  exit 1
fi
echo "OK: all checks passed"
exit 0
