#!/bin/bash
# Traefik + Easypanel + Swarm — projeto WABA (waba/waba_disparador).
# Independente do script do Typebot (typebot-Saas).
#
# Instalação única no VPS:
#   cp scripts/traefik-permanent-waba-vps.sh /root/
#   chmod +x /root/traefik-permanent-waba-vps.sh
#   /root/traefik-permanent-waba-vps.sh install
#
# Repositório: https://github.com/walkup-tec/waba
# Versão (validar após curl): waba-traefik-2026-06-20-v6
set -euo pipefail

WABA_SCRIPT_VERSION="waba-traefik-2026-07-08-v7"
TRAEFIK_BOOTSTRAP_SCRIPT="/root/traefik-easypanel-bootstrap-vps.sh"

INSTALL_PATH="/root/traefik-permanent-waba-vps.sh"
CRON_FILE="/etc/cron.d/traefik-permanent-waba-fix"
LOG="/var/log/traefik-permanent-waba-fix.log"
LOCK_FILE="/var/run/traefik-permanent-waba-fix.lock"
CFG=/etc/easypanel/traefik/config/main.yaml

# Easypanel: projeto waba, serviço waba_disparador → Swarm waba_waba_disparador
WABA_NET="${WABA_NET:-easypanel-waba}"
WABA_CONTAINER_FILTER="${WABA_CONTAINER_FILTER:-waba_disparador}"
WABA_SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
WABA_PORT="${WABA_PORT:-3000}"
WABA_PUBLIC_HOST="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
WABA_EASYPANEL_HOST="${WABA_EASYPANEL_HOST:-}"
# Porta publicada no host (Swarm publish). Neste VPS overlay é inalcançável → 172.17.0.1:PORTA.
WABA_HOST_PUBLISHED_PORT="${WABA_HOST_PUBLISHED_PORT:-30180}"

WATCH_SERVICE="traefik-permanent-waba-watch.service"
TIMER_SERVICE="traefik-permanent-waba-fix.timer"
WATCH_UNIT_PATH="/etc/systemd/system/${WATCH_SERVICE}"
TIMER_UNIT_PATH="/etc/systemd/system/${TIMER_SERVICE}"
TIMER_SERVICE_UNIT="/etc/systemd/system/traefik-permanent-waba-fix.service"

script_path() {
  if [[ -n "${1:-}" && -x "${1}" ]]; then
    echo "${1}"
    return
  fi
  if [[ -x "${INSTALL_PATH}" ]]; then
    echo "${INSTALL_PATH}"
    return
  fi
  readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}"
}

is_landing_service() {
  case "${WABA_SWARM_SERVICE:-}${WABA_PUBLIC_HOST:-}${WABA_CONTAINER_FILTER:-}" in
    *paginadevendas*|*bets_pv*|*wabadisparos*|*bet.waba*)
      return 0
      ;;
  esac
  return 1
}

traefik_container() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
}

load_traefik_bootstrap() {
  [[ -f "$TRAEFIK_BOOTSTRAP_SCRIPT" ]] || return 0
  TRAEFIK_BOOTSTRAP_LOG="$LOG"
  # shellcheck disable=SC1090
  source "$TRAEFIK_BOOTSTRAP_SCRIPT"
  traefik_bootstrap_ensure_traefik || true
}

traefik_swarm_service() {
  local cid svc
  cid=$(traefik_container)
  [[ -z "$cid" ]] && return 1
  svc=$(docker inspect "$cid" --format '{{index .Config.Labels "com.docker.swarm.service.name"}}' 2>/dev/null || true)
  [[ -n "$svc" && "$svc" != "<no value>" ]] && echo "$svc" && return 0
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -iE 'traefik' | head -1
}

resolve_overlay_network() {
  if docker network ls --format '{{.Name}}' | grep -qx "$WABA_NET"; then
    echo "$WABA_NET"
    return 0
  fi
  local alt
  alt=$(docker network ls --format '{{.Name}}' | grep -E '^easypanel-waba$|^easypanel$' | head -1)
  [[ -n "$alt" ]] && echo "$alt" && return 0
  echo "$WABA_NET"
}

