#!/bin/bash
# Corrige sinal-verde.yaml no formato Traefik dinâmico real (http.routers/services)
# e remove chaves SV aninhadas do main.yaml — SEM mexer em directory/custom/WABA.
#
# Doc: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#      https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
#
# Uso: bash /tmp/fix-sinal-verde-isolated-yaml-vps.sh
# Versão: fix-sv-isolated-yaml-2026-07-20-v1
set -euo pipefail

VERSION="fix-sv-isolated-yaml-2026-07-20-v1"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SV_YAML="${CFG_DIR}/sinal-verde.yaml"
CUSTOM="${CFG_DIR}/custom.yaml"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
URL="http://172.17.0.1:${HOST_PORT}/"
DOMAIN="acesso-sinalverde.com"
WWW="www.acesso-sinalverde.com"
LOG="/var/log/fix-sinal-verde-isolated-yaml.log"
TS="$(date +%Y%m%d%H%M%S)"

[[ "$(id -u)" -eq 0 ]] || { echo "root only"; exit 1; }
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || echo 000; }

log "=== start ==="

# Restaurar custom.yaml se o split v1 moveu por engano
disabled=$(ls -1t "${CUSTOM}".static-disabled-* 2>/dev/null | head -1 || true)
if [[ ! -f "$CUSTOM" && -n "${disabled:-}" ]]; then
  cp -a "$disabled" "$CUSTOM"
  log "restored custom.yaml from $disabled"
fi

# publish
if docker service ls --format '{{.Name}}' | grep -qx "$CRM"; then
  ports=$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' || echo '[]')
  if ! echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    log "publish :${HOST_PORT}"
    docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
    timeout 90 docker service update \
      --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
      "$CRM" || true
    sleep 4
  fi
fi
log "local :${HOST_PORT}=$(http_code "http://127.0.0.1:${HOST_PORT}/")"

# Detect certResolver (Easypanel)
CERT_RESOLVER=""
CERT_RESOLVER=$(docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE '^TRAEFIK_CERTIFICATESRESOLVERS_[^=]+=' \
  | head -1 \
  | sed -E 's/^TRAEFIK_CERTIFICATESRESOLVERS_([^=]+)=.*/\1/' \
  | tr '[:upper:]' '[:lower:]' || true)
# Fallback comum Easypanel
[[ -n "$CERT_RESOLVER" ]] || CERT_RESOLVER="letsencrypt"
log "certResolver=${CERT_RESOLVER}"

cp -a "$SV_YAML" "${SV_YAML}.bak-format-${TS}" 2>/dev/null || true
[[ -f "$MAIN" ]] && cp -a "$MAIN" "${MAIN}.bak-strip-sv-${TS}" || true

# 1) Escrever sinal-verde.yaml no formato Traefik padrão (http.routers / services)
python3 - "$SV_YAML" "$URL" "$DOMAIN" "$WWW" "$CERT_RESOLVER" <<'PY'
import json, sys
from pathlib import Path
path, url, domain, www, resolver = sys.argv[1:6]
rule = f"Host(`{domain}`) || Host(`{www}`)"
https_tls = {
    "domains": [{"main": domain, "sans": [www]}],
}
if resolver:
    https_tls["certResolver"] = resolver

