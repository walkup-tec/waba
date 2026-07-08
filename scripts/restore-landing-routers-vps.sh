#!/bin/bash
# Cria/atualiza routers Traefik para landings wabadisparos + bet.waba.
# Neste VPS o overlay Swarm é inalcançável pelo Traefik → publica porta no host (172.17.0.1).
#
# Uso (root no VPS):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" -o /root/restore-landing-routers-vps.sh
#   sed -i 's/\r$//' /root/restore-landing-routers-vps.sh
#   chmod +x /root/restore-landing-routers-vps.sh
#   /root/restore-landing-routers-vps.sh
#
# Versão: restore-landing-routers-2026-07-08-v2
set -euo pipefail

RESTORE_VERSION="restore-landing-routers-2026-07-08-v2"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
CUSTOM_CFG="${CFG_DIR}/custom.yaml"
LOG="${RESTORE_LANDING_LOG:-/var/log/restore-landing-routers.log}"
BOOTSTRAP="/root/traefik-easypanel-bootstrap-vps.sh"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

PV_SWARM="waba_paginadevendas"
BETS_SWARM="waba_bets_pv"
PV_HOST_PORT="${LANDING_PV_HOST_PORT:-30200}"
BETS_HOST_PORT="${LANDING_BETS_HOST_PORT:-30201}"
HOST_GW="${TRAEFIK_HOST_GW:-172.17.0.1}"

log() {
  echo "[$(date -Is)] $*" | tee -a "$LOG"
}

traefik_cid() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
}

wait_for_traefik() {
  local i traefik
  for i in $(seq 1 24); do
    traefik=$(traefik_cid)
    if [[ -n "$traefik" ]] && ss -tlnp 2>/dev/null | grep -q ':443 '; then
      echo "$traefik"
      return 0
    fi
    sleep 2
  done
  return 1
}

http_local() {
  local host="$1" path="${2:-/}"
  curl -sS -o /dev/null -w "%{http_code}" --resolve "${host}:443:127.0.0.1" --max-time 15 \
    "https://${host}${path}" 2>/dev/null || echo "000"
}

host_http_ok() {
  local url="$1"
  curl -sf -m 5 -o /dev/null "$url" 2>/dev/null
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
  else
    log "AVISO: bootstrap Traefik ausente"
  fi
}

ensure_traefik_networks() {
  local traefik net
  traefik=$(traefik_cid || true)
  [[ -n "${traefik:-}" ]] || return 0
  for net in $(docker network ls --format '{{.Name}}' | grep -E 'easypanel|waba'); do
    docker network connect "$net" "$traefik" 2>/dev/null || true
  done
}

service_replicas_ok() {
  local svc="$1"
  local replicas
  replicas=$(docker service ls --filter "name=^${svc}$" --format '{{.Replicas}}' 2>/dev/null | head -1)
  [[ "${replicas:-}" =~ ^[1-9][0-9]*/[1-9] ]]
}