container_ip() {
  local filter="$1"
  local network="${2:-$(resolve_overlay_network)}"
  local cid
  cid=$(
    docker ps -q -f "name=${filter}" -f status=running \
      | xargs -r docker inspect --format '{{.Created}} {{.Id}}' 2>/dev/null \
      | sort -r \
      | head -1 \
      | awk '{print $2}'
  )
  [[ -z "$cid" ]] && cid=$(docker ps -q -f "name=${filter}" -f status=running | head -1)
  [[ -z "$cid" ]] && return 1
  docker inspect "$cid" --format "{{index .NetworkSettings.Networks \"${network}\" \"IPAddress\"}}"
}

resolve_waba_cid() {
  local cid f
  for f in "$WABA_CONTAINER_FILTER" "$WABA_SWARM_SERVICE" "waba_waba-disparador" "waba_disparador"; do
    cid=$(docker ps -q -f "name=${f}" -f status=running | head -1)
    [[ -n "$cid" ]] && echo "$cid" && return 0
  done
  return 1
}

resolve_waba_ip() {
  local ip net
  for f in "$WABA_CONTAINER_FILTER" "$WABA_SWARM_SERVICE" "waba_waba-disparador" "waba_disparador"; do
    for net in "$(resolve_overlay_network)" easypanel-waba easypanel; do
      ip=$(container_ip "$f" "$net" 2>/dev/null || true)
      [[ -n "${ip:-}" ]] && echo "$ip" && return 0
    done
  done
  return 1
}

