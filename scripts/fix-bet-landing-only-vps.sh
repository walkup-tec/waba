#!/bin/bash
# Corrige só bet.waba.info — Traefik estável + backend 172.17.0.1:30211 (sem permanent scripts).
# Uso: bash /root/fix-bet-landing-only-vps.sh
# Versão: fix-bet-landing-only-2026-07-09-v1
set -euo pipefail

VERSION="fix-bet-landing-only-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-landing-only.log"
BETS_URL="http://172.17.0.1:30211/"
BOOT="/root/traefik-easypanel-bootstrap-vps.sh"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

ensure_traefik() {
  local i
  if ss -tln | grep -q ':443 ' && docker service ls | grep -q 'easypanel-traefik.*1/1'; then
    log "Traefik 1/1 + :443 OK"
    return 0
  fi
  log "Traefik instável — bootstrap"
  [[ -x "$BOOT" ]] && bash "$BOOT" run >>"$LOG" 2>&1 || true
  for i in $(seq 1 25); do
    ss -tln | grep -q ':443 ' && docker service ls | grep -q 'easypanel-traefik.*1/1' && {
      log "Traefik OK após bootstrap"
      return 0
    }
    sleep 3
  done
  log "ERRO: Traefik ainda down"
  exit 1
}

patch_bets_backends() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
  cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%Y%m%d-%H%M%S)"
  python3 - "$CFG" "$BETS_URL" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url = sys.argv[2].rstrip("/") + "/"
text = path.read_text(encoding="utf-8")

patterns = [
    r'("waba_bets_pv[^"]*"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")',
    r'("https?-waba_bets_pv[^"]*"\s*:\s*\{[\s\S]*?"service"\s*:\s*")([^"]+)(")',
]
changed = 0
text2, n = re.subn(
    r'("waba_bets_pv[^"]*"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")',
    rf"\g<1>{url}\2",
    text,
    flags=re.I,
)
if n:
    print(f"service bets_pv url -> {url} ({n}x)")
    changed += n
    text = text2

for old in (
    "http://tasks.waba_bets_pv:3000/",
    "http://waba_bets_pv:3000/",
    "http://tasks.waba_bets_pv:80/",
):
    if old in text and old != url:
        text = text.replace(old, url)
        print(f"replace {old} -> {url}")
        changed += 1

if "Host(`bet.waba.info`)" not in text:
    print("ERRO: Host(bet.waba.info) ausente no main.yaml — rode restore-landing-routers-vps.sh")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print(f"OK backends bets ({changed} alterações)")
PY
}

reload_hup() {
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$cid" ]] || { log "ERRO: container Traefik ausente"; exit 1; }
  docker kill -s HUP "$cid" >/dev/null 2>&1 || true
  sleep 6
  log "HUP Traefik ${cid:0:12}"
}

main() {
  mkdir -p "$(dirname "$LOG")"
  log "=== ${VERSION} início ==="

  local local_code
  local_code=$(http_code http://127.0.0.1:30211/)
  log "bets local 30211 → ${local_code}"
  [[ "$local_code" =~ ^(200|301|302|304)$ ]] || {
    log "ERRO: backend bets não responde em :30211 — redeploy waba_bets_pv no Easypanel"
    exit 1
  }

  ensure_traefik
  patch_bets_backends
  reload_hup

  log "bet.waba.info → $(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)"
  log "bets EP → $(http_code --resolve waba-bets-pv.achpyp.easypanel.host:443:127.0.0.1 https://waba-bets-pv.achpyp.easypanel.host/)"
  log "=== ${VERSION} fim ==="
}

main "$@"
