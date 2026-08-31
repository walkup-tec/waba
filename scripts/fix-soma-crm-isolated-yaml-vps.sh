#!/bin/bash
# Isola Soma CRM em /etc/easypanel/traefik/config/soma-crm.yaml
# Remove chaves Soma do main.yaml — NÃO toca WABA / Sinal Verde / custom.
#
# Doc: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#      https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
# REGISTRY: SOMA-EASYPANEL-REWRITE — backend 172.17.0.1:30300, Host sem barra
#
# Uso: bash /tmp/fix-soma-crm-isolated-yaml-vps.sh
# Versão: fix-soma-crm-isolated-yaml-2026-07-20-v1
set -euo pipefail

VERSION="fix-soma-crm-isolated-yaml-2026-07-20-v1"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SOMA_YAML="${CFG_DIR}/soma-crm.yaml"
HOST_PORT=30300
URL="http://172.17.0.1:${HOST_PORT}/"
DOMAIN="app.somaconecta.com.br"
LOG="/var/log/fix-soma-crm-isolated-yaml.log"
TS="$(date +%Y%m%d%H%M%S)"

[[ "$(id -u)" -eq 0 ]] || { echo "root only"; exit 1; }
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || echo 000; }

log "=== start ==="

# Descobrir serviço Swarm do CRM
CRM=""
for cand in soma-promotora_gestao-interno soma-promotora_gestao soma_gestao-interno; do
  if docker service ls --format '{{.Name}}' | grep -qx "$cand"; then
    CRM="$cand"
    break
  fi
done
if [[ -z "$CRM" ]]; then
  CRM=$(docker service ls --format '{{.Name}}' | grep -iE 'soma.*gestao|gestao-interno' | head -1 || true)
fi
log "CRM_SERVICE=${CRM:-MISSING}"

if [[ -n "${CRM:-}" ]]; then
  ports=$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo '[]')
  if ! echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    log "publish :${HOST_PORT}→3000"
    docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
    timeout 90 docker service update \
      --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
      "$CRM" || true
    sleep 4
  fi
fi
log "local :${HOST_PORT}/api/health=$(http_code "http://127.0.0.1:${HOST_PORT}/api/health")"
log "local :${HOST_PORT}/=$(http_code "http://127.0.0.1:${HOST_PORT}/")"

CERT_RESOLVER=$(docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE '^TRAEFIK_CERTIFICATESRESOLVERS_' \
  | head -1 \
  | sed -E 's/^TRAEFIK_CERTIFICATESRESOLVERS_([^_]+)_.*/\1/i' \
  | tr '[:upper:]' '[:lower:]' || true)
[[ -n "$CERT_RESOLVER" ]] || CERT_RESOLVER="letsencrypt"
log "certResolver=${CERT_RESOLVER}"

# Domínios extras: www + hosts easypanel que já estejam no main (Host\`...\`)
EXTRA_HOSTS=""
if [[ -f "$MAIN" ]]; then
  EXTRA_HOSTS=$(grep -oE 'Host\(`[^`]+`\)' "$MAIN" 2>/dev/null \
    | sed -E 's/Host\(`([^`]+)`\)/\1/' \
    | grep -iE 'somaconecta|soma-promotora' \
    | grep -viE '/$' \
    | sort -u | tr '\n' ' ' || true)
fi
log "hosts_extra=${EXTRA_HOSTS:-none}"

cp -a "$SOMA_YAML" "${SOMA_YAML}.bak-${TS}" 2>/dev/null || true
[[ -f "$MAIN" ]] && cp -a "$MAIN" "${MAIN}.bak-strip-soma-${TS}" || true

# Pré-check WABA + SV + Soma (não aborta se Soma ainda 404 — vamos curar)
log "pre: disparos=$(http_code https://wabadisparos.com.br/) bet=$(http_code https://bet.waba.info/) health=$(http_code https://waba.draxsistemas.com.br/health) sv=$(http_code https://acesso-sinalverde.com/) soma=$(http_code https://${DOMAIN}/) soma_h=$(http_code https://${DOMAIN}/api/health)"

python3 - "$SOMA_YAML" "$URL" "$DOMAIN" "$CERT_RESOLVER" "$EXTRA_HOSTS" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
url, domain, resolver = sys.argv[2:5]
extra = [h.strip() for h in (sys.argv[5] if len(sys.argv) > 5 else "").split() if h.strip()]
hosts = []
for h in [domain, f"www.{domain}"] + extra:
    if h and h not in hosts and not h.endswith("/"):
        hosts.append(h)
rule = " || ".join(f"Host(`{h}`)" for h in hosts)
tls = {"domains": [{"main": domain, "sans": [h for h in hosts if h != domain][:10]}]}
if resolver:
    tls["certResolver"] = resolver

svc0 = "soma-promotora_gestao-interno-0"
svc1 = "soma-promotora_gestao-interno-1"
data = {
    "http": {
        "middlewares": {
            "soma-redirect-https": {
                "redirectScheme": {"scheme": "https", "permanent": True}
            }
        },
        "routers": {
            f"http-{svc0}": {
                "entryPoints": ["http"],
                "middlewares": ["soma-redirect-https"],
                "service": svc0,
                "rule": rule,
                "priority": 1000,
            },
            f"https-{svc0}": {
                "entryPoints": ["https"],
                "service": svc0,
                "rule": rule,
                "priority": 1000,
                "tls": tls,
            },
        },
        "services": {
            svc0: {
                "loadBalancer": {
                    "servers": [{"url": url}],
                    "passHostHeader": True,
                }
            },
            svc1: {
                "loadBalancer": {
                    "servers": [{"url": url}],
                    "passHostHeader": True,
                }
            },
        },
    }
}
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {path}")
print(f"rule={rule}")
PY