# Easypanel costuma publicar PORT=80 no serviço; Dockerfile usa 3000. Detecta a porta real.
resolve_waba_port() {
  local cid port traefik ip p probe_path
  cid=$(resolve_waba_cid || true)
  if is_landing_service; then
    probe_path="/"
  else
    probe_path="/health"
  fi
  if [[ -n "$cid" ]]; then
    port=$(docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^PORT=' | head -1 | cut -d= -f2- | tr -d '\r')
    if [[ -n "$port" && "$port" =~ ^[0-9]+$ ]]; then
      echo "$port"
      return 0
    fi
  fi
  traefik=$(traefik_container)
  ip=$(resolve_waba_ip || true)
  if [[ -n "$traefik" && -n "$ip" ]]; then
    for p in 80 3000; do
      if is_landing_service; then
        docker exec "$traefik" wget -q --spider --timeout=3 "http://${ip}:${p}${probe_path}" 2>/dev/null && {
          echo "$p"
          return 0
        }
      elif docker exec "$traefik" wget -qO- --timeout=3 "http://${ip}:${p}${probe_path}" 2>/dev/null \
        | grep -q '"ok"'; then
        echo "$p"
        return 0
      fi
    done
  fi
  if [[ -n "$cid" ]]; then
    for p in 80 3000; do
      if is_landing_service; then
        docker exec "$cid" wget -q --spider --timeout=3 "http://127.0.0.1:${p}${probe_path}" 2>/dev/null && {
          echo "$p"
          return 0
        }
      elif docker exec "$cid" wget -qO- --timeout=3 "http://127.0.0.1:${p}${probe_path}" 2>/dev/null \
        | grep -q '"ok"'; then
        echo "$p"
        return 0
      fi
    done
  fi
  if is_landing_service; then
    echo "${WABA_PORT:-3000}"
    return 0
  fi
  echo "${WABA_PORT:-3000}"
}

resolve_waba_host_published_port() {
  local published target_port
  target_port=$(resolve_waba_port)
  published=$(docker service inspect "$WABA_SWARM_SERVICE" --format \
    "{{range .Endpoint.Ports}}{{if eq .TargetPort ${target_port}}}{{.PublishedPort}}{{end}}{{end}}" 2>/dev/null || true)
  if [[ -n "$published" && "$published" =~ ^[0-9]+$ ]]; then
    echo "$published"
    return 0
  fi
  if [[ -n "${WABA_HOST_PUBLISHED_PORT:-}" && "${WABA_HOST_PUBLISHED_PORT}" =~ ^[0-9]+$ ]]; then
    echo "$WABA_HOST_PUBLISHED_PORT"
    return 0
  fi
  return 1
}

# Descobre URL que o Traefik consegue alcançar (neste VPS: host gateway, não overlay).
resolve_waba_backend_url() {
  local traefik port host_port candidate
  if [[ -n "${WABA_BACKEND_URL:-}" ]]; then
    echo "${WABA_BACKEND_URL%/}/"
    return 0
  fi
  traefik=$(traefik_container)
  port=$(resolve_waba_port)
  [[ -z "$traefik" ]] && return 1

  traefik_health_ok() {
    if is_landing_service; then
      # Landing pode responder 404 no / (ex.: bets_pv TanStack) — conta como vivo se HTTP responder.
      local probe="${1%/health}/"
      docker exec "$traefik" wget -S --spider --timeout=4 "$probe" 2>&1 \
        | grep -qE 'HTTP/[0-9.]+ [0-9]{3}'
      return $?
    fi
    docker exec "$traefik" wget -qO- --timeout=4 "$1" 2>/dev/null | grep -q '"ok"'
  }

  host_port=$(resolve_waba_host_published_port || true)
  if [[ -n "${host_port:-}" ]]; then
    candidate="http://172.17.0.1:${host_port}/health"
    if traefik_health_ok "$candidate"; then
      echo "http://172.17.0.1:${host_port}/"
      echo "  backend via host gateway 172.17.0.1:${host_port}" >&2
      return 0
    fi
  fi

  for candidate in \
    "http://tasks.${WABA_SWARM_SERVICE}:${port}/health" \
    "http://${WABA_SWARM_SERVICE}:${port}/health"; do
    if traefik_health_ok "$candidate"; then
      echo "${candidate%/health}/"
      return 0
    fi
  done

  echo "http://172.17.0.1:${WABA_HOST_PUBLISHED_PORT}/"
  echo "  backend fallback fixo 172.17.0.1:${WABA_HOST_PUBLISHED_PORT}" >&2
  return 0
}

ensure_traefik_on_overlay() {
  local traefik svc net_id on_net update_out resolved_net
  traefik=$(traefik_container)
  [[ -z "$traefik" ]] && { echo "ERRO: Traefik container ausente"; return 1; }

  for net in $(docker network ls --format '{{.Name}}' | grep -E 'easypanel|waba'); do
    docker network connect "$net" "$traefik" 2>/dev/null || true
  done

  resolved_net=$(resolve_overlay_network)
  svc=$(traefik_swarm_service || true)
  if [[ -n "${svc:-}" ]]; then
    net_id=$(docker network ls -q -f name="^${resolved_net}$" | head -1)
    on_net=0
    if [[ -n "$net_id" ]]; then
      docker service inspect "$svc" --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}}{{println}}{{end}}' 2>/dev/null \
        | grep -qx "$net_id" && on_net=1
    fi
    if [[ "$on_net" -eq 1 ]]; then
      echo "Swarm: Traefik já na rede ${resolved_net}"
    else
      echo "Swarm: adicionando rede ${resolved_net} ao Traefik (${svc})"
      update_out=$(timeout 45 docker service update --network-add "$resolved_net" "$svc" 2>&1) || true
      if grep -qiE 'already attached|is already attached' <<<"$update_out"; then
        echo "Swarm: rede ${resolved_net} já estava no Traefik"
      elif [[ -n "$update_out" ]]; then
        echo "$update_out"
      fi
    fi
  fi
}

