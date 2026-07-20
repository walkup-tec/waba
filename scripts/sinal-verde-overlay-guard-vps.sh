#!/bin/bash
# Guard permanente Sinal Verde — cobre as quedas COMUNS pós-Redeploy.
#
# Causas que este script corrige sozinho (timer 20s + watch docker):
#   1) Traefik URL overlay  → http://sinal-verde_…:3000/     = 502
#   2) Traefik URL host :3000 (painel Easypanel) em service SV = HTML errado / 502
#   3) Publish host :30310 sumiu do CRM após Redeploy          = 502
#   4) entryPoints web/websecure nos routers SV                = 404 órfão
#   5) Host(`domínio/`) com slash                              = mismatch
#   6) Router SV apontando service "http-*" (chave de router)  = 404
#
# NUNCA: inject de blocos novos | force Traefik | HUP | mexer em WABA
# Aborta gravação se wabadisparos sumir ou chaves desbalanceadas.
#
# Uso (root, UMA VEZ — já inclui correção imediata):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/sinal-verde-overlay-guard-vps.sh" \
#     -o /tmp/sv-guard.sh
#   sed -i 's/\r$//' /tmp/sv-guard.sh && bash /tmp/sv-guard.sh install
#
# Depois: run|status|install|uninstall
#
# Doc: https://doc.traefik.io/traefik/getting-started/configuration-overview/
#      https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
# Versão: sinal-verde-overlay-guard-2026-07-20-v2
set -euo pipefail

VERSION="sinal-verde-overlay-guard-2026-07-20-v2"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${SV_GUARD_LOG:-/var/log/sinal-verde-overlay-guard.log}"
LOCK="/var/run/sinal-verde-overlay-guard.lock"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/sinal-verde-overlay-guard-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="sinal-verde-overlay-guard.timer"
SERVICE="sinal-verde-overlay-guard.service"
WATCH="sinal-verde-overlay-guard-watch.service"
CRM="${SV_SWARM_SERVICE:-sinal-verde_acesso-sinalverde}"
HOST_PORT="${SV_PUBLISHED_PORT:-30310}"
TARGET_PORT="${SV_PORT:-3000}"
DOMAIN="${SV_PUBLIC_HOST:-acesso-sinalverde.com}"
DOMAIN_WWW="${SV_PUBLIC_WWW:-www.acesso-sinalverde.com}"
GW="${WABA_HOST_GW:-172.17.0.1}"
URL="http://${GW}:${HOST_PORT}/"
TIMER_SEC="${SV_GUARD_SEC:-20}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null || echo 000; }

with_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -w 25 9 || return 1
  fi
  return 0
}

crm_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$CRM"
}

crm_publish_ok() {
  docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -q "\"PublishedPort\":${HOST_PORT}\|\"PublishedPort\": ${HOST_PORT}"
}

local_ok() {
  case "$(http_code "http://127.0.0.1:${HOST_PORT}/")" in
    200|301|302|303|307|308|401) return 0 ;;
    *) return 1 ;;
  esac
}

sv_https_ok() {
  case "$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")" in
    200|301|302|303|307|308|401) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_publish() {
  crm_exists || { log "CRM ${CRM} ausente"; return 1; }
  if crm_publish_ok && local_ok; then
    return 0
  fi
  if crm_publish_ok && ! local_ok; then
    log "publish existe mas app local down — sem republicar"
    return 1
  fi
  log "republicando CRM :${HOST_PORT}->${TARGET_PORT}"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || return 1
  sleep 5
  crm_publish_ok
}

