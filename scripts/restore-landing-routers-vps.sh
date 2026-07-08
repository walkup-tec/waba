#!/bin/bash
# Landings wabadisparos.com.br + bet.waba.info via Traefik custom.yaml (Easypanel não usa routers: no main.yaml).
#
# curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" | bash
# Versão: restore-landing-routers-2026-07-08-v4
set -euo pipefail

RESTORE_VERSION="restore-landing-routers-2026-07-08-v4"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
CUSTOM_CFG="${CFG_DIR}/custom.yaml"
LANDINGS_CFG="${CFG_DIR}/waba-landings.yaml"
LOG="${RESTORE_LANDING_LOG:-/var/log/restore-landing-routers.log}"
BOOTSTRAP="/root/traefik-easypanel-bootstrap-vps.sh"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

PV_SWARM="waba_paginadevendas"
BETS_SWARM="waba_bets_pv"
PV_HOST_PORT="${LANDING_PV_HOST_PORT:-30210}"
BETS_HOST_PORT="${LANDING_BETS_HOST_PORT:-30201}"
HOST_GW="${TRAEFIK_HOST_GW:-172.17.0.1}"

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*" >>"$LOG"
  printf '[%s] %s\n' "$(date -Is)" "$*" >&2
}

traefik_cid() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
}

wait_for_traefik() {
  local i
  for i in $(seq 1 30); do
    [[ -n "$(traefik_cid)" ]] && ss -tlnp 2>/dev/null | grep -q ':443 ' && return 0
    sleep 2
  done
  return 1
}

http_local() {
  curl -sS -o /dev/null -w "%{http_code}" --resolve "${1}:443:127.0.0.1" --max-time 15 \
    "https://${1}${2:-/}" 2>/dev/null || echo "000"
}

host_port_ok() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] || return 1
  curl -sf -m 5 -o /dev/null "http://127.0.0.1:${port}/" 2>/dev/null
}

service_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$1"
}

service_replicas() {
  docker service ls --format '{{.Name}} {{.Replicas}}' 2>/dev/null \
    | awk -v s="$1" '$1 == s { print $2; exit }'
}

list_published_ports() {
  docker service inspect "$1" --format '{{range .Endpoint.Ports}}{{.PublishedPort}} {{end}}' 2>/dev/null \
    | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u
}

