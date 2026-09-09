#!/bin/bash
# Só use DEPOIS de 1 envio Graph ok (template aprovado no chip).
# Pausa do operacional (status=failed) permanece: o watchdog não reabre sozinho.
set -euo pipefail

INTAKE="66c63991-9c2f-42a2-b024-7aeab1b71546"
FILE="/app/data/meta-whatsapp-broadcasts.json"
JS_URL="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/resume-opt-in-ptx.cjs"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1 || true)"
if [ -z "${CONTAINER}" ]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba_waba_disparador' | head -1 || true)"
fi
echo "CONTAINER=${CONTAINER}"
test -n "${CONTAINER}"

curl -fsSL -o /tmp/resume-opt-in-ptx.cjs "${JS_URL}?t=$(date +%s)"
test -s /tmp/resume-opt-in-ptx.cjs
docker cp /tmp/resume-opt-in-ptx.cjs "${CONTAINER}:/tmp/resume-opt-in-ptx.cjs"
echo "--- node ---"
docker exec -w /app "${CONTAINER}" node /tmp/resume-opt-in-ptx.cjs "${INTAKE}" "${FILE}"

echo "--- aguarde o watchdog (~25s) ---"
sleep 25
echo -n "health marker: "
curl -sS --max-time 12 http://127.0.0.1:30180/health | python3 -c 'import json,sys
h=json.load(sys.stdin)
print(h.get("deployMarker"))
print("protect", json.dumps(h.get("cloudBroadcastProtect"), ensure_ascii=False))'
echo
echo "OK se apareceu APLICADO e protect.active=true. NÃO faça Redeploy enquanto estiver Enviando."