find_backup_with_host() {
  local host="$1"
  local f golden="/etc/easypanel/traefik/config/main.yaml.golden-traefik-all"
  if [[ -f "$golden" ]] && grep -q "Host(\`${host}\`)" "$golden" 2>/dev/null; then
    echo "$golden"
    return 0
  fi
  for f in $(ls -t /etc/easypanel/traefik/config/main.yaml.bak* 2>/dev/null); do
    if grep -q "Host(\`${host}\`)" "$f" 2>/dev/null; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

reload_traefik_config() {
  local traefik
  traefik=$(traefik_container)
  [[ -z "$traefik" ]] && return 1
  docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  sleep 2
}

ensure_waba_public_router() {
  [[ -f "$CFG" ]] || return 1
  if grep -q "Host(\`${WABA_PUBLIC_HOST}\`)" "$CFG" 2>/dev/null; then
    return 0
  fi
  local bak
  bak=$(find_backup_with_host "$WABA_PUBLIC_HOST" || true)
  if [[ -n "$bak" ]]; then
    echo "ALERTA: router ${WABA_PUBLIC_HOST} removido — restaurando de ${bak}"
    cp -a "$CFG" "${CFG}.bak-before-auto-waba-restore-$(date +%Y%m%d-%H%M%S)"
    cp -a "$bak" "$CFG"
    reload_traefik_config || true
    return 0
  fi

  if [[ -z "${WABA_EASYPANEL_HOST:-}" ]]; then
    echo "ERRO: router ${WABA_PUBLIC_HOST} ausente e sem backup nem WABA_EASYPANEL_HOST"
    return 1
  fi

  echo "ALERTA: router ${WABA_PUBLIC_HOST} ausente — injetando a partir de ${WABA_EASYPANEL_HOST}"
  cp -a "$CFG" "${CFG}.bak-before-public-host-clone-$(date +%Y%m%d-%H%M%S)"

  python3 - "$CFG" "$WABA_PUBLIC_HOST" "$WABA_EASYPANEL_HOST" "$WABA_SWARM_SERVICE" <<'PY'
import re, sys
path, public_host, easypanel_host, swarm = sys.argv[1:5]
text = open(path, encoding="utf-8").read()

if f"Host(`{public_host}`)" in text:
    print("  router public já presente")
    sys.exit(0)

lines = text.splitlines(keepends=True)
for i, line in enumerate(lines):
    if "rule:" in line and easypanel_host in line:
        if f"Host(`{public_host}`)" in line:
            print("  regra easypanel já inclui domínio public")
            sys.exit(0)
        lines[i] = line.rstrip("\n\r") + f" || Host(`{public_host}`)\n"
        open(path, "w", encoding="utf-8").write("".join(lines))
        print(f"  OR Host(`{public_host}`) adicionado à regra easypanel (linha {i + 1})")
        sys.exit(0)

router_pat = rf"(    [^\n]+:\n(?:      [^\n]+\n)+?      rule: [^\n]*{re.escape(easypanel_host)}[^\n]*\n(?:      [^\n]+\n)+?      service: )([^\n]+)"
match = re.search(router_pat, text)
if not match:
    print(f"  ERRO: nenhum router com host {easypanel_host}")
    sys.exit(1)

service = match.group(2).strip()
router_name = "waba-public-" + re.sub(r"[^a-z0-9]+", "-", public_host.lower()).strip("-")[:50]
new_block = f"""    {router_name}:
      rule: Host(`{public_host}`)
      entryPoints:
        - https
      service: {service}
      tls: {{}}
"""
if "  routers:" not in text:
    print("  ERRO: seção routers ausente em main.yaml")
    sys.exit(1)

text = text.replace("  routers:", "  routers:\n" + new_block, 1)
open(path, "w", encoding="utf-8").write(text)
print(f"  router {router_name} criado -> service {service}")
PY

  if grep -q "Host(\`${WABA_PUBLIC_HOST}\`)" "$CFG" 2>/dev/null; then
    reload_traefik_config || true
    return 0
  fi

  echo "ERRO: não foi possível injetar router ${WABA_PUBLIC_HOST}"
  return 1
}

patch_main_yaml() {
  local waba_ip resolved_net waba_port backend_url
  waba_ip=$(resolve_waba_ip || true)
  waba_port=$(resolve_waba_port)
  backend_url=$(resolve_waba_backend_url || true)
  resolved_net=$(resolve_overlay_network)

  [[ -z "$waba_ip" ]] && echo "AVISO: container ${WABA_CONTAINER_FILTER} sem IP overlay — usando host gateway"

  [[ -z "$backend_url" ]] && backend_url="http://172.17.0.1:${WABA_HOST_PUBLISHED_PORT}/"

  [[ -f "$CFG" ]] || { echo "ERRO: ${CFG} não existe"; return 1; }

  local before after
  before=$(mktemp)
  after=$(mktemp)
  cp "$CFG" "$before"

  echo "  backend Traefik: ${backend_url} (porta app=${waba_port}, overlay IP=${waba_ip})"

  python3 - "$CFG" "$backend_url" "$WABA_SWARM_SERVICE" "$WABA_PUBLIC_HOST" "${WABA_EASYPANEL_HOST:-}" <<'PY'
import re, sys
path, backend_url, swarm_name, public_host, easypanel_host = sys.argv[1:6]
text = open(path, encoding="utf-8").read()
backend_url = (backend_url or "").rstrip("/") + "/"
swarm_name = swarm_name or "waba_waba_disparador"
public_host = public_host or "waba.draxsistemas.com.br"

is_paginadevendas = "paginadevendas" in swarm_name or "wabadisparos" in (public_host or "")
is_bets_pv = "bets_pv" in swarm_name or "bet.waba" in (public_host or "")
is_disparador = not is_paginadevendas and not is_bets_pv

service_keys = [
    f"{swarm_name}-0",
    f"{swarm_name}-1",
    f"{swarm_name.replace('_', '-')}-0",
    f"{swarm_name.replace('_', '-')}-1",
    swarm_name,
]
if is_disparador:
    service_keys.extend([
        "waba_waba-disparador-0",
        "waba_waba_disparador-0",
        "waba_waba_disparador",
        "waba_disparador-0",
        "waba_disparador",
    ])

def fix_service(name: str, url: str) -> int:
    global text
    if not url or not name:
        return 0
    pat = rf'("{re.escape(name)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf'\g<1>{url}\2', text, count=1)
    if n:
        print(f"  service {name} -> {url}")
    return n

for key in service_keys:
    fix_service(key, backend_url)

# Só altera blocos do próprio serviço — NUNCA patch em massa em paginadevendas/bets ao rodar disparador
block_pats = []
if is_disparador:
    block_pats.append(
        rf'("waba[^"]*disparador[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")http://[^"]+(")'
    )
if is_paginadevendas:
    block_pats.append(
        rf'("[^"]*paginadevendas[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")http://[^"]+(")'
    )
if is_bets_pv:
    block_pats.append(
        rf'("[^"]*bets[_-]?pv[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")http://[^"]+(")'
    )
for block_pat in block_pats:
    text, n_blk = re.subn(block_pat, rf'\g<1>{backend_url}\2', text, flags=re.I)
    if n_blk:
        print(f"  blocos Traefik -> {backend_url} ({n_blk}x)")

host_aliases = [swarm_name]
if is_disparador:
    host_aliases.extend([
        "waba_waba_disparador",
        "waba_waba-disparador",
        "waba_disparador",
        "waba-disparador",
    ])
if is_paginadevendas:
    host_aliases.extend([
        "waba_paginadevendas",
        "typebot_paginadevendas",
        "paginadevendas",
    ])
if is_bets_pv:
    host_aliases.extend([
        "waba_bets_pv",
        "bets_pv",
    ])
for host in host_aliases:
    for prefix in ("", "tasks."):
        for wrong_port in ("3000", "80"):
            old = f"http://{prefix}{host}:{wrong_port}"
            if old in text and old + "/" != backend_url.rstrip("/") and not backend_url.startswith(old):
                text = text.replace(old + "/", backend_url)
                text = text.replace(old, backend_url.rstrip("/"))
                print(f"  replace {old}* -> {backend_url}")

# Não usar fix_host_windows: contamina backends entre serviços (ex. disparador → 30210).

open(path, "w", encoding="utf-8").write(text)
PY

  cp "$CFG" "$after"
  if ! cmp -s "$before" "$after"; then
    cp -a "$CFG" "${CFG}.bak-waba-$(date +%Y%m%d-%H%M%S)"
    echo "main.yaml atualizado (WABA)"
    local traefik
    traefik=$(traefik_container)
    if [[ -n "$traefik" ]]; then
      docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
      sleep 2
      ensure_traefik_on_overlay
    fi
  fi
  rm -f "$before" "$after"
  echo "WABA backend: ${backend_url} (overlay ${waba_ip}:${waba_port}, rede ${resolved_net})"
}

http_code() {
  local host="$1" path="${2:-/}"
  curl -sS -o /dev/null -w "%{http_code}" --resolve "${host}:443:127.0.0.1" --max-time 12 \
    "https://${host}${path}" 2>/dev/null || echo "000"
}

waba_health_from_traefik() {
  local traefik code backend_url
  backend_url=$(resolve_waba_backend_url || true)
  traefik=$(traefik_container)
  [[ -z "$backend_url" || -z "$traefik" ]] && return 1
  code=$(docker exec "$traefik" wget -qO- --timeout=5 "${backend_url}health" 2>/dev/null || true)
  grep -q '"ok"[[:space:]]*:[[:space:]]*true' <<<"$code" && return 0
  return 1
}

run_fix() {
  local detected_port detected_backend
  load_traefik_bootstrap
  ensure_waba_public_router || true
  detected_port=$(resolve_waba_port)
  detected_backend=$(resolve_waba_backend_url || echo "?")
  echo "=== traefik-permanent-waba ${WABA_SCRIPT_VERSION} $(date -Is) porta=${detected_port} backend=${detected_backend} ==="
  ensure_traefik_on_overlay
  patch_main_yaml || true

  local public health ep
  public=$(http_code "$WABA_PUBLIC_HOST")
  health=$(http_code "$WABA_PUBLIC_HOST" "/health")

  if [[ "$public" == "502" || "$public" == "000" || "$health" == "502" || "$health" == "000" ]]; then
    if waba_health_from_traefik; then
      echo "ALERTA: app OK na rede Docker, HTTPS ${public}/${health} — re-patch Traefik"
      patch_main_yaml || true
      public=$(http_code "$WABA_PUBLIC_HOST")
      health=$(http_code "$WABA_PUBLIC_HOST" "/health")
    fi
  fi

  if [[ "$public" == "502" || "$public" == "000" ]]; then
    local traefik
    traefik=$(traefik_container)
    if [[ -n "$traefik" ]]; then
      echo "waba=${public} health=${health} — restart Traefik (último recurso WABA)"
      docker restart "$traefik" >/dev/null
      sleep 12
      ensure_traefik_on_overlay
      patch_main_yaml || true
      public=$(http_code "$WABA_PUBLIC_HOST")
      health=$(http_code "$WABA_PUBLIC_HOST" "/health")
    fi
  fi

  if [[ -n "$WABA_EASYPANEL_HOST" ]]; then
    if is_landing_service; then
      ep=$(http_code "$WABA_EASYPANEL_HOST" "/")
    else
      ep=$(http_code "$WABA_EASYPANEL_HOST" "/health")
    fi
    echo "RESULTADO waba:${public} health:${health} easypanel_host:${ep}"
  else
    echo "RESULTADO waba:${public} health:${health}"
  fi

  if is_landing_service; then
    [[ "$public" =~ ^(200|301|302|304)$ ]]
  else
    [[ "$health" == "200" || "$public" == "200" ]]
  fi
}

should_patch_for_name() {
  local name="$1"
  case "$name" in
    *waba_disparador*|*waba-disparador*|*waba_waba*|waba_*)
      return 0
      ;;
    *paginadevendas*|*bets_pv*)
      return 0
      ;;
    *traefik*|*easypanel*)
      return 0
      ;;
  esac
  return 1
}

