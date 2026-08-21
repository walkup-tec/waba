#!/bin/bash
# EMERGÊNCIA 2026-07-20 — bet.waba.info + wabadisparos.com.br em 502
# Restaura publish :30210/:30211 + main.yaml estável (prefer bak 19/07) + backends 172.17.0.1
# NÃO force Traefik. NÃO HUP.
# Cole no VPS root:
#   bash /tmp/emergency-restore-landings-502.sh
set -euo pipefail

CFG=/etc/easypanel/traefik/config/main.yaml
DIR=$(dirname "$CFG")
LOG=/var/log/emergency-restore-landings-502.log
PREFERRED_BAK="$DIR/main.yaml.bak-restore-easypanel-backends-2026-07-10-v2-20260719-234729"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== emergency-restore-landings-502 START ==="

# 1) Parar thrash que reescreve main.yaml
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer \
  traefik-permanent-walkup-evo-fix.timer \
  traefik-permanent-paginadevendas-watch \
  traefik-permanent-bets-pv-watch \
  soma-heal.timer \
  restore-easypanel.timer
do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers thrash OFF (best-effort)"

# 2) Republicar portas host (causa clássica do 502 Easypanel)
if docker service ls --format '{{.Name}}' | grep -qx waba_paginadevendas; then
  if ! docker service inspect waba_paginadevendas --format '{{json .Endpoint.Ports}}' | grep -q '"PublishedPort":30210'; then
    log "publish-add paginadevendas :30210->3000"
    docker service update --publish-add published=30210,target=3000,mode=host waba_paginadevendas || true
  else
    log "publish :30210 já presente"
  fi
fi
if docker service ls --format '{{.Name}}' | grep -qx waba_bets_pv; then
  if ! docker service inspect waba_bets_pv --format '{{json .Endpoint.Ports}}' | grep -q '"PublishedPort":30211'; then
    log "publish-add bets_pv :30211->3000"
    docker service update --publish-add published=30211,target=3000,mode=host waba_bets_pv || true
  else
    log "publish :30211 já presente"
  fi
fi

sleep 8
curl -sS -o /dev/null -w "local30210:%{http_code}\n" --max-time 8 http://127.0.0.1:30210/ | tee -a "$LOG" || true
curl -sS -o /dev/null -w "local30211:%{http_code}\n" --max-time 8 http://127.0.0.1:30211/ | tee -a "$LOG" || true

# 3) Restaurar main.yaml do bak de 19/07 (mesmo que recuperou ontem) se existir
cp -a "$CFG" "${CFG}.bak-before-emergency-$(date +%Y%m%d-%H%M%S)"
if [[ -f "$PREFERRED_BAK" ]]; then
  log "restaurando bak preferido: $PREFERRED_BAK"
  cp -a "$PREFERRED_BAK" "$CFG"
else
  log "bak 19/07 ausente — escolhendo melhor bak com 30210+30211+wabadisparos"
  BEST=$(python3 - "$DIR" <<'PY'
import sys
from pathlib import Path
d = Path(sys.argv[1])
cands = []
for p in d.glob("main.yaml.bak*"):
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if t.count("{") != t.count("}"):
        continue
    if "wabadisparos.com.br" not in t:
        continue
    if "http://172.17.0.1:30210/" not in t:
        continue
    if "http://172.17.0.1:30211/" not in t:
        continue
    cands.append((p.stat().st_mtime, str(p)))
if not cands:
    print("")
else:
    cands.sort(reverse=True)
    print(cands[0][1])
PY
)
  if [[ -n "${BEST:-}" ]]; then
    log "restaurando: $BEST"
    cp -a "$BEST" "$CFG"
  else
    log "nenhum bak válido — forçando backends 172.17.0.1 via python"
    python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
CANONICAL = {
    "waba_paginadevendas": "http://172.17.0.1:30210/",
    "waba_bets_pv": "http://172.17.0.1:30211/",
    "waba_waba_disparador": "http://172.17.0.1:30180/",
    "waba_waba-disparador": "http://172.17.0.1:30180/",
}
for family, url in CANONICAL.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"{family}* -> {url} ({n}x)")
path.write_text(text, encoding="utf-8")
print("backends patched")
PY
  fi
fi

# 4) Garantir backends host gateway no yaml atual (mesmo após bak)
python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
CANONICAL = {
    "waba_paginadevendas": "http://172.17.0.1:30210/",
    "waba_bets_pv": "http://172.17.0.1:30211/",
    "waba_waba_disparador": "http://172.17.0.1:30180/",
    "waba_waba-disparador": "http://172.17.0.1:30180/",
}
for family, url in CANONICAL.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"ensure {family}* -> {url} ({n}x)")
path.write_text(text, encoding="utf-8")
PY

log "aguardando file watch Traefik 15s (sem HUP/force)..."
sleep 15

log "=== validação ==="
curl -sk -o /dev/null -m 14 -w "disparos:%{http_code}\n" https://wabadisparos.com.br/ | tee -a "$LOG" || true
curl -sk -o /dev/null -m 14 -w "bet:%{http_code}\n" https://bet.waba.info/ | tee -a "$LOG" || true
curl -sk -o /dev/null -m 14 -w "health:%{http_code}\n" https://waba.draxsistemas.com.br/health | tee -a "$LOG" || true
curl -sS -o /dev/null -w "local30210:%{http_code}\n" --max-time 8 http://127.0.0.1:30210/ | tee -a "$LOG" || true
curl -sS -o /dev/null -w "local30211:%{http_code}\n" --max-time 8 http://127.0.0.1:30211/ | tee -a "$LOG" || true

log "=== DONE — cole a saída acima no chat ==="
