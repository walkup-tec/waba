#!/bin/bash
# Watchdog bet.waba.info — corrige 404 no formato REAL Easypanel (não YAML http.routers).
#
# O main.yaml do Easypanel usa chaves "https-waba_bets_pv-0", não bloco http: no final.
# Backend do Traefik (container): 172.17.0.1:30211 — NÃO 127.0.0.1.
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/bet-watchdog-vps.sh" -o /root/bet-watchdog-vps.sh
#   sed -i 's/\r$//' /root/bet-watchdog-vps.sh && chmod +x /root/bet-watchdog-vps.sh
#   /root/bet-watchdog-vps.sh          # corrige se necessário
#   /root/bet-watchdog-vps.sh install    # cron a cada 2 min
#
# Versão: bet-watchdog-2026-07-09-v1
set -euo pipefail

VERSION="bet-watchdog-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/bet-watchdog.log"
INSTALL="/root/bet-watchdog-vps.sh"
CRON="/etc/cron.d/bet-watchdog"

BETS_PUB="bet.waba.info"
BETS_EP="waba-bets-pv.achpyp.easypanel.host"
BETS_SWARM="waba_bets_pv"
BETS_URL="http://172.17.0.1:30211/"
RULE="(Host(\`${BETS_EP}\`) || Host(\`${BETS_PUB}\`)) && PathPrefix(\`/\`)"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

probe_public() {
  http_code --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/"
}

probe_local() {
  http_code "http://127.0.0.1:30211/"
}

patch_main() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 1; }
  cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

  python3 - "$CFG" "$BETS_URL" "$BETS_EP" "$BETS_PUB" "$BETS_SWARM" "$RULE" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url = sys.argv[2].rstrip("/") + "/"
bets_ep, bets_pub, bets_swarm, rule = sys.argv[3:7]
text = path.read_text(encoding="utf-8")

# --- 1) Remover bet.waba.info de routers que NÃO são bets ---
router_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    brace = text.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[m.start():end]
    kl = key.lower()
    is_bets = "bets" in kl and ("bets_pv" in kl or "bets-pv" in kl or "bets_pv" in kl)
    if bets_pub in block and not is_bets:
        nb = block
        nb = re.sub(rf"\s*\|\|\s*Host\(`{re.escape(bets_pub)}`\)", "", nb)
        nb = re.sub(rf"Host\(`{re.escape(bets_pub)}`\)\s*\|\|\s*", "", nb)
        nb = nb.replace(f"Host(`{bets_pub}`)", "")
        nb = re.sub(r"\(\s*\|\|", "(", nb)
        nb = re.sub(r"\|\|\s*\)", ")", nb)
        nb = re.sub(r"\(\s*\)", "(Host(`__NEVER__`))", nb)
        nb = nb.replace("(Host(`__NEVER__`))", "Host(`" + bets_ep + "`)")
        if nb != block:
            print(f"LIMPO {bets_pub} de {key}")
            text = text[: m.start()] + nb + text[end:]
            pos = m.start() + len(nb)
            continue
    pos = end

# --- 2) Substituir backends errados (global) ---
for old in (
    "http://tasks.waba_bets_pv:3000/",
    "http://waba_bets_pv:3000/",
    "http://127.0.0.1:30211/",
    "http://127.0.0.1:30211",
):
    if old in text and old.rstrip("/") + "/" != url:
        text = text.replace(old, url)
        print(f"backend {old} -> {url}")

# --- 3) Atualizar rule/priority em routers bets existentes ---
for prefix in ("http", "https"):
    pat = rf'("{prefix}-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{rule}\2", text, flags=re.I)
    if n:
        print(f"rule {prefix}-bets atualizada ({n}x)")
    pri_pat = rf'("{prefix}-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{[\s\S]*?"priority"\s*:\s*)\d+'
    text, n2 = re.subn(pri_pat, r"\g<1>1000", text, flags=re.I)
    if n2:
        print(f"priority {prefix}-bets -> 1000 ({n2}x)")

# --- 4) Service waba_bets_pv-0 ---
svc_keys = (f"{bets_swarm}-0", "waba-bets-pv-0", "waba_bets_pv-0")
for sk in svc_keys:
    pat = rf'("{re.escape(sk)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    if n:
        print(f"service {sk} -> {url}")
        break