run_fix_locked() {
  local runner
  runner=$(script_path)
  mkdir -p "$(dirname "$LOCK_FILE")"
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK_FILE" -c "\"${runner}\" run >> \"${LOG}\" 2>&1" || true
  else
    "${runner}" run >> "${LOG}" 2>&1 || true
  fi
}

schedule_patch() {
  local delay="${1:-2}"
  ( sleep "$delay"; run_fix_locked ) &
}

watch_deploy_events() {
  local runner
  runner=$(script_path)
  echo "=== traefik-permanent-waba watch runner=${runner} ==="
  docker events --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}}' | while read -r typ action name; do
    [[ -z "$name" ]] && continue
    local key="${typ}:${action}"
    case "$key" in
      container:start|container:die|container:kill|container:destroy)
        should_patch_for_name "$name" || continue
        schedule_patch 2
        ;;
      service:update)
        should_patch_for_name "$name" || continue
        schedule_patch 4
        ;;
    esac
    if [[ "$typ" == "container" && "$action" == health_status:* ]]; then
      should_patch_for_name "$name" && schedule_patch 2
    fi
  done
}

install_watch_service() {
  cat > "$WATCH_UNIT_PATH" <<EOF
[Unit]
Description=Traefik WABA (waba_disparador) — patch automático em redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=${INSTALL_PATH} watch
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$WATCH_SERVICE"
  echo "Systemd: ${WATCH_SERVICE} ativo"
}

