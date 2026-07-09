#!/bin/bash
# Repara main.yaml CORROMPIDO + recarrega Traefik (sem API 8080).
# Sintoma: HTTPS "404 page not found" em TODOS os domínios = routers não carregados.
# Causa típica: timer walkup-evo + patches quebraram JSON (ex. linha "waba_bets_pv-0", + "rule").
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-rebuild-landings-clean-vps.sh" -o /tmp/rebuild.sh
#   sed -i 's/\r$//' /tmp/rebuild.sh && bash /tmp/rebuild.sh
#
# Versão: traefik-rebuild-landings-clean-2026-07-09-v1
set -euo pipefail

VERSION="traefik-rebuild-landings-clean-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/traefik-rebuild-landings-clean.log"
GW="172.17.0.1"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== $VERSION ==="

# 1) Parar TODA automação que reescreve main.yaml
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-walkup-evo-fix.timer traefik-permanent-walkup-evo-watch.service \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-waba-fix.timer traefik-permanent-waba-watch.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers/guard OFF"

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

python3 - "$CFG" "$GW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
gw = sys.argv[2]
text = path.read_text(encoding="utf-8")

PV_URL = f"http://{gw}:30210/"
BETS_URL = f"http://{gw}:30211/"
PV_PUB = "wabadisparos.com.br"
BETS_PUB = "bet.waba.info"
PV_EP = "waba-paginadevendas.achpyp.easypanel.host"
BETS_EP = "waba-bets-pv.achpyp.easypanel.host"
PV_SWARM = "waba_paginadevendas"
BETS_SWARM = "waba_bets_pv"
BETS_RULE = f"(Host(`{BETS_EP}`) || Host(`{BETS_PUB}`)) && PathPrefix(`/`)"
PV_RULE = f"(Host(`{PV_EP}`) || Host(`{PV_PUB}`)) && PathPrefix(`/`)"

# Remove middlewares de emergência que podem ter quebrado o JSON
for junk in (
    "bet-emergency-replace-bets-path",
    "bet-emergency-redirect-bets",
):
    text = re.sub(
        rf'\s*"{re.escape(junk)}"\s*:\s*\{{[\s\S]*?\n      \}},?',
        "",
        text,
        count=1,
    )
    text = text.replace(f'"{junk}"', "")

# Remove fragmentos órfãos: "waba_bets_pv-0", seguido de "rule" (router corrompido)
text, n_orphan = re.subn(
    r'\s*"waba_bets_pv-0"\s*,\s*\n\s*"rule"\s*:',
    '\n      "__ORPHAN_RULE_PLACEHOLDER__":',
    text,
)
if n_orphan:
    print(f"removido fragmento órfão waba_bets_pv-0+rule ({n_orphan}x)")
    text = re.sub(r'\s*"__ORPHAN_RULE_PLACEHOLDER__"\s*:\s*"[^"]+",?\n?', "", text)

def replace_router_block(swarm: str, http_block: str, https_block: str) -> None:
    global text
    for prefix in ("http", "https"):
        pat = rf'"{prefix}-{re.escape(swarm)}[^"]*"\s*:\s*\{{[\s\S]*?\n      \}},?'
        block = http_block if prefix == "http" else https_block
        if re.search(pat, text):
            text, n = re.subn(pat, block.rstrip(","), text, count=1)
            print(f"router {prefix}-{swarm} reconstruído ({n})")
        else:
            print(f"AVISO: {prefix}-{swarm} ausente — inserir manualmente")

HTTP_BETS = f'''      "http-{BETS_SWARM}-0": {{
        "entryPoints": ["web"],
        "service": "{BETS_SWARM}-0",
        "rule": "{BETS_RULE}",
        "priority": 1000
      }}'''

HTTPS_BETS = f'''      "https-{BETS_SWARM}-0": {{
        "entryPoints": ["websecure"],
        "service": "{BETS_SWARM}-0",
        "rule": "{BETS_RULE}",
        "priority": 1000,
        "tls": {{
          "domains": [{{ "main": "{BETS_EP}", "sans": ["{BETS_PUB}"] }}]
        }}
      }}'''

HTTP_PV = f'''      "http-{PV_SWARM}-0": {{
        "entryPoints": ["web"],
        "service": "{PV_SWARM}-0",
        "rule": "{PV_RULE}",
        "priority": 1000
      }}'''

HTTPS_PV = f'''      "https-{PV_SWARM}-0": {{
        "entryPoints": ["websecure"],
        "service": "{PV_SWARM}-0",
        "rule": "{PV_RULE}",
        "priority": 1000,
        "tls": {{
          "domains": [{{ "main": "{PV_EP}", "sans": ["{PV_PUB}"] }}]
        }}
      }}'''

replace_router_block(BETS_SWARM, HTTP_BETS, HTTPS_BETS)
replace_router_block(PV_SWARM, HTTP_PV, HTTPS_PV)

def fix_service(key: str, url: str) -> None:
    global text
    svc = f'''      "{key}": {{
        "loadBalancer": {{
          "servers": [{{ "url": "{url}" }}],
          "passHostHeader": true
        }}
      }}'''
    pat = rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n      \}},?'
    if re.search(pat, text):
        text, n = re.subn(pat, svc.rstrip(","), text, count=1)
        print(f"service {key} -> {url} ({n})")
    else:
        # inserir antes do fechamento do objeto http (último service conhecido)
        anchor = f'"{BETS_SWARM}-0"'
        if anchor in text:
            idx = text.rfind(f'"{BETS_SWARM}-0"')
            brace = text.find("{", idx)
            depth, end = 0, brace
            for i, ch in enumerate(text[brace:], brace):
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            text = text[:end] + ",\n" + svc + text[end:]
            print(f"service {key} CRIADO -> {url}")

for k, u in (
    (f"{BETS_SWARM}-0", BETS_URL),
    (f"{BETS_SWARM}-1", BETS_URL),
    (f"{PV_SWARM}-0", PV_URL),
    (f"{PV_SWARM}-1", PV_URL),
):
    if f'"{k}"' in text:
        pat = rf'("{re.escape(k)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
        text, n = re.subn(pat, rf"\g<1>{u}\2", text, count=1)
        if n:
            print(f"url patch {k} -> {u}")

fix_service(f"{BETS_SWARM}-0", BETS_URL)
fix_service(f"{PV_SWARM}-0", PV_URL)

# Limpar vírgulas duplas / trailing
text = re.sub(r",\s*,", ",", text)
text = re.sub(r",\s*\n\s*\}", "\n      }", text)

# Validação mínima: chaves balanceadas
if text.count("{") != text.count("}"):
    print(f"ERRO: chaves desbalanceadas {{={text.count('{')} }}={text.count('}')}")
    sys.exit(2)

if f"Host(`{BETS_PUB}`)" not in text or f"Host(`{PV_PUB}`)" not in text:
    print("ERRO: Host público ausente após rebuild")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("main.yaml rebuild OK")
PY

# 2) Recarregar Traefik (file provider watch + HUP)
CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$CID" ]] || { log "ERRO: Traefik down"; exit 1; }

touch "$CFG"
docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 12
log "HUP Traefik ${CID:0:12}"

# 3) Validar
for host in bet.waba.info wabadisparos.com.br; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
    --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null || echo "000")
  body=$(curl -sS --max-time 12 --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null | head -c 120 || true)
  log "${host} -> ${code} | ${body}"
done

log "=== fim $VERSION ==="
