#!/bin/bash
# Heal Sinal Verde pós-redeploy — ISOLADO.
# - Só toca: publish :30310 do CRM + sinal-verde.yaml + strip de chaves SV no main.yaml
# - NUNCA chama restore-easypanel-traefik-backends (isso patcha WABA e já derrubou Traefik)
# - NUNCA force/HUP Traefik
# - Strip atômico: backup + validação de braces + rollback se WABA cair
#
# Doc:
#   https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#   https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
#
# Uso: install|run|burst|post-deploy|status|uninstall
set -euo pipefail

VERSION="heal-sinal-verde-pos-redeploy-2026-07-21-v1-isolated"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SV_YAML="${CFG_DIR}/sinal-verde.yaml"
LOG="/var/log/heal-sinal-verde-pos-redeploy.log"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/heal-sinal-verde-pos-redeploy-vps.sh"
GUARD="${INSTALL_DIR}/sinal-verde-overlay-guard-vps.sh"
FIX_ISO="${INSTALL_DIR}/fix-sinal-verde-isolated-yaml-vps.sh"
SPLIT="${INSTALL_DIR}/traefik-split-sinal-verde-yaml-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="heal-sinal-verde.timer"
SERVICE="heal-sinal-verde.service"
WATCH="heal-sinal-verde-watch.service"
PATH_UNIT="sinal-verde-main-yaml.path"
PATH_SERVICE="sinal-verde-main-yaml-strip.service"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
DOMAIN="acesso-sinalverde.com"
URL="http://172.17.0.1:${HOST_PORT}/"
REPO_RAW="${WABA_SCRIPTS_RAW:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || echo 000; }

waba_ok() {
  local c
  c="$(http_code "https://wabadisparos.com.br/")"
  case "$c" in 200|301|302|303|307|308) return 0 ;; esac
  c="$(http_code "https://waba.draxsistemas.com.br/health")"
  [[ "$c" == "200" ]]
}

sv_ok() {
  case "$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")" in
    200|301|302|303|307|308) return 0 ;;
    *) return 1 ;;
  esac
}

braces_ok() {
  local f=$1
  [[ -f "$f" ]] || return 1
  python3 - "$f" <<'PY'
import sys
from pathlib import Path
t = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
sys.exit(0 if t.count("{") == t.count("}") and len(t) > 50 else 1)
PY
}

ensure_publish() {
  docker service ls --format '{{.Name}}' | grep -qx "$CRM" || {
    log "CRM $CRM ausente"
    return 1
  }
  if docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
      | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    return 0
  fi
  log "republicando :${HOST_PORT}"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || return 1
  sleep 4
}

# Escreve sinal-verde.yaml canônico (http.routers) — NÃO toca main.yaml
write_sv_yaml() {
  local resolver="letsencrypt"
  resolver=$(docker service inspect easypanel-traefik \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
    | grep -iE '^TRAEFIK_CERTIFICATESRESOLVERS_' | head -1 \
    | sed -E 's/^TRAEFIK_CERTIFICATESRESOLVERS_([^_]+)_.*/\1/i' \
    | tr '[:upper:]' '[:lower:]' || true)
  [[ -n "$resolver" ]] || resolver="letsencrypt"

  python3 - "$SV_YAML" "$URL" "$DOMAIN" "$resolver" <<'PY'
import json, sys
from pathlib import Path
path, url, domain, resolver = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
www = f"www.{domain}"
rule = f"Host(`{domain}`) || Host(`{www}`)"
data = {
  "http": {
    "middlewares": {
      "sv-redirect-https": {"redirectScheme": {"scheme": "https", "permanent": True}}
    },
    "routers": {
      "http-sinal-verde_acesso-sinalverde-0": {
        "entryPoints": ["http"],
        "middlewares": ["sv-redirect-https"],
        "service": "sinal-verde_acesso-sinalverde-0",
        "rule": rule,
        "priority": 1000,
      },
      "https-sinal-verde_acesso-sinalverde-0": {
        "entryPoints": ["https"],
        "service": "sinal-verde_acesso-sinalverde-0",
        "rule": rule,
        "priority": 1000,
        "tls": {
          "certResolver": resolver,
          "domains": [{"main": domain, "sans": [www]}],
        },
      },
    },
    "services": {
      "sinal-verde_acesso-sinalverde-0": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
      "sinal-verde_acesso-sinalverde-1": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
    },
  }
}
tmp = path.with_suffix(".yaml.tmp")
tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
# atomic replace
tmp.replace(path)
print(f"wrote {path}")
PY
}

