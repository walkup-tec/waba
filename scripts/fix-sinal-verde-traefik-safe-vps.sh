#!/bin/bash
# Fix Sinal Verde — v5 ISOLADO: edita APENAS sinal-verde.yaml (nunca main.yaml).
# Backend canônico: http://172.17.0.1:30310/  | entryPoints: http/https
# Doc file provider: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# Uso:
#   bash /tmp/fix-sinal-verde-traefik-safe-vps.sh
#
# Versão: fix-sinal-verde-safe-2026-07-20-v5-isolated-yaml
set -euo pipefail

VERSION="fix-sinal-verde-safe-2026-07-20-v5-isolated-yaml"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SV_YAML="${TRAEFIK_SV_YAML:-${CFG_DIR}/sinal-verde.yaml}"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
URL="http://172.17.0.1:${HOST_PORT}/"
DOMAIN="acesso-sinalverde.com"
SPLIT_SCRIPT="${SPLIT_SCRIPT:-/root/waba-infra/traefik-split-sinal-verde-yaml-vps.sh}"

[[ "$(id -u)" -eq 0 ]] || { echo "root only"; exit 1; }
echo "[$VERSION] alvo=$SV_YAML (proibido main.yaml)"

# Se ainda não existe sinal-verde.yaml, orientar split (não patcha main)
if [[ ! -f "$SV_YAML" ]]; then
  echo "ERRO: $SV_YAML ausente."
  echo "Rode antes: traefik-split-sinal-verde-yaml-vps.sh run"
  if [[ -x "$SPLIT_SCRIPT" ]]; then
    echo "Tentando split via $SPLIT_SCRIPT ..."
    bash "$SPLIT_SCRIPT" run || true
  fi
  [[ -f "$SV_YAML" ]] || exit 2
fi

# publish
if docker service ls --format '{{.Name}}' | grep -qx "$CRM"; then
  ports=$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' || echo '[]')
  if ! echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    echo "publish :${HOST_PORT}"
    docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
    timeout 90 docker service update \
      --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
      "$CRM" || true
    sleep 5
  fi
fi
echo -n "local :${HOST_PORT} "
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 "http://127.0.0.1:${HOST_PORT}/" || echo 000

cp -a "$SV_YAML" "${SV_YAML}.bak-fix-$(date +%s)"

python3 - "$SV_YAML" "$URL" <<'PY'
import json, re, sys
from pathlib import Path
path, url = Path(sys.argv[1]), sys.argv[2]
raw = path.read_text(encoding="utf-8")
try:
    data = json.loads(raw)
except Exception:
    # YAML-like fallback: só replace url em loadBalancer blocks por chave SV
    text = raw
    n = 0
    for key in ("sinal-verde_acesso-sinalverde-0", "sinal-verde_acesso-sinalverde-1"):
        idx = 0
        while True:
            pos = text.find(f'"{key}"', idx)
            if pos < 0:
                break
            brace = text.find("{", pos)
            depth = 0
            end = None
            for i, ch in enumerate(text[brace:], brace):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end is None:
                break
            block = text[pos:end]
            if "loadBalancer" in block:
                nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
                if c:
                    text = text[:pos] + nb + text[end:]
                    end = pos + len(nb)
                    n += 1
            idx = end
    path.write_text(text, encoding="utf-8")
    print(f"patched_raw={n}")
    sys.exit(0)

changed = 0
for k, v in list(data.items()):
    if not isinstance(v, dict):
        continue
    if "loadBalancer" in v:
        try:
            servers = v.get("loadBalancer", {}).get("servers") or []
            if not servers or servers[0].get("url") != url:
                v.setdefault("loadBalancer", {})["servers"] = [{"url": url}]
                changed += 1
                print(f"{k} -> {url}")
        except Exception as e:
            print(f"skip {k}: {e}")
    if "entryPoints" in v and isinstance(v["entryPoints"], list):
        fixed = []
        for ep in v["entryPoints"]:
            if ep in ("websecure", "web-secure"):
                fixed.append("https")
                changed += 1
            elif ep == "web":
                fixed.append("http")
                changed += 1
            else:
                fixed.append(ep)
        v["entryPoints"] = fixed

path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"patched={changed}")
PY

# Se Easypanel recolocou SV no main — só strip (não patch WABA)
if [[ -f "$MAIN" ]] && grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null; then
  echo "AVISO: SV reapareceu no main.yaml — strip-only"
  if [[ -x "$SPLIT_SCRIPT" ]]; then
    bash "$SPLIT_SCRIPT" strip-main || true
  fi
fi

sleep 10
echo -n "sv "
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 "https://${DOMAIN}/" || echo 000
echo "OK — main.yaml WABA não foi editado por este script."