data = {
    "http": {
        "middlewares": {
            "sv-redirect-https": {
                "redirectScheme": {"scheme": "https", "permanent": True}
            }
        },
        "routers": {
            f"http-sinal-verde_acesso-sinalverde-0": {
                "entryPoints": ["http"],
                "middlewares": ["sv-redirect-https"],
                "service": "sinal-verde_acesso-sinalverde-0",
                "rule": rule,
                "priority": 1000,
            },
            f"https-sinal-verde_acesso-sinalverde-0": {
                "entryPoints": ["https"],
                "service": "sinal-verde_acesso-sinalverde-0",
                "rule": rule,
                "priority": 1000,
                "tls": https_tls,
            },
        },
        "services": {
            "sinal-verde_acesso-sinalverde-0": {
                "loadBalancer": {
                    "servers": [{"url": url}],
                    "passHostHeader": True,
                }
            },
            # réplica -1 às vezes usada pelo Easypanel
            "sinal-verde_acesso-sinalverde-1": {
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
PY

# 2) Remover chaves SV aninhadas em http.routers / http.services / http.middlewares do main.yaml
#    (não toca waba_*; não usa regex atravessando blocos WABA)
if [[ -f "$MAIN" ]] && grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN"; then
  python3 - "$MAIN" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    print("ABORT braces"); sys.exit(2)

def is_sv_key(key: str) -> bool:
    k = key.lower()
    if "waba_" in k:
        return False
    return ("sinal-verde" in k) or ("acesso-sinalverde" in k) or ("sinalverde" in k)

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1], start, i+1
    raise RuntimeError("unbalanced")

key_re = re.compile(r'"([^"]+)"\s*:\s*\{')
# Coletar TODOS os blocos "key": { ... } cujo nome é SV (em qualquer profundidade)
found = []
i = 0
while i < len(text):
    if text[i] == '"':
        m = key_re.match(text, i)
        if m:
            key = m.group(1)
            if is_sv_key(key):
                block, a, b = extract_block(text, i)
                found.append((key, a, b))
                i = b
                continue
    i += 1

# Remover de trás pra frente
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
    print("ABORT braces after strip"); sys.exit(2)
# WABA markers devem continuar
if "waba_" not in new and "wabadisparos" not in new:
    print("ABORT WABA markers gone"); sys.exit(3)
path.write_text(new, encoding="utf-8")
print(f"stripped_count={len(found)}")
PY
else
  log "main.yaml sem menções SV (ou ausente) — skip strip"
fi

log "aguardando file watch ~12s"
sleep 12

d=$(http_code "https://wabadisparos.com.br/")
b=$(http_code "https://bet.waba.info/")
h=$(http_code "https://waba.draxsistemas.com.br/health")
s=$(http_code "https://${DOMAIN}/")
log "disparos=${d} bet=${b} health=${h} sv=${s}"

if [[ "$d" != "200" || "$b" != "200" || "$h" != "200" ]]; then
  log "ERRO WABA — restaurando main do bak"
  [[ -f "${MAIN}.bak-strip-sv-${TS}" ]] && cp -a "${MAIN}.bak-strip-sv-${TS}" "$MAIN"
  exit 3
fi

# Se SV ainda 404, tentar sem certResolver (só domains) — às vezes resolver name diverge
if [[ "$s" != "200" && "$s" != "301" && "$s" != "302" && "$s" != "307" && "$s" != "308" ]]; then
  log "SV ainda ${s} — reescrevendo tls sem certResolver (só domains)"
  python3 - "$SV_YAML" "$URL" "$DOMAIN" "$WWW" <<'PY'
import json, sys
from pathlib import Path
path, url, domain, www = sys.argv[1:5]
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
        "priority": 1000
      },
      "https-sinal-verde_acesso-sinalverde-0": {
        "entryPoints": ["https"],
        "service": "sinal-verde_acesso-sinalverde-0",
        "rule": rule,
        "priority": 1000,
        "tls": {"domains": [{"main": domain, "sans": [www]}]}
      }
    },
    "services": {
      "sinal-verde_acesso-sinalverde-0": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
      "sinal-verde_acesso-sinalverde-1": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      }
    }
  }
}
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("rewrote without certResolver")
PY
  sleep 12
  s=$(http_code "https://${DOMAIN}/")
  log "sv_retry=${s}"
fi

grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null \
  && log "WARN: main ainda menciona SV" || log "main: limpo SV"
log "DONE sv=${s} file=${SV_YAML}"
echo "sv=${s}"