# Strip chaves Soma do main (não WABA / não SV)
if [[ -f "$MAIN" ]] && grep -qiE 'soma-promotora|gestao-interno|somaconecta|soma_crm|soma-crm' "$MAIN"; then
  python3 - "$MAIN" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    print("ABORT braces"); sys.exit(2)

def is_soma_key(key: str) -> bool:
    k = key.lower()
    if "waba_" in k or "sinal-verde" in k or "acesso-sinalverde" in k:
        return False
    return (
        "soma-promotora" in k
        or "gestao-interno" in k
        or "somaconecta" in k
        or "soma_crm" in k
        or "soma-crm" in k
        or k.startswith("http-soma")
        or k.startswith("https-soma")
    )

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1], start, i + 1
    raise RuntimeError("unbalanced")

key_re = re.compile(r'"([^"]+)"\s*:\s*\{')
found = []
i = 0
while i < len(text):
    if text[i] == '"':
        m = key_re.match(text, i)
        if m and is_soma_key(m.group(1)):
            block, a, b = extract_block(text, i)
            found.append((m.group(1), a, b))
            i = b
            continue
    i += 1

new = text
for key, a, b in sorted(found, key=lambda x: x[1], reverse=True):
    start, end = a, b
    j = end
    while j < len(new) and new[j] in " \t\r\n":
        j += 1
    if j < len(new) and new[j] == ",":
        end = j + 1
    else:
        k = start - 1
        while k >= 0 and new[k] in " \t\r\n":
            k -= 1
        if k >= 0 and new[k] == ",":
            start = k
    new = new[:start] + new[end:]
    print(f"stripped={key}")

if new.count("{") != new.count("}"):
    print("ABORT braces after"); sys.exit(2)
if "waba_" not in new and "wabadisparos" not in new:
    print("ABORT WABA markers gone"); sys.exit(3)
path.write_text(new, encoding="utf-8")
print(f"stripped_count={len(found)}")
PY
else
  log "main sem chaves Soma óbvias — skip strip (yaml isolado já escrito)"
fi

log "aguardando file watch ~12s"
sleep 12

d=$(http_code "https://wabadisparos.com.br/")
b=$(http_code "https://bet.waba.info/")
h=$(http_code "https://waba.draxsistemas.com.br/health")
sv=$(http_code "https://acesso-sinalverde.com/")
s=$(http_code "https://${DOMAIN}/")
sh=$(http_code "https://${DOMAIN}/api/health")
log "disparos=${d} bet=${b} health=${h} sv=${sv} soma=${s} soma_health=${sh}"

if [[ "$d" != "200" || "$b" != "200" || "$h" != "200" ]]; then
  log "ERRO WABA — restaurando main"
  [[ -f "${MAIN}.bak-strip-soma-${TS}" ]] && cp -a "${MAIN}.bak-strip-soma-${TS}" "$MAIN"
  exit 3
fi

# Se Soma falhar, tentar tls sem certResolver
if [[ "$sh" != "200" && "$s" != "200" && "$s" != "301" && "$s" != "302" && "$s" != "307" && "$s" != "308" ]]; then
  log "Soma ainda ruim — rewrite tls só domains"
  python3 - "$SOMA_YAML" "$URL" "$DOMAIN" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
url, domain = sys.argv[2:4]
rule = f"Host(`{domain}`) || Host(`www.{domain}`)"
svc0 = "soma-promotora_gestao-interno-0"
data = {
  "http": {
    "middlewares": {
      "soma-redirect-https": {"redirectScheme": {"scheme": "https", "permanent": True}}
    },
    "routers": {
      f"http-{svc0}": {
        "entryPoints": ["http"],
        "middlewares": ["soma-redirect-https"],
        "service": svc0,
        "rule": rule,
        "priority": 1000,
      },
      f"https-{svc0}": {
        "entryPoints": ["https"],
        "service": svc0,
        "rule": rule,
        "priority": 1000,
        "tls": {"domains": [{"main": domain}]},
      },
    },
    "services": {
      svc0: {"loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}},
      "soma-promotora_gestao-interno-1": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
    },
  }
}
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("rewrote")
PY
  sleep 12
  s=$(http_code "https://${DOMAIN}/")
  sh=$(http_code "https://${DOMAIN}/api/health")
  log "soma_retry=${s} health_retry=${sh}"
fi

ok=0
[[ "$sh" == "200" || "$s" == "200" || "$s" == "307" || "$s" == "301" || "$s" == "302" ]] && ok=1
grep -qiE 'soma-promotora|gestao-interno|somaconecta' "$MAIN" 2>/dev/null \
  && log "WARN: main ainda menciona Soma" || log "main: limpo Soma"
log "DONE ok=${ok} soma=${s} soma_health=${sh} file=${SOMA_YAML}"
[[ "$ok" -eq 1 ]] || exit 4
echo "soma=${s} soma_health=${sh}"