install_timer_service() {
  # NÃO habilitar por padrão: timer 20s + bootstrap em paralelo = thrash Traefik 0/1.
  # Opt-in: WABA_ENABLE_FIX_TIMER=1
  cat > "$TIMER_SERVICE_UNIT" <<EOF
[Unit]
Description=Traefik WABA — patch periódico (backup)

[Service]
Type=oneshot
ExecStart=${INSTALL_PATH} run
EOF

  cat > "$TIMER_UNIT_PATH" <<EOF
[Unit]
Description=Traefik WABA — timer (opt-in; default off)

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  if [[ "${WABA_ENABLE_FIX_TIMER:-0}" == "1" ]]; then
    systemctl enable --now "$TIMER_SERVICE"
    echo "Systemd: ${TIMER_SERVICE} ativo (opt-in 15min)"
  else
    systemctl disable --now "$TIMER_SERVICE" 2>/dev/null || true
    echo "Systemd: ${TIMER_SERVICE} instalado mas OFF (use bootstrap/watchdog; WABA_ENABLE_FIX_TIMER=1 para ligar)"
  fi
}

install_permanent() {
  local src dest
  src=$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
  dest="$INSTALL_PATH"
  if [[ "$src" != "$dest" ]]; then
    cp "$src" "$dest"
    chmod +x "$dest"
  fi

  echo "Instalando fix WABA em ${dest} (Easypanel waba/waba_disparador)"

  # Cron a cada minuto + timers = thrash; não instalar. Remover residual.
  rm -f "$CRON_FILE" 2>/dev/null || true

  if command -v systemctl >/dev/null 2>&1; then
    install_watch_service || echo "AVISO: systemd watch falhou"
    install_timer_service || echo "AVISO: systemd timer falhou"
  else
    echo "AVISO: sem systemd — use cron apenas (até 60s de 502)"
  fi

  run_fix || true

  echo ""
  echo "=== Instalação WABA concluída ==="
  echo "  Script:  ${dest}"
  echo "  Domínio: ${WABA_PUBLIC_HOST}"
  echo "  Serviço: Easypanel waba/waba_disparador (Swarm ${WABA_SWARM_SERVICE})"
  echo "  Log:     ${LOG}"
  echo ""
  echo "Diagnóstico: ${dest} run"
  echo "Status:      ${dest} status"
}