# Patch seguro: só chaves/routers que já são Sinal Verde
patch_traefik_sv() {
  [[ -f "$CFG" ]] || return 1
  python3 - "$CFG" "$URL" "$DOMAIN" "$DOMAIN_WWW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url, domain, domain_www = sys.argv[2:5]
text0 = path.read_text(encoding="utf-8")
text = text0

if text.count("{") != text.count("}"):
    print("ABORT unbalanced")
    sys.exit(2)
if "wabadisparos.com.br" not in text:
    print("ABORT missing wabadisparos")
    sys.exit(2)

def extract_block(text, start):
    brace = text.find("{", start)
    if brace < 0:
        return "", start, start
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return text[start:end], start, end

def is_sv_key(key: str) -> bool:
    kl = key.lower()
    return ("sinal-verde" in kl) or ("acesso-sinalverde" in kl)

nfix = 0

# 1) URLs dos loadBalancer SV → host gateway
for family in ("sinal-verde_acesso-sinalverde", "sinal-verde-acesso-sinalverde"):
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text2, c = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if c:
        nfix += c
        text = text2
        print(f"url family {family}* -> {url} ({c}x)")

text2, c = re.subn(r"http://sinal-verde_acesso-sinalverde(?::\d+)?/?", url, text)
if c:
    nfix += c
    text = text2
    print(f"overlay literal -> {url} ({c}x)")

# 2) descobrir loadBalancer canônico (não http-/https-)
sv_lb = None
for key in ("sinal-verde_acesso-sinalverde-1", "sinal-verde_acesso-sinalverde-0"):
    if f'"{key}"' in text:
        sv_lb = key
        break

# 3) routers SV: entryPoints + Host slash + service errado
svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    if not is_sv_key(key):
        pos = m.end()
        continue
    block, bstart, bend = extract_block(text, m.start())
    if "rule" not in block and "entryPoints" not in block:
        pos = bend
        continue
    nb = block
    changed = False
    if re.search(r'"websecure"|"web"', nb):
        if key.startswith("https-") or "websecure" in nb:
            nb2 = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["https"]', nb, count=1)
        else:
            nb2 = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["http"]', nb, count=1)
        if nb2 != nb:
            nb = nb2
            changed = True
            print(f"router {key} entryPoints fixed")
    for d in (domain, domain_www):
        bad, good = f"Host(`{d}/`)", f"Host(`{d}`)"
        if bad in nb:
            nb = nb.replace(bad, good)
            changed = True
            print(f"router {key} Host slash fixed")
    if sv_lb and "rule" in nb:
        rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', nb)
        svc_m = re.search(r'"service"\s*:\s*"([^"]+)"', nb)
        if rule_m and svc_m:
            rule, svc = rule_m.group(1), svc_m.group(1)
            if (f"Host(`{domain}`)" in rule or f"Host(`{domain_www}`)" in rule) and (
                svc.startswith("http-") or svc.startswith("https-") or svc != sv_lb
            ):
                # só força se service é router-key OU se Host público deve usar sv_lb
                if svc.startswith("http-") or svc.startswith("https-"):
                    nb2 = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{sv_lb}\2", nb, count=1)
                    if nb2 != nb:
                        nb = nb2
                        changed = True
                        print(f"router {key} service {svc} -> {sv_lb}")
    if changed:
        text = text[:bstart] + nb + text[bend:]
        bend = bstart + len(nb)
        nfix += 1
        pos = bend
    else:
        pos = bend

if text.count("{") != text.count("}"):
    print("ABORT unbalanced after")
    sys.exit(2)
for must in ("wabadisparos.com.br", "waba.draxsistemas.com.br"):
    if must not in text and "waba_waba_disparador" not in text:
        if must == "wabadisparos.com.br":
            print(f"ABORT missing {must}")
            sys.exit(2)

if text == text0:
    print("noop")
    sys.exit(0)
path.write_text(text, encoding="utf-8")
print(f"OK patched={nfix}")
PY
}