service_target_port() {
  local swarm="$1" cid port
  cid=$(docker ps -q -f "name=${swarm}" -f status=running | head -1)
  if [[ -n "$cid" ]]; then
    port=$(docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^PORT=' | head -1 | cut -d= -f2- | tr -d '\r' || true)
    [[ -n "$port" && "$port" =~ ^[0-9]+$ ]] && { echo "$port"; return 0; }
  fi
  port=$(docker service inspect "$swarm" --format '{{range .Endpoint.Ports}}{{.TargetPort}}{{end}}' 2>/dev/null \
    | grep -E '^[0-9]+$' | head -1 || true)
  [[ -n "$port" ]] && echo "$port" || echo "3000"
}

ensure_host_publish() {
  local swarm="$1" default_port="$2" p target
  for p in $(list_published_ports "$swarm"); do
    host_port_ok "$p" && { echo "$p"; return 0; }
  done
  target=$(service_target_port "$swarm")
  log "Publicando ${swarm} host:${default_port} target:${target}"
  timeout 120 docker service update \
    --publish-add "mode=host,published=${default_port},target=${target},protocol=tcp" \
    "$swarm" >>"$LOG" 2>&1 || true
  sleep 10
  host_port_ok "$default_port" && { echo "$default_port"; return 0; }
  for target in 3000 80; do
    timeout 120 docker service update \
      --publish-rm "${default_port}" 2>/dev/null || true
    timeout 120 docker service update \
      --publish-add "mode=host,published=${default_port},target=${target},protocol=tcp" \
      "$swarm" >>"$LOG" 2>&1 || true
    sleep 8
    host_port_ok "$default_port" && { echo "$default_port"; return 0; }
  done
  echo "$default_port"
}

# stdout = só URL; logs vão para stderr
discover_backend() {
  local swarm="$1" default_port="$2" published url
  service_exists "$swarm" || return 1

  for published in $(list_published_ports "$swarm") "$default_port"; do
    if host_port_ok "$published"; then
      url="http://${HOST_GW}:${published}/"
      log "${swarm}: OK porta ${published} → ${url}"
      printf '%s\n' "$url"
      return 0
    fi
  done

  published=$(ensure_host_publish "$swarm" "$default_port")
  url="http://${HOST_GW}:${published}/"
  if host_port_ok "$published"; then
    log "${swarm}: publicado ${url}"
    printf '%s\n' "$url"
    return 0
  fi

  local replicas
  replicas=$(service_replicas "$swarm")
  if [[ "${replicas:-}" =~ ^[1-9] ]]; then
    log "${swarm}: fallback ${url} (réplicas ${replicas})"
    printf '%s\n' "$url"
    return 0
  fi
  return 1
}

ensure_bootstrap() {
  [[ -x "$BOOTSTRAP" ]] || curl -fsSL "${REPO_BASE}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOTSTRAP" 2>/dev/null || true
  [[ -x "$BOOTSTRAP" ]] || return 0
  sed -i 's/\r$//' "$BOOTSTRAP" 2>/dev/null || true
  TRAEFIK_BOOTSTRAP_LOG="$LOG"
  # shellcheck disable=SC1090
  source "$BOOTSTRAP"
  traefik_bootstrap_ensure_traefik || true
}

write_landings_yaml() {
  local pv_url="$1" bets_url="$2"
  mkdir -p "$CFG_DIR"
  cat >"$LANDINGS_CFG" <<EOF
# Gerado por ${RESTORE_VERSION} — não editar manualmente
http:
  routers:
    waba-landing-wabadisparos:
      rule: Host(\`wabadisparos.com.br\`) || Host(\`waba-paginadevendas.achpyp.easypanel.host\`)
      entryPoints:
        - websecure
      service: waba-landing-wabadisparos-svc
      tls: {}
      priority: 200
    waba-landing-bet-waba:
      rule: Host(\`bet.waba.info\`) || Host(\`waba-bets-pv.achpyp.easypanel.host\`)
      entryPoints:
        - websecure
      service: waba-landing-bet-waba-svc
      tls: {}
      priority: 200
  services:
    waba-landing-wabadisparos-svc:
      loadBalancer:
        servers:
          - url: "${pv_url%/}/"
    waba-landing-bet-waba-svc:
      loadBalancer:
        servers:
          - url: "${bets_url%/}/"
EOF
  log "Escrito ${LANDINGS_CFG}"

  python3 - "$CUSTOM_CFG" "$LANDINGS_CFG" <<'PY'
import pathlib, sys
custom, landings = map(pathlib.Path, sys.argv[1:3])
block = landings.read_text(encoding="utf-8")
marker = "# WABA_LANDINGS_MERGE"
if custom.exists():
    text = custom.read_text(encoding="utf-8")
    if marker in text:
        pre = text.split(marker)[0].rstrip()
        custom.write_text(pre + "\n\n" + marker + "\n" + block.split("\n", 1)[1], encoding="utf-8")
    else:
        custom.write_text(text.rstrip() + "\n\n" + marker + "\n" + block.split("\n", 1)[1], encoding="utf-8")
else:
    custom.write_text(block, encoding="utf-8")
print(f"  custom.yaml atualizado ({custom})")
PY
}

reload_traefik() {
  local traefik i
  for i in $(seq 1 20); do
    traefik=$(traefik_cid || true)
    [[ -n "${traefik:-}" ]] && break
    sleep 2
  done
  [[ -n "${traefik:-}" ]] || { log "ERRO: Traefik não running"; return 1; }
  docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  sleep 8
  log "Traefik recarregado"
}

main() {
  mkdir -p "$(dirname "$LOG")"
  log "=== ${RESTORE_VERSION} início ==="

  ensure_bootstrap
  wait_for_traefik || log "AVISO: Traefik lento"

  local pv_url bets_url
  pv_url=$(discover_backend "$PV_SWARM" "$PV_HOST_PORT" || true)
  bets_url=$(discover_backend "$BETS_SWARM" "$BETS_HOST_PORT" || true)

  [[ -n "${pv_url:-}" ]] || { log "ERRO: sem backend ${PV_SWARM}"; exit 1; }
  [[ -n "${bets_url:-}" ]] || { log "ERRO: sem backend ${BETS_SWARM}"; exit 1; }

  log "backend paginadevendas=${pv_url}"
  log "backend bets_pv=${bets_url}"

  write_landings_yaml "$pv_url" "$bets_url"
  reload_traefik

  log "Validação:"
  log "  wabadisparos → $(http_local wabadisparos.com.br /)"
  log "  bet.waba.info → $(http_local bet.waba.info /)"
  log "  pv easypanel → $(http_local waba-paginadevendas.achpyp.easypanel.host /)"
  log "  bets easypanel → $(http_local waba-bets-pv.achpyp.easypanel.host /)"
  log "=== ${RESTORE_VERSION} fim ==="
}

main "$@"
