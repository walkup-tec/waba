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
set -euo pipefail

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

traefik_container() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
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
  local cid port traefik ip p
  cid=$(resolve_waba_cid || true)
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
      if docker exec "$traefik" wget -qO- --timeout=3 "http://${ip}:${p}/health" 2>/dev/null \
        | grep -q '"ok"'; then
        echo "$p"
        return 0
      fi
    done
  fi
  if [[ -n "$cid" ]]; then
    for p in 80 3000; do
      if docker exec "$cid" wget -qO- --timeout=3 "http://127.0.0.1:${p}/health" 2>/dev/null \
        | grep -q '"ok"'; then
        echo "$p"
        return 0
      fi
    done
  fi
  echo "${WABA_PORT:-3000}"
}

# Descobre URL que o Traefik consegue alcançar (overlay IP costuma falhar neste VPS).
resolve_waba_backend_url() {
  local traefik ip port host_map host_port candidate
  traefik=$(traefik_container)
  ip=$(resolve_waba_ip || true)
  port=$(resolve_waba_port)
  [[ -z "$traefik" ]] && return 1

  traefik_health_ok() {
    docker exec "$traefik" wget -qO- --timeout=4 "$1" 2>/dev/null | grep -q '"ok"'
  }

  for candidate in \
    "http://tasks.${WABA_SWARM_SERVICE}:${port}/health" \
    "http://${WABA_SWARM_SERVICE}:${port}/health" \
    "http://${ip}:${port}/health"; do
    [[ "$candidate" =~ ^http://:[0-9]+/ ]] && continue
    if traefik_health_ok "$candidate"; then
      echo "${candidate%/health}/"
      return 0
    fi
  done

  host_map=$(docker port "$(resolve_waba_cid 2>/dev/null || true)" "${port}/tcp" 2>/dev/null | head -1 || true)
  host_port=$(sed -n 's/.*:\([0-9][0-9]*\)$/\1/p' <<<"$host_map")
  if [[ -n "$host_port" ]]; then
    candidate="http://172.17.0.1:${host_port}/health"
    if traefik_health_ok "$candidate"; then
      echo "http://172.17.0.1:${host_port}/"
      echo "  backend via host gateway 172.17.0.1:${host_port}" >&2
      return 0
    fi
  fi

  [[ -n "$ip" ]] && echo "http://${ip}:${port}/" && return 0
  return 1
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

patch_main_yaml() {
  local waba_ip resolved_net waba_port backend_url
  waba_ip=$(resolve_waba_ip || true)
  waba_port=$(resolve_waba_port)
  backend_url=$(resolve_waba_backend_url || true)
  resolved_net=$(resolve_overlay_network)

  [[ -z "$waba_ip" ]] && {
    echo "ERRO: container ${WABA_CONTAINER_FILTER} sem IP na rede ${resolved_net}"
    echo "  Verifique Easypanel → waba → waba_disparador (running) e docker ps -a | grep -i waba"
    return 1
  }

  [[ -z "$backend_url" ]] && backend_url="http://${waba_ip}:${waba_port}/"

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

service_keys = [
    f"{swarm_name}-0",
    f"{swarm_name}-1",
    f"{swarm_name.replace('_', '-')}-0",
    f"{swarm_name.replace('_', '-')}-1",
    swarm_name,
    "waba_waba-disparador-0",
    "waba_waba_disparador-0",
    "waba_waba_disparador",
    "waba_disparador-0",
    "waba_disparador",
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

# Easypanel regenera :3000 — força :80/tasks/host em qualquer URL do bloco waba_disparador
waba_url_pat = re.compile(
    rf'("waba[^"]*disparador[^"]*"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")http://[^"]+(")',
    re.I,
)
text, n_waba = waba_url_pat.subn(rf'\g<1>{backend_url}\2', text)
if n_waba:
    print(f"  blocos waba_disparador -> {backend_url} ({n_waba}x)")

host_aliases = [
    swarm_name,
    "waba_waba_disparador",
    "waba_waba-disparador",
    "waba_disparador",
    "waba-disparador",
]
for host in host_aliases:
    for prefix in ("", "tasks."):
        for wrong_port in ("3000", "80"):
            old = f"http://{prefix}{host}:{wrong_port}"
            if old in text and old + "/" != backend_url.rstrip("/") and not backend_url.startswith(old):
                text = text.replace(old + "/", backend_url)
                text = text.replace(old, backend_url.rstrip("/"))
                print(f"  replace {old}* -> {backend_url}")

needles = [public_host, "waba.draxsistemas", "waba_disparador", "waba-disparador", "waba-waba"]
if easypanel_host:
    needles.append(easypanel_host)

def fix_host_windows(host_needle, correct_ip, port_s="3000"):
    global text
    if not host_needle or not correct_ip:
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
                rf"http://[0-9.]+\.{port_s}",
                f"http://{correct_ip}:{port_s}",
                block,
            )
            block = re.sub(
                rf'("url"\s*:\s*")http://[^"]+(")',
                rf'\g<1>http://{correct_ip}:{port_s}/\2',
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
    n = fix_host_windows(needle, waba_ip, port)
    if n:
        print(f"  janela Host {needle} -> {waba_ip}:{port} ({n}x)")

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
  detected_port=$(resolve_waba_port)
  detected_backend=$(resolve_waba_backend_url || echo "?")
  echo "=== traefik-permanent-waba $(date -Is) porta=${detected_port} backend=${detected_backend} ==="
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
    ep=$(http_code "$WABA_EASYPANEL_HOST" "/health")
    echo "RESULTADO waba:${public} health:${health} easypanel_host:${ep}"
  else
    echo "RESULTADO waba:${public} health:${health}"
  fi

  [[ "$health" == "200" ]]
}

should_patch_for_name() {
  local name="$1"
  case "$name" in
    *waba_disparador*|*waba-disparador*|*waba_waba*|waba_*)
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
  cat > "$TIMER_SERVICE_UNIT" <<EOF
[Unit]
Description=Traefik WABA — patch periódico (backup)

[Service]
Type=oneshot
ExecStart=${INSTALL_PATH} run
EOF

  cat > "$TIMER_UNIT_PATH" <<EOF
[Unit]
Description=Traefik WABA — timer 20s

[Timer]
OnBootSec=20
OnUnitActiveSec=20
AccuracySec=1

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$TIMER_SERVICE"
  echo "Systemd: ${TIMER_SERVICE} ativo (patch a cada 20s)"
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

  cat > "$CRON_FILE" <<EOF
# Traefik WABA — backup se watcher falhar (Swarm IP drift)
* * * * * root ${dest} run >> ${LOG} 2>&1
EOF
  chmod 644 "$CRON_FILE"

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