yaml_needs_fix() {
  grep -qE 'sinal-verde_acesso-sinalverde:3000|http://sinal-verde_acesso-sinalverde[^"]*|http://172\.17\.0\.1:3000/' "$CFG" 2>/dev/null \
    && return 0
  grep -n 'sinal-verde\|acesso-sinalverde' "$CFG" 2>/dev/null | grep -qE '"web"|"websecure"|Host\(`[^`]+/`\)' \
    && return 0
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0

  local need=0
  crm_publish_ok || need=1
  local_ok || need=1
  sv_https_ok || need=1
  yaml_needs_fix && need=1

  if [[ "$need" -eq 0 ]]; then
    return 0
  fi

  ensure_publish || log "AVISO: publish"
  if yaml_needs_fix || ! sv_https_ok; then
    log "patch Traefik SV → ${URL}"
    patch_traefik_sv >>"$LOG" 2>&1 || log "AVISO: patch abort/fail"
    sleep 10
  fi
  log "sv=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") local=$(http_code "http://127.0.0.1:${HOST_PORT}/") disparos=$(http_code https://wabadisparos.com.br/) waba=$(http_code https://waba.draxsistemas.com.br/health)"
}

cmd_watch() {
  log "watch ativo — ${CRM} (debounce 50s)"
  docker events \
    --filter "type=service" \
    --filter "type=container" \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r etype eaction ename esvc; do
      if [[ "$ename" == "$CRM" ]] || [[ "$esvc" == "$CRM" ]]; then
        case "$eaction" in
          update|create|start|die|kill)
            token="$(date +%s%N)"
            echo "$token" >/var/run/sv-overlay-guard-debounce
            (
              sleep 50
              if [[ "$(cat /var/run/sv-overlay-guard-debounce 2>/dev/null)" == "$token" ]]; then
                bash "$SELF" run
              fi
            ) >>"$LOG" 2>&1 &
            ;;
        esac
      fi
    done
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Sinal Verde uptime guard (publish+Traefik URL)
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Sinal Verde uptime guard a cada ${TIMER_SEC}s
[Timer]
OnBootSec=30s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=3s
Persistent=true
[Install]
WantedBy=timers.target
EOF
  cat >"${UNIT_DIR}/${WATCH}" <<EOF
[Unit]
Description=Sinal Verde uptime guard WATCH (docker events)
After=docker.service
Requires=docker.service
[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=${SELF} watch
[Install]
WantedBy=multi-user.target
EOF
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || exit 1
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"

  # Desliga heals SV antigos perigosos (inject)
  systemctl disable --now sinal-verde-heal.timer sinal-verde-heal-watch.service 2>/dev/null || true

  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  [[ "$src" != "$SELF" ]] && cp -f "$src" "$SELF" || true
  sed -i 's/\r$//' "$SELF" 2>/dev/null || true
  chmod +x "$SELF"
  cp -f "$SELF" /root/sinal-verde-overlay-guard-vps.sh 2>/dev/null || true

  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  systemctl enable --now "$WATCH"
  log "instalado ${TIMER} + ${WATCH}"
  bash "$SELF" run || true
  echo "--- status ---"
  systemctl is-active "$TIMER" || true
  systemctl is-active "$WATCH" || true
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
  echo -n "disparos: "; http_code https://wabadisparos.com.br/; echo
  echo -n "waba: "; http_code https://waba.draxsistemas.com.br/health; echo
}

cmd_uninstall() {
  systemctl disable --now "$TIMER" "$WATCH" 2>/dev/null || true
  rm -f "${UNIT_DIR}/${TIMER}" "${UNIT_DIR}/${SERVICE}" "${UNIT_DIR}/${WATCH}"
  systemctl daemon-reload
  log "desinstalado"
}

cmd_status() {
  echo -n "timer: "; systemctl is-active "$TIMER" 2>/dev/null || echo inactive
  echo -n "watch: "; systemctl is-active "$WATCH" 2>/dev/null || echo inactive
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
  echo -n "local: "; http_code "http://127.0.0.1:${HOST_PORT}/"; echo
  echo -n "disparos: "; http_code https://wabadisparos.com.br/; echo
  echo -n "waba: "; http_code https://waba.draxsistemas.com.br/health; echo
  echo "--- urls SV no yaml ---"
  grep -n 'sinal-verde_acesso-sinalverde' "$CFG" | grep url | head -10 || true
  tail -15 "$LOG" 2>/dev/null || true
}

case "${1:-}" in
  run) cmd_run ;;
  watch) cmd_watch ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 install|run|status|uninstall|watch"
    exit 1
    ;;
esac
