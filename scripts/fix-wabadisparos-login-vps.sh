#!/bin/bash
# Fix definitivo: wabadisparos mostrando login (service paginadevendas com URL 30180).
# 1) Desliga automação que recontamina main.yaml
# 2) Restaura URLs Easypanel
# 3) Bootstrap Traefik + HUP
#
# Uso: bash fix-wabadisparos-login-vps.sh
set -euo pipefail

VERSION="fix-wabadisparos-login-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-wabadisparos-login.log"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== $VERSION ==="

# Parar tudo que reescreve main.yaml com backends errados
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer \
  traefik-permanent-walkup-evo-fix.timer \
  traefik-permanent-paginadevendas-watch \
  traefik-permanent-bets-pv-watch \
  traefik-permanent-waba-watch \
  traefik-permanent-walkup-evo-watch; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "automação traefik-permanent/guard desligada"

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%H%M%S)"

python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

FIXES = {
    "waba_paginadevendas-0": "http://waba_paginadevendas:3000/",
    "waba_paginadevendas-1": "http://waba_paginadevendas:3000/",
    "waba_paginadevendas-2": "http://waba_paginadevendas:3000/",
    "waba_bets_pv-0": "http://waba_bets_pv:3000/",
    "waba_bets_pv-1": "http://waba_bets_pv:3000/",
    "waba_waba_disparador-0": "http://waba_waba_disparador:80/",
}

for key, url in FIXES.items():
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    old = text
    if n == 0 and "paginadevendas" in key:
        pat2 = rf'("{re.escape(key)}"\s*:\s*\{{)([\s\S]*?)(\n\s*\}})'
        def repl(m):
            body = re.sub(r'"url"\s*:\s*"[^"]+"', f'"url": "{url}"', m.group(2), count=1)
            return m.group(1) + body + m.group(3)
        text, n = re.subn(pat2, repl, text, count=1)
    print(f"{key}: {'OK -> ' + url if n else 'FALHOU'}")

# Routers wabadisparos -> service paginadevendas (não disparador)
router_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    brace = text.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{": depth += 1
        elif ch == "}": 
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[m.start():end]
    if "Host(`wabadisparos.com.br`)" in block and '"service"' in block:
        if "paginadevendas-1" in block or '"entryPoints"' in block and "websecure" in block:
            svc = "waba_paginadevendas-1"
        else:
            svc = "waba_paginadevendas-0"
        new_block = re.sub(r'("service"\s*:\s*")[^"]+(")', rf'\g<1>{svc}\2', block, count=1)
        if new_block != block:
            print(f"router {m.group(1)} -> service {svc}")
            text = text[:m.start()] + new_block + text[end:]
            end = m.start() + len(new_block)
    pos = end

path.write_text(text, encoding="utf-8")
PY

log "URLs após patch:"
grep -A8 '"waba_paginadevendas-0"' "$CFG" | grep url | tee -a "$LOG"
grep -A8 '"waba_paginadevendas-1"' "$CFG" | grep url | tee -a "$LOG"

BOOT="/root/traefik-easypanel-bootstrap-vps.sh"
[[ -x "$BOOT" ]] || curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-easypanel-bootstrap-vps.sh" -o "$BOOT"
sed -i 's/\r$//' "$BOOT" 2>/dev/null; chmod +x "$BOOT"
bash "$BOOT" run 2>&1 | tee -a "$LOG" || true

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -n "$CID" ]]; then
  docker kill -s HUP "$CID" 2>/dev/null || true
  sleep 6
  log "Traefik HUP $CID"
else
  log "ERRO: Traefik ainda sem container — docker service ps easypanel-traefik | head -5"
  docker service ps easypanel-traefik --no-trunc | head -5 | tee -a "$LOG"
  exit 1
fi

ss -tlnp | grep ':443' | tee -a "$LOG" || log "SEM :443"

CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
  --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null || echo "000")
log "HTTPS wabadisparos: $CODE"
BODY=$(curl -sS --max-time 15 --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null | head -c 300 || true)
if echo "$BODY" | grep -q "Acesso WABA"; then
  log "ERRO: ainda LOGIN — cole: grep -A8 waba_paginadevendas-0 $CFG"
elif echo "$BODY" | grep -qiE "disparos|cadastro|drax"; then
  log "OK: landing"
fi
log "=== fim ==="