# Strip atômico: só remove chaves SV; valida braces; rollback se quebrar WABA
strip_sv_from_main_safe() {
  [[ -f "$MAIN" ]] || return 0
  grep -qiE 'sinal-verde|acesso-sinalverde|sinalverde' "$MAIN" 2>/dev/null || return 0

  if ! braces_ok "$MAIN"; then
    log "ABORT strip: main.yaml já desbalanceado — não mexo"
    return 1
  fi

  local bak="${MAIN}.bak-strip-sv-safe-$(date +%Y%m%d%H%M%S)"
  cp -a "$MAIN" "$bak"
  log "strip SV do main (bak=$bak)"

  python3 - "$MAIN" <<'PY' || { log "strip python falhou — restore"; cp -a "$bak" "$MAIN"; return 1; }
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    raise SystemExit(2)

def is_sv_key(key: str) -> bool:
    k = key.lower()
    if "waba_" in k:
        return False
    return ("sinal-verde" in k) or ("acesso-sinalverde" in k) or ("sinalverde" in k)

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return start, i + 1
    raise RuntimeError("unbalanced")

key_re = re.compile(r'"([^"]+)"\s*:\s*\{')
ranges = []
i = 0
while i < len(text):
    if text[i] == '"':
        m = key_re.match(text, i)
        if m and is_sv_key(m.group(1)):
            a, b = extract_block(text, i)
            ranges.append((a, b))
            i = b
            continue
    i += 1

if not ranges:
    print("no_sv")
    raise SystemExit(0)

# remove de trás pra frente; limpa vírgulas órfãs
for a, b in sorted(ranges, reverse=True):
    text = text[:a] + text[b:]

# limpeza de vírgulas duplas / trailing
text = re.sub(r',\s*,', ',', text)
text = re.sub(r',\s*}', '}', text)
text = re.sub(r',\s*]', ']', text)

if text.count("{") != text.count("}"):
    raise SystemExit(3)

tmp = path.with_suffix(".yaml.strip-tmp")
tmp.write_text(text, encoding="utf-8")
tmp.replace(path)
print(f"stripped={len(ranges)}")
PY

  if ! braces_ok "$MAIN"; then
    log "strip gerou braces ruins — restore $bak"
    cp -a "$bak" "$MAIN"
    return 1
  fi

  sleep 8
  if ! waba_ok; then
    log "WABA caiu após strip — restore $bak"
    cp -a "$bak" "$MAIN"
    sleep 8
    return 1
  fi
  log "strip OK — WABA intacto"
}

ensure_sv_yaml() {
  if [[ -f "$SV_YAML" ]] && braces_ok "$SV_YAML"; then
    # garante URL canônica se já existe
    if ! grep -q "172.17.0.1:${HOST_PORT}" "$SV_YAML" 2>/dev/null; then
      write_sv_yaml
    fi
    return 0
  fi
  log "sinal-verde.yaml ausente/inválido — regenerando canônico"
  write_sv_yaml
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  log "=== run ==="
  # Pré-condição: WABA deve estar ok antes de strip
  if ! waba_ok; then
    log "AVISO: WABA não está OK agora — só publish + yaml SV, SEM strip no main"
    ensure_publish || true
    ensure_sv_yaml || true
    log "sv=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") local=$(http_code "http://127.0.0.1:${HOST_PORT}/")"
    return 0
  fi
  ensure_publish || true
  ensure_sv_yaml || true
  strip_sv_from_main_safe || true
  if [[ -x "$GUARD" ]]; then
    bash "$GUARD" run >>"$LOG" 2>&1 || true
  fi
  sleep 5
  log "sv=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") disparos=$(http_code https://wabadisparos.com.br/) local=$(http_code "http://127.0.0.1:${HOST_PORT}/")"
}

cmd_burst() {
  for i in 1 2 3 4 5; do
    log "burst $i/5"
    cmd_run
    sv_ok && waba_ok && break
    sleep 12
  done
}

cmd_post_deploy() {
  log "=== post-deploy ==="
  cmd_burst
}