# --- 5) Criar blocos se router HTTPS bets com Host público não existir ---
has_https_bets = bool(
    re.search(
        rf'"https-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{[\s\S]*?Host\(`{re.escape(bets_pub)}`\)',
        text,
        re.I,
    )
)
if not has_https_bets:
    http_router = f'''
      "http-{bets_swarm}-0": {{
        "entryPoints": ["http"],
        "service": "{bets_swarm}-0",
        "rule": "{rule}",
        "priority": 1000
      }}'''
    https_router = f'''
      "https-{bets_swarm}-0": {{
        "entryPoints": ["https"],
        "service": "{bets_swarm}-0",
        "rule": "{rule}",
        "priority": 1000,
        "tls": {{
          "domains": [
            {{
              "main": "{bets_ep}",
              "sans": ["{bets_pub}"]
            }}
          ]
        }}
      }}'''
    service_block = f'''
      "{bets_swarm}-0": {{
        "loadBalancer": {{
          "servers": [{{"url": "{url}"}}],
          "passHostHeader": true
        }}
      }}'''

    anchor = None
    for cand in (
        '"https-waba_paginadevendas-0"',
        '"https-typebot_paginadevendas-0"',
        '"https-waba_bets_pv-0"',
    ):
        if cand in text:
            anchor = cand
            break
    if not anchor:
        print("ERRO: âncora para inserir bets ausente")
        sys.exit(2)

    idx = text.find(anchor)
    brace_start = text.find("{", idx)
    depth, end = 0, brace_start
    for i, ch in enumerate(text[brace_start:], brace_start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    text = text[:end] + "," + http_router + "," + https_router + text[end:]
    print(f"CRIADO http/https-{bets_swarm}-0")

    if f'"{bets_swarm}-0"' not in text:
        m = re.search(
            rf'"{re.escape("waba_paginadevendas")}-0"\s*:\s*\{{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}}',
            text,
        )
        if m:
            text = text[: m.end()] + "," + service_block + text[m.end() :]
            print(f"CRIADO service {bets_swarm}-0")

if f"Host(`{bets_pub}`)" not in text:
    print(f"ERRO: {bets_pub} ainda ausente após patch")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("main.yaml OK")
PY
}

reload_traefik() {
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$cid" ]] || { log "ERRO: Traefik down"; return 1; }
  docker kill -s HUP "$cid" >/dev/null 2>&1 || true
  sleep 8
  log "HUP ${cid:0:12}"
}

run_watchdog() {
  mkdir -p "$(dirname "$LOG")"
  local local_code public_code
  local_code=$(probe_local)
  public_code=$(probe_public)

  log "=== $VERSION local=${local_code} public=${public_code} ==="

  if [[ ! "$local_code" =~ ^(200|301|302|304)$ ]]; then
    log "App local :30211 indisponível ($local_code) — sem patch Traefik"
    exit 1
  fi

  if [[ "$public_code" =~ ^(200|301|302|304)$ ]]; then
    log "bet.waba.info OK"
    exit 0
  fi

  log "bet.waba.info=$public_code — aplicando patch Easypanel"
  patch_main || exit 1
  reload_traefik || exit 1

  public_code=$(probe_public)
  log "após patch: bet.waba.info=$public_code"
  grep -n "bet\.waba\|bets_pv" "$CFG" | head -15 | tee -a "$LOG" || true

  [[ "$public_code" =~ ^(200|301|302|304)$ ]] || exit 1
}

install_cron() {
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  cp "$src" "$INSTALL"
  sed -i 's/\r$//' "$INSTALL" 2>/dev/null || true
  chmod +x "$INSTALL"
  cat >"$CRON" <<EOF
# bet.waba.info watchdog — só patch se local OK e HTTPS != 200
*/2 * * * * root ${INSTALL} run >> ${LOG} 2>&1
EOF
  chmod 644 "$CRON"
  log "cron instalado: $CRON (a cada 2 min)"
  run_watchdog
}

case "${1:-run}" in
  run) run_watchdog ;;
  install) install_cron ;;
  *)
    echo "Uso: $0 run | install"
    exit 1
    ;;
esac
