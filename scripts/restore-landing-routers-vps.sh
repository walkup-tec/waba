#!/bin/bash
# Landings wabadisparos.com.br + bet.waba.info — patch no formato REAL do Easypanel Traefik.
#
# Base: https://doc.traefik.io/traefik/ (Router, Rules Host/||, File provider, ACME Host()+tls.domains)
# Realidade VPS srv1261237:
# - main.yaml Easypanel: chaves "https-SERVICE-0" / "SERVICE-0" com rule Host(...) && PathPrefix(`/`)
# - custom.yaml = só estático (accessLog/api) — NÃO colocar routers dinâmicos lá
# - Overlay tasks.* costuma falhar → backend preferir 172.17.0.1:PORTA (já publicada)
# - NUNCA publish em porta ocupada; NUNCA kill docker-proxy se Traefik 1/1 + :443
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" -o /root/restore-landing-routers-vps.sh
#   sed -i 's/\r$//' /root/restore-landing-routers-vps.sh && chmod +x /root/restore-landing-routers-vps.sh
#   /root/restore-landing-routers-vps.sh
#
# Versão: restore-landing-routers-2026-07-09-v7
set -euo pipefail

RESTORE_VERSION="restore-landing-routers-2026-07-10-v9"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
CUSTOM="/etc/easypanel/traefik/config/custom.yaml"
LOG="${RESTORE_LANDING_LOG:-/var/log/restore-landing-routers.log}"
BOOTSTRAP="/root/traefik-easypanel-bootstrap-vps.sh"
HOST_GW="${TRAEFIK_HOST_GW:-172.17.0.1}"

PV_SWARM="waba_paginadevendas"
BETS_SWARM="waba_bets_pv"
PV_EP="waba-paginadevendas.achpyp.easypanel.host"
BETS_EP="waba-bets-pv.achpyp.easypanel.host"
PV_PUB="wabadisparos.com.br"
BETS_PUB="bet.waba.info"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

require_root() { [[ "$(id -u)" -eq 0 ]] || { echo "ERRO: root"; exit 1; }; }

traefik_ok() {
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$cid" ]] && ss -tln | grep -q ':443 '
}

ensure_traefik() {
  local i
  if traefik_ok; then log "Traefik OK"; return 0; fi
  log "Traefik down — bootstrap"
  [[ -x "$BOOTSTRAP" ]] && bash "$BOOTSTRAP" run >>"$LOG" 2>&1 || true
  for i in $(seq 1 20); do traefik_ok && { log "Traefik OK (bootstrap)"; return 0; }; sleep 3; done
  timeout 60 docker service update --detach=true --force easypanel-traefik >>"$LOG" 2>&1 || true
  for i in $(seq 1 25); do traefik_ok && { log "Traefik OK (force)"; return 0; }; sleep 3; done
  log "ERRO: Traefik não subiu"; exit 1
}

http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

published_ports() {
  docker service inspect "$1" --format '{{range .Endpoint.Ports}}{{.PublishedPort}}{{println}}{{end}}' 2>/dev/null \
    | grep -E '^[0-9]+$' | sort -u
}

pick_backend() {
  local swarm="$1" p code
  for p in $(published_ports "$swarm"); do
    code=$(http_code "http://127.0.0.1:${p}/")
    if [[ "$code" =~ ^(200|301|302|304)$ ]]; then
      echo "http://${HOST_GW}:${p}/"
      return 0
    fi
  done
  echo ""
  return 1
}

reload_hup() {
  # Neste VPS HUP frequentemente derruba :443. Preferir file provider watch.
  if [[ "${FORCE_TRAEFIK_HUP:-0}" != "1" ]]; then
    log "reload: file watch (~12s) — sem HUP (FORCE_TRAEFIK_HUP=1 para forçar)"
    sleep 12
    return 0
  fi
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$cid" ]] || return 1
  docker kill -s HUP "$cid" >/dev/null 2>&1 || true
  sleep 5
  log "HUP ${cid:0:12}"
}