show_status() {
  echo "=== traefik-permanent-waba status ==="
  for unit in "$WATCH_SERVICE" "$TIMER_SERVICE"; do
    if systemctl list-unit-files "$unit" &>/dev/null; then
      echo -n "  ${unit}: "
      systemctl is-active "$unit" 2>/dev/null || echo "inactive"
    else
      echo "  ${unit}: (não instalado — rode: $(script_path) install)"
    fi
  done
  [[ -f "$CRON_FILE" ]] && echo "  cron: ${CRON_FILE}" || echo "  cron: ausente"
  [[ -x "$INSTALL_PATH" ]] && echo "  script: ${INSTALL_PATH}" || echo "  script: ausente"
  echo "  host: ${WABA_PUBLIC_HOST}"
  echo "  swarm: ${WABA_SWARM_SERVICE}"
}

case "${1:-run}" in
  install) install_permanent ;;
  run) run_fix ;;
  watch) watch_deploy_events ;;
  status) show_status ;;
  *)
    echo "Uso: $0 install | run | watch | status"
    echo ""
    echo "Variáveis opcionais:"
    echo "  WABA_PUBLIC_HOST      (default: waba.draxsistemas.com.br)"
    echo "  WABA_SWARM_SERVICE    (default: waba_waba_disparador)"
    echo "  WABA_CONTAINER_FILTER (default: waba_disparador)"
    echo "  WABA_NET              (default: easypanel-waba)"
    echo "  WABA_EASYPANEL_HOST   (ex.: waba-waba-disparador.achpyp.easypanel.host)"
    exit 1
    ;;
esac
