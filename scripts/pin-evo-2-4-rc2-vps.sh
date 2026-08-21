#!/usr/bin/env bash
# Pin Evolution walkup para evoapicloud/evolution-api:2.4.0-rc2 (botão nativo).
# Rollback automático se GET / não reportar 2.4 ou se vier LICENSE_REQUIRED.
set -euo pipefail

SVC="${EVO_SWARM_SERVICE:-walkup_evo-walkup-api}"
TARGET_IMAGE="${EVO_PIN_IMAGE:-evoapicloud/evolution-api:2.4.0-rc2}"
BACKUP_DIR="/root/waba-infra"
BACKUP_FILE="${BACKUP_DIR}/evo-image-before-pin-$(date +%Y%m%d%H%M%S).txt"
PROBE_URL="${EVO_PROBE_URL:-http://127.0.0.1:30181/}"

echo "=== pin EVO $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "service=${SVC}"
echo "target=${TARGET_IMAGE}"

if ! docker service inspect "$SVC" >/dev/null 2>&1; then
  echo "ERROR: serviço Swarm não encontrado: ${SVC}"
  docker service ls | grep -iE 'evo|walkup' || true
  exit 1
fi

CURRENT_IMAGE="$(docker service inspect "$SVC" --format '{{index .Spec.TaskTemplate.ContainerSpec.Image}}')"
echo "current_image=${CURRENT_IMAGE}"
mkdir -p "$BACKUP_DIR"
printf '%s\n' "$CURRENT_IMAGE" > "$BACKUP_FILE"
echo "backup=${BACKUP_FILE}"

rollback() {
  local reason="${1:-falha}"
  echo "ROLLBACK: ${reason} -> ${CURRENT_IMAGE}"
  docker service update --image "$CURRENT_IMAGE" "$SVC" >/dev/null
  echo "rollback pedido; aguardando convergência..."
  sleep 8
}

pin_easypanel_source() {
  local found=0
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -qE 'evolution-api:(latest|v?2\.3\.7|2\.4\.0-rc2)' "$f" 2>/dev/null \
      || grep -qiE 'evo-walkup-api|walkup_evo' "$f" 2>/dev/null; then
      if grep -q 'evolution-api:' "$f"; then
        echo "easypanel_file=${f}"
        cp -a "$f" "${f}.bak-pin-rc2-$(date +%Y%m%d%H%M%S)"
        sed -i -E 's#evoapicloud/evolution-api:[A-Za-z0-9._-]+#evoapicloud/evolution-api:2.4.0-rc2#g' "$f"
        found=1
      fi
    fi
  done < <(find /etc/easypanel -type f \( -name '*.json' -o -name '*.yml' -o -name '*.yaml' -o -name 'docker-compose*' \) 2>/dev/null | head -200)
  if [ "$found" -eq 0 ]; then
    echo "WARN: não achei source EasyPanel com evolution-api; pin Swarm feito mesmo assim."
    echo "      No painel: Source da app evo-walkup-api = ${TARGET_IMAGE} (não latest)."
  fi
}

echo "--- pull ---"
docker pull "$TARGET_IMAGE"

echo "--- easypanel source ---"
pin_easypanel_source

echo "--- swarm update ---"
docker service update --image "$TARGET_IMAGE" "$SVC"

echo "--- wait 1/1 ---"
ok=0
for i in $(seq 1 36); do
  replicas="$(docker service ls --filter "name=${SVC}" --format '{{.Replicas}}' | head -1)"
  echo "t=${i} replicas=${replicas}"
  if [ "$replicas" = "1/1" ]; then
    ok=1
    break
  fi
  sleep 5
done
if [ "$ok" -ne 1 ]; then
  rollback "serviço não ficou 1/1"
  exit 1
fi

# Publish :30181 some vezes some no update — republicar se a porta local falhar.
sleep 4
if ! curl -fsS --max-time 8 "$PROBE_URL" >/tmp/evo-pin-probe.json 2>/tmp/evo-pin-probe.err; then
  echo "WARN: probe ${PROBE_URL} falhou; tentando publish-add 30181"
  docker service update --publish-add published=30181,target=8080,protocol=tcp "$SVC" || true
  sleep 8
  curl -fsS --max-time 12 "$PROBE_URL" >/tmp/evo-pin-probe.json
fi

echo "--- probe body ---"
cat /tmp/evo-pin-probe.json
echo

python3 - <<'PY' || { rollback "probe JSON inválido"; exit 1; }
import json, sys
raw=open("/tmp/evo-pin-probe.json","r",encoding="utf-8").read()
data=json.loads(raw)
text=raw.lower()
if "license_required" in text or "service not activated" in text:
    print("LICENSE_REQUIRED")
    sys.exit(2)
ver=str(data.get("version") or "")
print("version="+ver)
if not ver.startswith("2.4"):
    print("NOT_2_4")
    sys.exit(3)
PY
probe_rc=$?
if [ "$probe_rc" -eq 2 ]; then
  rollback "LICENSE_REQUIRED"
  exit 1
fi
if [ "$probe_rc" -eq 3 ]; then
  rollback "versão não é 2.4.x"
  exit 1
fi
if [ "$probe_rc" -ne 0 ]; then
  rollback "falha ao ler versão"
  exit 1
fi

echo "--- image agora ---"
docker service inspect "$SVC" --format 'Image={{.Spec.TaskTemplate.ContainerSpec.Image}}'
docker service ps "$SVC" --no-trunc | head -4
echo "PIN_OK ${TARGET_IMAGE}"
