#!/bin/bash
# Cria/atualiza routers Traefik para landings wabadisparos + bet.waba (sem depender de backup Easypanel).
#
# Uso (root no VPS):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" -o /root/restore-landing-routers-vps.sh
#   sed -i 's/\r$//' /root/restore-landing-routers-vps.sh
#   chmod +x /root/restore-landing-routers-vps.sh
#   /root/restore-landing-routers-vps.sh
#
# Versão: restore-landing-routers-2026-07-08-v1
set -euo pipefail

RESTORE_VERSION="restore-landing-routers-2026-07-08-v1"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${RESTORE_LANDING_LOG:-/var/log/restore-landing-routers.log}"
BOOTSTRAP="/root/traefik-easypanel-bootstrap-vps.sh"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() {
  echo "[$(date -Is)] $*" | tee -a "$LOG"
}

traefik_cid() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
}

http_local() {
  local host="$1" path="${2:-/}"
  curl -sS -o /dev/null -w "%{http_code}" --resolve "${host}:443:127.0.0.1" --max-time 15 \
    "https://${host}${path}" 2>/dev/null || echo "000"
}

ensure_bootstrap() {
  if [[ -x "$BOOTSTRAP" ]]; then
    TRAEFIK_BOOTSTRAP_LOG="$LOG"
    # shellcheck disable=SC1090
    source "$BOOTSTRAP"
    traefik_bootstrap_ensure_traefik || true
    return 0
  fi
  if curl -fsSL "${REPO_BASE}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOTSTRAP" 2>/dev/null; then
    sed -i 's/\r$//' "$BOOTSTRAP" 2>/dev/null || true
    chmod +x "$BOOTSTRAP"
    ensure_bootstrap
    return 0
  fi
  log "AVISO: bootstrap Traefik ausente — continuando"
}

discover_backend() {
  local swarm="$1"
  local traefik port url
  traefik=$(traefik_cid)
  [[ -n "$traefik" ]] || { echo ""; return 1; }

  port=$(docker service inspect "$swarm" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
    | grep -E '^PORT=' | head -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -z "$port" ]] && port=80

  for url in \
    "http://tasks.${swarm}:${port}/" \
    "http://${swarm}:${port}/" \
    "http://tasks.${swarm}:80/" \
    "http://tasks.${swarm}:3000/"; do
    if docker exec "$traefik" wget -q --spider --timeout=4 "$url" 2>/dev/null; then
      echo "${url}"
      return 0
    fi
  done

  local published
  published=$(docker service inspect "$swarm" --format \
    '{{range .Endpoint.Ports}}{{if .PublishedPort}}{{.PublishedPort}}{{end}}{{end}}' 2>/dev/null | head -1)
  if [[ -n "${published:-}" && "$published" =~ ^[0-9]+$ ]]; then
    url="http://172.17.0.1:${published}/"
    if docker exec "$traefik" wget -q --spider --timeout=4 "$url" 2>/dev/null; then
      echo "$url"
      return 0
    fi
  fi
  echo ""
  return 1
}