service_target_port() {
  local swarm="$1"
  local cid port
  cid=$(docker ps -q -f "name=${swarm}" -f status=running | head -1)
  if [[ -n "$cid" ]]; then
    port=$(docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^PORT=' | head -1 | cut -d= -f2- | tr -d '\r' || true)
    [[ -n "$port" && "$port" =~ ^[0-9]+$ ]] && { echo "$port"; return 0; }
  fi
  echo "80"
}

ensure_host_publish() {
  local swarm="$1" default_port="$2"
  local target published
  target=$(service_target_port "$swarm")
  published=$(docker service inspect "$swarm" --format \
    "{{range .Endpoint.Ports}}{{if eq .TargetPort ${target}}}{{.PublishedPort}}{{end}}{{end}}" 2>/dev/null || true)
  if [[ -n "${published:-}" && "$published" =~ ^[0-9]+$ ]]; then
    echo "$published"
    return 0
  fi
  log "Publicando ${swarm} → host:${default_port} target:${target}"
  timeout 120 docker service update \
    --publish-add "mode=host,published=${default_port},target=${target},protocol=tcp" \
    "$swarm" >>"$LOG" 2>&1 || true
  sleep 10
  echo "$default_port"
}

extract_backend_from_yaml() {
  local needle="$1"
  python3 - "$CFG_DIR" "$needle" <<'PY'
import re, sys, pathlib
cfg_dir, needle = sys.argv[1:3]
for path in sorted(pathlib.Path(cfg_dir).glob("*.yaml")):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        continue
    if needle not in text:
        continue
    for m in re.finditer(
        rf'"{re.escape(needle)}[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*"([^"]+)"',
        text,
        re.I,
    ):
        print(m.group(1).rstrip("/") + "/")
        sys.exit(0)
    for m in re.finditer(
        rf'[\s\S]{{0,400}}{re.escape(needle)}[\s\S]{{0,400}}?"url"\s*:\s*"([^"]+)"',
        text,
        re.I,
    ):
        print(m.group(1).rstrip("/") + "/")
        sys.exit(0)
PY
}

discover_backend() {
  local swarm="$1" default_host_port="$2"
  local url target_port published traefik

  url=$(extract_backend_from_yaml "$swarm" 2>/dev/null || true)
  if [[ -n "${url:-}" ]] && host_http_ok "${url%/}/"; then
    log "  ${swarm}: yaml ${url}"
    echo "$url"
    return 0
  fi

  target_port=$(service_target_port "$swarm")
  published=$(ensure_host_publish "$swarm" "$default_host_port")
  url="http://${HOST_GW}:${published}/"
  if host_http_ok "$url"; then
    log "  ${swarm}: host gateway ${url}"
    echo "$url"
    return 0
  fi

  traefik=$(traefik_cid || true)
  if [[ -n "${traefik:-}" ]]; then
    for probe in \
      "http://tasks.${swarm}:${target_port}/" \
      "http://${swarm}:${target_port}/" \
      "http://tasks.${swarm}:80/" \
      "http://tasks.${swarm}:3000/"; do
      if docker exec "$traefik" wget -q --spider --timeout=4 "$probe" 2>/dev/null; then
        log "  ${swarm}: overlay ${probe}"
        echo "$probe"
        return 0
      fi
    done
  fi

  if service_replicas_ok "$swarm"; then
    log "  ${swarm}: fallback ${url} (réplicas OK, probe falhou)"
    echo "$url"
    return 0
  fi

  echo ""
  return 1
}

patch_main_yaml() {
  local pv_url="$1" bets_url="$2"
  [[ -f "$CFG" ]] || { log "ERRO: ${CFG} não existe"; return 1; }
  cp -a "$CFG" "${CFG}.bak-restore-landing-$(date +%Y%m%d-%H%M%S)"

  python3 - "$CFG" "${pv_url:-}" "${bets_url:-}" <<'PY'
import re, sys
path, pv_url, bets_url = sys.argv[1:4]
text = open(path, encoding="utf-8").read()

injections = [
    ("wabadisparos.com.br", ["paginadevendas", "waba-paginadevendas", "wabadisparos"]),
    ("bet.waba.info", ["bets-pv", "bets_pv", "bet.waba"]),
]

lines = text.splitlines(keepends=True)
for public_host, needles in injections:
    if f"Host(`{public_host}`)" in text:
        print(f"  regra já tem {public_host}")
        continue
    injected = False
    for i, line in enumerate(lines):
        if "rule:" not in line:
            continue
        if not any(n.lower() in line.lower() for n in needles):
            continue
        if f"Host(`{public_host}`)" in line:
            injected = True
            break
        lines[i] = line.rstrip("\n\r") + f" || Host(`{public_host}`)\n"
        print(f"  OR {public_host} na linha {i + 1}")
        injected = True
        break
    if not injected:
        print(f"  sem regra easypanel para injetar {public_host}")

text = "".join(lines)

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
    return " || ".join(f"Host(`{h}`)" for h in hosts if h)

def upsert_router(name, rule, service, priority=120):
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
        print(f"  service pulado: {name}")
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
        print(f"AVISO: {item['swarm']} sem backend — pulando {item['router']}")
        continue
    upsert_service(item["service"], item["backend"])
    upsert_router(item["router"], host_rule(item["hosts"]), item["service"])

open(path, "w", encoding="utf-8").write(text)
PY
}

reload_traefik() {
  local traefik i
  for i in $(seq 1 15); do
    traefik=$(traefik_cid || true)
    [[ -n "${traefik:-}" ]] && break
    sleep 2
  done
  [[ -n "${traefik:-}" ]] || { log "ERRO: Traefik não running após espera"; return 1; }
  docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  sleep 5
  log "Traefik recarregado (${traefik:0:12})"
}

wake_service() {
  local svc="$1"
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$svc" || {
    log "AVISO: Swarm ${svc} não existe — criar no Easypanel"
    return 1
  }
  local replicas
  replicas=$(docker service ls --filter "name=^${svc}$" --format '{{.Replicas}}' 2>/dev/null | head -1)
  log "Swarm ${svc} replicas=${replicas:-?}"
  if [[ "${replicas:-}" == 0/* ]]; then
    timeout 120 docker service scale "${svc}=1" >>"$LOG" 2>&1 || true
    sleep 10
  fi
}

main() {
  mkdir -p "$(dirname "$LOG")"
  log "=== ${RESTORE_VERSION} início ==="

  ensure_bootstrap
  wait_for_traefik >/dev/null || log "AVISO: Traefik lento — continuando"
  ensure_traefik_networks

  wake_service "$PV_SWARM" || true
  wake_service "$BETS_SWARM" || true

  local pv_url bets_url
  pv_url=$(discover_backend "$PV_SWARM" "$PV_HOST_PORT" || true)
  bets_url=$(discover_backend "$BETS_SWARM" "$BETS_HOST_PORT" || true)
  log "backend paginadevendas=${pv_url:-AUSENTE}"
  log "backend bets_pv=${bets_url:-AUSENTE}"

  patch_main_yaml "${pv_url:-}" "${bets_url:-}"
  reload_traefik || true

  log "Validação (--resolve 127.0.0.1):"
  log "  wabadisparos.com.br → $(http_local wabadisparos.com.br /)"
  log "  bet.waba.info → $(http_local bet.waba.info /)"
  log "  paginadevendas easypanel → $(http_local waba-paginadevendas.achpyp.easypanel.host /)"
  log "  bets_pv easypanel → $(http_local waba-bets-pv.achpyp.easypanel.host /)"
  log "=== ${RESTORE_VERSION} fim ==="
}

main "$@"