strip_bad_custom() {
  [[ -f "$CUSTOM" ]] || return 0
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/easypanel/traefik/config/custom.yaml")
t = p.read_text(encoding="utf-8")
m = "# WABA_LANDINGS_MERGE"
if m in t:
    p.write_text(t.split(m)[0].rstrip() + "\n", encoding="utf-8")
    print("removido WABA_LANDINGS_MERGE do custom.yaml")
# se custom.yaml tiver bloco http: routers (arquivo só deveria ter accessLog/api)
if "waba-landing-" in t or ("\nhttp:" in t and "routers:" in t and "accessLog" in t):
    # remove qualquer seção http: dinâmica residual; mantém accessLog/log/api
    lines = []
    skip = False
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("http:"):
            skip = True
            continue
        if skip:
            if line and not line.startswith(" ") and not line.startswith("\t") and not line.startswith("#"):
                skip = False
            else:
                continue
        if not skip:
            lines.append(line)
    p.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print("limpo http: dinâmico inválido do custom.yaml")
PY
}

patch_main() {
  local pv_url="${1:-}" bets_url="${2:-}"
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
  cp -a "$CFG" "${CFG}.bak-landing-v6-$(date +%Y%m%d-%H%M%S)"

  python3 - "$CFG" "$PV_EP" "$PV_PUB" "$BETS_EP" "$BETS_PUB" \
    "$PV_SWARM" "$BETS_SWARM" "$pv_url" "$bets_url" <<'PY'
import re, sys
from pathlib import Path

(
    path, pv_ep, pv_pub, bets_ep, bets_pub,
    pv_swarm, bets_swarm, pv_url, bets_url,
) = sys.argv[1:10]

text = Path(path).read_text(encoding="utf-8")


def inject_or_host(text: str, easypanel: str, public: str) -> str:
    if f"Host(`{public}`)" in text:
        print(f"OK Host(`{public}`) já presente")
        return text
    old = f"Host(`{easypanel}`) && PathPrefix(`/`)"
    new = f"(Host(`{easypanel}`) || Host(`{public}`)) && PathPrefix(`/`)"
    if old in text:
        print(f"INJETADO {public} → regra {easypanel}")
        return text.replace(old, new)
    old2 = f"Host(`{easypanel}`)"
    new2 = f"(Host(`{easypanel}`) || Host(`{public}`))"
    if old2 in text:
        print(f"INJETADO fallback {public}")
        return text.replace(old2, new2)
    print(f"FALHA: regra {easypanel} ausente")
    return text


def add_tls_san(text: str, easypanel: str, public: str) -> str:
    pat = rf'("main"\s*:\s*"{re.escape(easypanel)}"\s*,\s*"sans"\s*:\s*\[)([^\]]*)(\])'

    def repl(m: re.Match) -> str:
        inner = m.group(2).strip()
        if f'"{public}"' in inner:
            return m.group(0)
        if not inner:
            return f'{m.group(1)}"{public}"{m.group(3)}'
        return f'{m.group(1)}{inner.rstrip()}, "{public}"{m.group(3)}'

    new, n = re.subn(pat, repl, text)
    if n:
        print(f"TLS SAN {public} ({n}x)")
        return new
    print(f"AVISO tls.domains {easypanel} não encontrado (ACME usa Host() da rule)")
    return text


def fix_url(text: str, swarm: str, url: str) -> str:
    if not url or not url.startswith("http://172.17.0.1:"):
        print(f"skip backend {swarm} url={url!r}")
        return text
    changed = 0
    for key in (f"{swarm}-0", f"{swarm}-1", f"{swarm}-2", swarm):
        pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
        text, n = re.subn(pat, rf"\g<1>{url}\2", text)
        if n:
            print(f"backend {key} -> {url}")
            changed += n
    for old in (f"http://tasks.{swarm}:3000/", f"http://{swarm}:3000/"):
        if old in text and old != url:
            text = text.replace(old, url)
            print(f"replace global {old} -> {url}")
            changed += 1
    return text


def clone_bets_if_missing(text: str) -> str:
    has_https_router = bool(
        re.search(rf'"https-{re.escape(bets_swarm)}[^"]*"\s*:\s*\{{[\s\S]*?Host\(`{re.escape(bets_pub)}`\)', text)
    )
    if has_https_router:
        print("bets_pv router HTTPS com Host público já presente")
        return text
    # Template mínimo no formato Easypanel (espelha paginadevendas)
    backend = bets_url if bets_url.startswith("http://172.17.0.1:") else f"http://tasks.{bets_swarm}:3000/"
    http_router = f'''
      "http-{bets_swarm}-0": {{
        "entryPoints": [
          "http"
        ],
        "service": "{bets_swarm}-0",
        "rule": "(Host(`{bets_ep}`) || Host(`{bets_pub}`)) && PathPrefix(`/`)",
        "priority": 11
      }}'''
    https_router = f'''
      "https-{bets_swarm}-0": {{
        "entryPoints": [
          "https"
        ],
        "service": "{bets_swarm}-0",
        "rule": "(Host(`{bets_ep}`) || Host(`{bets_pub}`)) && PathPrefix(`/`)",
        "priority": 11,
        "tls": {{
          "domains": [
            {{
              "main": "{bets_ep}",
              "sans": ["{bets_pub}"]
            }}
          ]
        }}
      }}'''
    service = f'''
      "{bets_swarm}-0": {{
        "loadBalancer": {{
          "servers": [
            {{
              "url": "{backend}"
            }}
          ],
          "passHostHeader": true
        }}
      }}'''

    # Insere routers após âncora paginadevendas (waba ou typebot)
    anchor = None
    for cand in (f'"https-{pv_swarm}-0"', '"https-typebot_paginadevendas-0"', '"https-waba_paginadevendas-0"'):
        if cand in text:
            anchor = cand
            break
    if anchor is None:
        print("ERRO: âncora https paginadevendas ausente — não clonei bets")
        return text
    idx = text.find(anchor)
    # achar fim do objeto desse router (linha "      }," após o bloco)
    # encontrar após o key, o matching closing brace do objeto
    brace_start = text.find("{", idx)
    depth = 0
    end = brace_start
    for i, ch in enumerate(text[brace_start:], brace_start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    insert_pos = end
    # pular vírgula se houver
    j = insert_pos
    while j < len(text) and text[j] in " \t\r\n":
        j += 1
    text = text[:insert_pos] + "," + http_router + "," + https_router + text[insert_pos:]

    # Insere service após waba_paginadevendas-0 no loadBalancer section
    svc_anchor = f'"{pv_swarm}-0"'
    # preferir a ocorrência em services (com loadBalancer)
    m = re.search(rf'"{re.escape(pv_swarm)}-0"\s*:\s*\{{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}}', text)
    if m:
        pos = m.end()
        text = text[:pos] + "," + service + text[pos:]
        print(f"CRIADO routers+service {bets_swarm}-0 backend={backend}")
    else:
        print("AVISO: service paginadevendas não encontrado para inserir bets service")
    return text


text = inject_or_host(text, pv_ep, pv_pub)
text = clone_bets_if_missing(text)
text = inject_or_host(text, bets_ep, bets_pub)
text = add_tls_san(text, pv_ep, pv_pub)
text = add_tls_san(text, bets_ep, bets_pub)
text = fix_url(text, pv_swarm, pv_url)
text = fix_url(text, bets_swarm, bets_url)

Path(path).write_text(text, encoding="utf-8")
for n in (pv_pub, bets_pub, pv_ep, bets_ep, f"{bets_swarm}-0"):
    print(f"  contains {n}: {n in text}")
PY
}

validate() {
  log "=== validação ==="
  log "  waba → $(http_code --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health)"
  log "  pv easypanel → $(http_code --resolve ${PV_EP}:443:127.0.0.1 https://${PV_EP}/)"
  log "  ${PV_PUB} → $(http_code --resolve ${PV_PUB}:443:127.0.0.1 https://${PV_PUB}/)"
  log "  ${BETS_PUB} → $(http_code --resolve ${BETS_PUB}:443:127.0.0.1 https://${BETS_PUB}/)"
  local p
  for p in $(published_ports "$PV_SWARM"); do log "  PV :${p} → $(http_code http://127.0.0.1:${p}/)"; done
  for p in $(published_ports "$BETS_SWARM"); do log "  BETS :${p} → $(http_code http://127.0.0.1:${p}/)"; done
  grep -n "wabadisparos\|bet\.waba\|bets_pv" "$CFG" | head -20 | tee -a "$LOG" || true
}

main() {
  require_root
  mkdir -p "$(dirname "$LOG")"
  log "=== ${RESTORE_VERSION} início ==="
  ensure_traefik
  strip_bad_custom

  log "preflight services:"
  docker service ls --format '{{.Name}} {{.Replicas}}' | grep -E 'traefik|paginadevendas|bets_pv' | tee -a "$LOG" || true

  local pv_url bets_url
  pv_url=$(pick_backend "$PV_SWARM" || true)
  bets_url=$(pick_backend "$BETS_SWARM" || true)
  log "backend PV=${pv_url:-AUSENTE}"
  log "backend BETS=${bets_url:-AUSENTE}"

  patch_main "${pv_url:-}" "${bets_url:-}"
  reload_hup
  validate
  log "=== ${RESTORE_VERSION} fim ==="
}

main "$@"