patch_landings() {
  local pv_url bets_url
  pv_url=$(discover_backend "waba_paginadevendas" || true)
  bets_url=$(discover_backend "waba_bets_pv" || true)
  log "backend paginadevendas=${pv_url:-AUSENTE}"
  log "backend bets_pv=${bets_url:-AUSENTE}"

  [[ -f "$CFG" ]] || { log "ERRO: ${CFG} não existe"; return 1; }
  cp -a "$CFG" "${CFG}.bak-restore-landing-$(date +%Y%m%d-%H%M%S)"

  python3 - "$CFG" "${pv_url:-}" "${bets_url:-}" <<'PY'
import re, sys
path, pv_url, bets_url = sys.argv[1:4]
text = open(path, encoding="utf-8").read()

landings = [
    {
        "router": "waba-landing-wabadisparos",
        "service": "waba-landing-wabadisparos-svc",
        "hosts": ["wabadisparos.com.br", "waba-paginadevendas.achpyp.easypanel.host"],
        "backend": (pv_url or "").strip(),
        "swarm": "waba_paginadevendas",
    },
    {
        "router": "waba-landing-bet-waba",
        "service": "waba-landing-bet-waba-svc",
        "hosts": ["bet.waba.info", "waba-bets-pv.achpyp.easypanel.host"],
        "backend": (bets_url or "").strip(),
        "swarm": "waba_bets_pv",
    },
]

def host_rule(hosts):
    parts = [f"Host(`{h}`)" for h in hosts if h]
    return " || ".join(parts)

def upsert_router(name, rule, service, priority=90):
    global text
    block = f"""    {name}:
      rule: {rule}
      entryPoints:
        - websecure
      service: {service}
      tls: {{}}
      priority: {priority}
"""
    pat = rf"    {re.escape(name)}:\n(?:      [^\n]+\n)*?(?=    [a-zA-Z0-9_.-]+:|  [a-z]+:)"
    if re.search(pat, text):
        text = re.sub(pat, block.strip() + "\n", text, count=1)
        print(f"  router atualizado: {name}")
    elif "  routers:" in text:
        text = text.replace("  routers:", "  routers:\n" + block, 1)
        print(f"  router criado: {name}")
    else:
        print(f"  ERRO: seção routers ausente ({name})")

def upsert_service(name, url):
    global text
    if not url:
        print(f"  service pulado (sem backend): {name}")
        return
    url = url.rstrip("/") + "/"
    block = f"""    {name}:
      loadBalancer:
        servers:
          - url: "{url}"
"""
    pat = rf'    {re.escape(name)}:\n(?:      [^\n]+\n)*?(?=    [a-zA-Z0-9_.-]+:|  [a-z]+:)'
    if re.search(pat, text):
        text = re.sub(pat, block.strip() + "\n", text, count=1)
        print(f"  service atualizado: {name} -> {url}")
    elif "  services:" in text:
        text = text.replace("  services:", "  services:\n" + block, 1)
        print(f"  service criado: {name} -> {url}")
    else:
        print(f"  ERRO: seção services ausente ({name})")

for item in landings:
    if not item["backend"]:
        print(f"AVISO: {item['swarm']} sem backend alcançável — router {item['router']} não criado")
        continue
    upsert_service(item["service"], item["backend"])
    upsert_router(item["router"], host_rule(item["hosts"]), item["service"])

open(path, "w", encoding="utf-8").write(text)
PY
}

reload_traefik() {
  local traefik
  traefik=$(traefik_cid)
  [[ -n "$traefik" ]] || { log "ERRO: Traefik não está running"; return 1; }
  docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  sleep 4
  log "Traefik recarregado (${traefik:0:12})"
}

wake_service() {
  local svc="$1"
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$svc" || {
    log "AVISO: Swarm ${svc} não existe"
    return 1
  }
  local replicas
  replicas=$(docker service ls --filter "name=^${svc}$" --format '{{.Replicas}}' 2>/dev/null | head -1)
  if [[ "${replicas:-}" == 0/* ]]; then
    log "Escalando ${svc}=1"
    timeout 120 docker service scale "${svc}=1" >>"$LOG" 2>&1 || true
    sleep 8
  fi
}

main() {
  mkdir -p "$(dirname "$LOG")"
  log "=== ${RESTORE_VERSION} início ==="

  ensure_bootstrap
  wake_service "waba_paginadevendas" || true
  wake_service "waba_bets_pv" || true

  patch_landings
  reload_traefik

  log "Validação (--resolve 127.0.0.1):"
  log "  wabadisparos.com.br → $(http_local wabadisparos.com.br /)"
  log "  bet.waba.info → $(http_local bet.waba.info /)"
  log "  paginadevendas easypanel → $(http_local waba-paginadevendas.achpyp.easypanel.host /)"
  log "  bets_pv easypanel → $(http_local waba-bets-pv.achpyp.easypanel.host /)"
  log "=== ${RESTORE_VERSION} fim ==="
}

main "$@"
