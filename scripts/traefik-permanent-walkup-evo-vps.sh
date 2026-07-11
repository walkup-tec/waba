#!/bin/bash
# Traefik + Easypanel + Swarm — Evolution API (projeto walkup / evo-walkup-api).
# Mesmo padrão do Typebot (traefik-permanent-vps.sh) e do WABA (traefik-permanent-waba-vps.sh).
#
# Instalação única no VPS:
#   cp scripts/traefik-permanent-walkup-evo-vps.sh /root/
#   chmod +x /root/traefik-permanent-walkup-evo-vps.sh
#   /root/traefik-permanent-walkup-evo-vps.sh install
#
# Repositório: https://github.com/walkup-tec/waba
# Versão: walkup-evo-traefik-2026-06-20-v3
set -euo pipefail

EVO_SCRIPT_VERSION="walkup-evo-traefik-2026-06-20-v3"
TRAEFIK_BOOTSTRAP_SCRIPT="/root/traefik-easypanel-bootstrap-vps.sh"

INSTALL_PATH="/root/traefik-permanent-walkup-evo-vps.sh"
CRON_FILE="/etc/cron.d/traefik-permanent-walkup-evo-fix"
LOG="/var/log/traefik-permanent-walkup-evo-fix.log"
LOCK_FILE="/var/run/traefik-permanent-walkup-evo-fix.lock"
CFG=/etc/easypanel/traefik/config/main.yaml

# Easypanel: projeto walkup, serviço evo-walkup-api → Swarm walkup_evo-walkup-api
EVO_NET="${EVO_NET:-easypanel-walkup}"
EVO_CONTAINER_FILTER="${EVO_CONTAINER_FILTER:-evo-walkup-api}"
EVO_SWARM_SERVICE="${EVO_SWARM_SERVICE:-walkup_evo-walkup-api}"
EVO_PORT="${EVO_PORT:-8080}"
EVO_PUBLIC_HOST="${EVO_PUBLIC_HOST:-walkup-evo-walkup-api.achpyp.easypanel.host}"
EVO_API_KEY="${EVO_API_KEY:-429683C4C977415CAAFCCE10F7D57E11}"
# Porta publicada no host (overlay inalcançável → 172.17.0.1:PORTA).
EVO_HOST_PUBLISHED_PORT="${EVO_HOST_PUBLISHED_PORT:-30181}"

WATCH_SERVICE="traefik-permanent-walkup-evo-watch.service"
TIMER_SERVICE="traefik-permanent-walkup-evo-fix.timer"
WATCH_UNIT_PATH="/etc/systemd/system/${WATCH_SERVICE}"
TIMER_UNIT_PATH="/etc/systemd/system/${TIMER_SERVICE}"
TIMER_SERVICE_UNIT="/etc/systemd/system/traefik-permanent-walkup-evo-fix.service"

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
  if docker network ls --format '{{.Name}}' | grep -qx "$EVO_NET"; then
    echo "$EVO_NET"
    return 0
  fi
  local alt
  alt=$(docker network ls --format '{{.Name}}' | grep -E '^easypanel-walkup$|^easypanel$' | head -1)
  [[ -n "$alt" ]] && echo "$alt" && return 0
  echo "$EVO_NET"
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

resolve_evo_cid() {
  local cid f
  for f in "$EVO_CONTAINER_FILTER" "$EVO_SWARM_SERVICE" "walkup-evo-walkup-api" "evo-walkup-api"; do
    cid=$(docker ps -q -f "name=${f}" -f status=running | head -1)
    [[ -n "$cid" ]] && echo "$cid" && return 0
  done
  return 1
}

resolve_evo_ip() {
  local ip net f
  for f in "$EVO_CONTAINER_FILTER" "$EVO_SWARM_SERVICE" "walkup-evo-walkup-api" "evo-walkup-api"; do
    for net in "$(resolve_overlay_network)" easypanel-walkup easypanel; do
      ip=$(container_ip "$f" "$net" 2>/dev/null || true)
      [[ -n "${ip:-}" ]] && echo "$ip" && return 0
    done
  done
  return 1
}