fetch_sibling() {
  local name=$1
  curl -fsSL "${REPO_RAW}/${name}" -o "${INSTALL_DIR}/${name}" || return 1
  sed -i 's/\r$//' "${INSTALL_DIR}/${name}"
  chmod +x "${INSTALL_DIR}/${name}"
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Heal Sinal Verde isolado (não toca WABA backends)
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Heal Sinal Verde timer (~20s)
[Timer]
OnBootSec=45s
OnUnitActiveSec=20s
AccuracySec=3s
Persistent=true
[Install]
WantedBy=timers.target
EOF

  cat >"${UNIT_DIR}/${WATCH}" <<EOF
[Unit]
Description=Heal Sinal Verde docker events watch
After=docker.service
[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=/bin/bash -c 'docker events --filter type=service --filter type=container --format "{{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}" | while read -r a n s; do case "\$n\$s" in *sinal-verde*) sleep 40; ${SELF} run ;; esac; done'
[Install]
WantedBy=multi-user.target
EOF

  # Path unit: assim que Easypanel reescreve main.yaml, strip SV imediato
  cat >"${UNIT_DIR}/${PATH_UNIT}" <<EOF
[Unit]
Description=Watch main.yaml para strip imediato de chaves Sinal Verde
[Path]
PathChanged=${MAIN}
PathModified=${MAIN}
Unit=${PATH_SERVICE}
[Install]
WantedBy=multi-user.target
EOF

  cat >"${UNIT_DIR}/${PATH_SERVICE}" <<EOF
[Unit]
Description=Strip SV do main.yaml (isolado, com rollback WABA)
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} strip-only
EOF
}

cmd_strip_only() {
  mkdir -p "$(dirname "$LOG")"
  log "=== strip-only (path trigger) ==="
  ensure_sv_yaml || true
  strip_sv_from_main_safe || true
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || exit 1
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  src=$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
  cp -f "$src" "$SELF"
  sed -i 's/\r$//' "$SELF"
  chmod +x "$SELF"

  # irmãos
  local_dir="$(dirname "$src")"
  for f in sinal-verde-overlay-guard-vps.sh fix-sinal-verde-isolated-yaml-vps.sh \
           fix-sinal-verde-traefik-safe-vps.sh traefik-split-sinal-verde-yaml-vps.sh; do
    if [[ -f "${local_dir}/${f}" ]]; then
      cp -f "${local_dir}/${f}" "${INSTALL_DIR}/${f}"
      sed -i 's/\r$//' "${INSTALL_DIR}/${f}"
      chmod +x "${INSTALL_DIR}/${f}"
    else
      fetch_sibling "$f" || log "AVISO: não baixou $f"
    fi
  done

  # instalar guard com path se disponível
  if [[ -x "$GUARD" ]]; then
    bash "$GUARD" install >>"$LOG" 2>&1 || true
  fi

  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER" "$WATCH" "$PATH_UNIT"
  bash "$SELF" run || true
  systemctl is-active "$TIMER" "$WATCH" "$PATH_UNIT" || true
  cmd_status
}

cmd_uninstall() {
  systemctl disable --now "$TIMER" "$WATCH" "$PATH_UNIT" 2>/dev/null || true
  rm -f "${UNIT_DIR}/$TIMER" "${UNIT_DIR}/$SERVICE" "${UNIT_DIR}/$WATCH" \
        "${UNIT_DIR}/$PATH_UNIT" "${UNIT_DIR}/$PATH_SERVICE"
  systemctl daemon-reload
}

cmd_status() {
  echo "timer=$(systemctl is-active "$TIMER" 2>/dev/null || echo inactive)"
  echo "watch=$(systemctl is-active "$WATCH" 2>/dev/null || echo inactive)"
  echo "path=$(systemctl is-active "$PATH_UNIT" 2>/dev/null || echo inactive)"
  echo "sv_yaml=$( [[ -f $SV_YAML ]] && echo present || echo MISSING )"
  echo -n "local:${HOST_PORT}="; http_code "http://127.0.0.1:${HOST_PORT}/"; echo
  echo -n "sv="; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
  echo -n "disparos="; http_code "https://wabadisparos.com.br/"; echo
  if [[ -f "$MAIN" ]] && grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN"; then
    echo "WARN: main ainda tem SV"
  else
    echo "main: limpo SV"
  fi
}

case "${1:-}" in
  run) cmd_run ;;
  burst|post-deploy) cmd_post_deploy ;;
  strip-only) cmd_strip_only ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *) echo "Uso: $0 install|run|burst|post-deploy|strip-only|status|uninstall"; exit 1 ;;
esac