resolve_evo_port() {
  local cid port traefik ip p
  cid=$(resolve_evo_cid || true)
  if [[ -n "$cid" ]]; then
    port=$(docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^SERVER_PORT=' | head -1 | cut -d= -f2- | tr -d '\r')
    if [[ -n "$port" && "$port" =~ ^[0-9]+$ ]]; then
      echo "$port"
      return 0
    fi
  fi
  traefik=$(traefik_container)
  ip=$(resolve_evo_ip || true)
  if [[ -n "$traefik" && -n "$ip" ]]; then
    for p in 8080 80; do
      if evo_probe_url "$traefik" "http://${ip}:${p}/instance/fetchInstances"; then
        echo "$p"
        return 0
      fi
    done
  fi
  if [[ -n "$cid" ]]; then
    for p in 8080 80; do
      if docker exec "$cid" wget -qO- --timeout=3 --header="apikey: ${EVO_API_KEY}" \
        "http://127.0.0.1:${p}/instance/fetchInstances" 2>/dev/null | grep -qE 'connectionStatus|"name"'; then
        echo "$p"
        return 0
      fi
    done
  fi
  echo "${EVO_PORT:-8080}"
}

evo_probe_url() {
  local traefik="$1"
  local url="$2"
  docker exec "$traefik" wget -qO- --timeout=4 --header="apikey: ${EVO_API_KEY}" "$url" 2>/dev/null \
    | grep -qE 'connectionStatus|"name"|fetchInstances'
}

resolve_evo_host_published_port() {
  local published target_port
  target_port=$(resolve_evo_port)
  published=$(docker service inspect "$EVO_SWARM_SERVICE" --format \
    "{{range .Endpoint.Ports}}{{if eq .TargetPort ${target_port}}}{{.PublishedPort}}{{end}}{{end}}" 2>/dev/null || true)
  if [[ -n "$published" && "$published" =~ ^[0-9]+$ ]]; then
    echo "$published"
    return 0
  fi
  if [[ -n "${EVO_HOST_PUBLISHED_PORT:-}" && "${EVO_HOST_PUBLISHED_PORT}" =~ ^[0-9]+$ ]]; then
    echo "$EVO_HOST_PUBLISHED_PORT"
    return 0
  fi
  return 1
}

resolve_evo_backend_url() {
  local traefik port host_port candidate
  if [[ -n "${EVO_BACKEND_URL:-}" ]]; then
    echo "${EVO_BACKEND_URL%/}/"
    return 0
  fi
  traefik=$(traefik_container)
  port=$(resolve_evo_port)
  [[ -z "$traefik" ]] && return 1

  host_port=$(resolve_evo_host_published_port || true)
  if [[ -n "${host_port:-}" ]]; then
    candidate="http://172.17.0.1:${host_port}/instance/fetchInstances"
    if evo_probe_url "$traefik" "$candidate"; then
      echo "http://172.17.0.1:${host_port}/"
      echo "  backend via host gateway 172.17.0.1:${host_port}" >&2
      return 0
    fi
  fi

  for candidate in \
    "http://tasks.${EVO_SWARM_SERVICE}:${port}/instance/fetchInstances" \
    "http://${EVO_SWARM_SERVICE}:${port}/instance/fetchInstances"; do
    if evo_probe_url "$traefik" "$candidate"; then
      echo "${candidate%/instance/fetchInstances}/"
      return 0
    fi
  done

  echo "http://172.17.0.1:${EVO_HOST_PUBLISHED_PORT}/"
  echo "  backend fallback fixo 172.17.0.1:${EVO_HOST_PUBLISHED_PORT}" >&2
  return 0
}

ensure_host_port_published() {
  local target_port published
  target_port=$(resolve_evo_port)
  published=$(docker service inspect "$EVO_SWARM_SERVICE" --format \
    "{{range .Endpoint.Ports}}{{if eq .TargetPort ${target_port}}}{{.PublishedPort}}{{end}}{{end}}" 2>/dev/null || true)
  if [[ -n "$published" && "$published" =~ ^[0-9]+$ ]]; then
    echo "Swarm: porta host ${published} -> ${target_port} já publicada"
    return 0
  fi
  local pub="${EVO_HOST_PUBLISHED_PORT}"
  echo "Swarm: publicando ${pub}:${target_port} em ${EVO_SWARM_SERVICE}"
  docker service update --publish-add "published=${pub},target=${target_port},protocol=tcp" "$EVO_SWARM_SERVICE"
}

ensure_traefik_on_overlay() {
  local traefik svc net_id on_net update_out resolved_net
  traefik=$(traefik_container)
  [[ -z "$traefik" ]] && { echo "ERRO: Traefik container ausente"; return 1; }

  for net in $(docker network ls --format '{{.Name}}' | grep -E 'easypanel|walkup'); do
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

ensure_evo_public_router() {
  [[ -f "$CFG" ]] || return 1
  if grep -q "Host(\`${EVO_PUBLIC_HOST}\`)" "$CFG" 2>/dev/null; then
    return 0
  fi
  local bak
  bak=$(find_backup_with_host "$EVO_PUBLIC_HOST" || true)
  if [[ -z "$bak" ]]; then
    echo "ERRO: router ${EVO_PUBLIC_HOST} ausente e sem backup em ${CFG}.bak*"
    return 1
  fi
  echo "ALERTA: router ${EVO_PUBLIC_HOST} removido — restaurando de ${bak}"
  cp -a "$CFG" "${CFG}.bak-before-auto-evo-restore-$(date +%Y%m%d-%H%M%S)"
  cp -a "$bak" "$CFG"
  return 0
}

patch_main_yaml() {
  local evo_ip resolved_net evo_port backend_url
  evo_ip=$(resolve_evo_ip || true)
  evo_port=$(resolve_evo_port)
  backend_url=$(resolve_evo_backend_url || true)
  resolved_net=$(resolve_overlay_network)

  [[ -z "$evo_ip" ]] && echo "AVISO: container ${EVO_CONTAINER_FILTER} sem IP overlay — usando host gateway"

  [[ -z "$backend_url" ]] && backend_url="http://172.17.0.1:${EVO_HOST_PUBLISHED_PORT}/"

  [[ -f "$CFG" ]] || { echo "ERRO: ${CFG} não existe"; return 1; }

  local before after
  before=$(mktemp)
  after=$(mktemp)
  cp "$CFG" "$before"

  echo "  backend Traefik: ${backend_url} (porta app=${evo_port}, overlay IP=${evo_ip})"

  python3 - "$CFG" "$backend_url" "$EVO_SWARM_SERVICE" "$EVO_PUBLIC_HOST" <<'PY'
import re, sys
path, backend_url, swarm_name, public_host = sys.argv[1:5]
text = open(path, encoding="utf-8").read()
backend_url = (backend_url or "").rstrip("/") + "/"
swarm_name = swarm_name or "walkup_evo-walkup-api"
public_host = public_host or "walkup-evo-walkup-api.achpyp.easypanel.host"

service_keys = [
    f"{swarm_name}-0",
    f"{swarm_name}-1",
    f"{swarm_name.replace('_', '-')}-0",
    swarm_name,
    "walkup_evo-walkup-api-0",
    "walkup_evo-walkup-api",
    "walkup-evo-walkup-api-0",
    "evo-walkup-api",
]

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

evo_url_pat = re.compile(
    rf'("walkup[^"]*evo[^"]*walkup-api[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")http://[^"]+(")',
    re.I,
)
text, n_evo = evo_url_pat.subn(rf'\g<1>{backend_url}\2', text)
if n_evo:
    print(f"  blocos evo-walkup-api -> {backend_url} ({n_evo}x)")

host_aliases = [
    swarm_name,
    "walkup_evo-walkup-api",
    "walkup-evo-walkup-api",
    "evo-walkup-api",
]
for host in host_aliases:
    for prefix in ("", "tasks."):
        for wrong_port in ("8080", "80", "3000"):
            old = f"http://{prefix}{host}:{wrong_port}"
            if old in text and old + "/" != backend_url.rstrip("/") and not backend_url.startswith(old):
                text = text.replace(old + "/", backend_url)
                text = text.replace(old, backend_url.rstrip("/"))
                print(f"  replace {old}* -> {backend_url}")

needles = [public_host, "walkup-evo-walkup-api", "evo-walkup-api", "walkup_evo"]

def fix_host_windows(host_needle, backend):
    global text
    if not host_needle or not backend:
        return 0
    lines = text.splitlines(keepends=True)
    i = 0
    changed = 0
    while i < len(lines):
        line = lines[i]
        if host_needle in line and re.search(r"Host|host|rule", line):
            end = min(i + 40, len(lines))
            block = "".join(lines[i:end])
            orig = block
            block = re.sub(
                rf'("url"\s*:\s*")http://[^"]+(")',
                rf'\g<1>{backend}\2',
                block,
                count=1,
            )
            if block != orig:
                newlines = block.splitlines(keepends=True)
                if len(newlines) < (end - i):
                    newlines.extend(lines[i + len(newlines) : end])
                lines[i:end] = newlines[: end - i]
                changed += 1
            i = end
        else:
            i += 1
    text = "".join(lines)
    return changed

for needle in needles:
    n = fix_host_windows(needle, backend_url)
    if n:
        print(f"  janela Host {needle} -> {backend_url} ({n}x)")

open(path, "w", encoding="utf-8").write(text)
PY

  cp "$CFG" "$after"
  if ! cmp -s "$before" "$after"; then
    cp -a "$CFG" "${CFG}.bak-walkup-evo-$(date +%Y%m%d-%H%M%S)"
    echo "main.yaml atualizado (walkup evo-walkup-api)"
    local traefik
    traefik=$(traefik_container)
    if [[ -n "$traefik" ]]; then
      docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
      sleep 2
      ensure_traefik_on_overlay
    fi
  fi
  rm -f "$before" "$after"
  echo "EVO backend: ${backend_url} (overlay ${evo_ip}:${evo_port}, rede ${resolved_net})"
}

http_code() {
  local host="$1" path="${2:-/}"
  curl -sS -o /dev/null -w "%{http_code}" --resolve "${host}:443:127.0.0.1" --max-time 12 \
    "https://${host}${path}" 2>/dev/null || echo "000"
}

evo_reachable_from_traefik() {
  local traefik backend_url
  backend_url=$(resolve_evo_backend_url || true)
  traefik=$(traefik_container)
  [[ -z "$backend_url" || -z "$traefik" ]] && return 1
  evo_probe_url "$traefik" "${backend_url}instance/fetchInstances"
}

run_fix() {
  local detected_port detected_backend
  load_traefik_bootstrap
  ensure_evo_public_router || true
  detected_port=$(resolve_evo_port)
  detected_backend=$(resolve_evo_backend_url || echo "?")
  echo "=== traefik-permanent-walkup-evo ${EVO_SCRIPT_VERSION} $(date -Is) porta=${detected_port} backend=${detected_backend} ==="
  ensure_host_port_published || true
  ensure_traefik_on_overlay
  patch_main_yaml || true

  local public fetch
  public=$(http_code "$EVO_PUBLIC_HOST")
  fetch=$(http_code "$EVO_PUBLIC_HOST" "/instance/fetchInstances")

  if [[ "$public" == "502" || "$public" == "404" || "$public" == "000" || "$fetch" == "502" || "$fetch" == "404" ]]; then
    if evo_reachable_from_traefik; then
      echo "ALERTA: Evolution OK na rede Docker, HTTPS public=${public} fetch=${fetch} — re-patch Traefik"
      patch_main_yaml || true
      public=$(http_code "$EVO_PUBLIC_HOST")
      fetch=$(http_code "$EVO_PUBLIC_HOST" "/instance/fetchInstances")
    fi
  fi

  if [[ "$public" == "502" || "$public" == "404" || "$public" == "000" ]]; then
    local traefik
    traefik=$(traefik_container)
    if [[ -n "$traefik" ]]; then
      echo "evo public=${public} fetch=${fetch} — restart Traefik (último recurso)"
      docker restart "$traefik" >/dev/null
      sleep 12
      ensure_traefik_on_overlay
      patch_main_yaml || true
      public=$(http_code "$EVO_PUBLIC_HOST")
      fetch=$(http_code "$EVO_PUBLIC_HOST" "/instance/fetchInstances")
    fi
  fi

  echo "RESULTADO evo_public:${public} evo_fetch:${fetch} (401/200=OK, 404/502=proxy quebrado)"
  [[ "$fetch" != "404" && "$fetch" != "502" && "$fetch" != "000" ]]
}

should_patch_for_name() {
  local name="$1"
  case "$name" in
    *evo-walkup-api*|*evo_walkup*|*walkup-evo*|walkup_evo*)
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
  echo "=== traefik-permanent-walkup-evo watch runner=${runner} ==="
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
Description=Traefik walkup evo-walkup-api — patch automático em redeploy
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
  # Default OFF — evita thrash com bootstrap/watchdog (incidente 2026-07-10).
  cat > "$TIMER_SERVICE_UNIT" <<EOF
[Unit]
Description=Traefik walkup evo — patch periódico (backup)

[Service]
Type=oneshot
ExecStart=${INSTALL_PATH} run
EOF

  cat > "$TIMER_UNIT_PATH" <<EOF
[Unit]
Description=Traefik walkup evo — timer (opt-in; default off)

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
    echo "Systemd: ${TIMER_SERVICE} instalado mas OFF (WABA_ENABLE_FIX_TIMER=1 para ligar)"
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

  echo "Instalando fix Evolution API em ${dest} (Easypanel walkup/evo-walkup-api)"

  # Cron a cada minuto + timers = thrash; não instalar.
  rm -f "$CRON_FILE" 2>/dev/null || true

  if command -v systemctl >/dev/null 2>&1; then
    install_watch_service || echo "AVISO: systemd watch falhou"
    install_timer_service || echo "AVISO: systemd timer falhou"
  else
    echo "AVISO: sem systemd — use cron apenas"
  fi

  ensure_host_port_published || true
  run_fix || true

  echo ""
  echo "=== Instalação walkup evo concluída ==="
  echo "  Script:  ${dest}"
  echo "  Domínio: ${EVO_PUBLIC_HOST}"
  echo "  Serviço: Easypanel walkup/evo-walkup-api (Swarm ${EVO_SWARM_SERVICE})"
  echo "  Log:     ${LOG}"
  echo ""
  echo "Diagnóstico: ${dest} run"
  echo "Status:      ${dest} status"
}

show_status() {
  echo "=== traefik-permanent-walkup-evo status ==="
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
  echo "  host: ${EVO_PUBLIC_HOST}"
  echo "  swarm: ${EVO_SWARM_SERVICE}"
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
    echo "  EVO_PUBLIC_HOST           (default: walkup-evo-walkup-api.achpyp.easypanel.host)"
    echo "  EVO_SWARM_SERVICE         (default: walkup_evo-walkup-api)"
    echo "  EVO_CONTAINER_FILTER      (default: evo-walkup-api)"
    echo "  EVO_NET                   (default: easypanel-walkup)"
    echo "  EVO_HOST_PUBLISHED_PORT   (default: 30181)"
    echo "  EVO_API_KEY               (apikey para probe fetchInstances)"
    exit 1
    ;;
esac
