#!/bin/bash
# Zera instâncias e resquícios do owner mozart.pmo@gmail.com (WABA + EVO).
#
# PROTEGIDAS (não apaga na EVO nem remove ownership sem FORCE_PROTECT=1):
#   walkup     — WhatsApp empresa
#   soma-crm   — risco cross-project SOMA
#
# Uso (root no VPS):
#   /tmp/purge-mozart-owner-reset-vps.sh run
#   /tmp/purge-mozart-owner-reset-vps.sh dry-run
#
# Doc EVO delete:
# https://doc.evolution-api.com/v2/api-reference/instance-controller/delete-instance
#
set -euo pipefail

OWNER_EMAIL="${PURGE_OWNER_EMAIL:-mozart.pmo@gmail.com}"
OWNER_LC="$(echo "$OWNER_EMAIL" | tr '[:upper:]' '[:lower:]')"
EVO_BASE="${EVO_API_URL:-http://172.17.0.1:30181}"
EVO_KEY="${EVO_API_KEY:-429683C4C977415CAAFCCE10F7D57E11}"
WABA_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
PROTECT_CSV="${PURGE_PROTECT_INSTANCES:-walkup,soma-crm}"
FORCE_PROTECT="${FORCE_PROTECT:-0}"
MODE="${1:-dry-run}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

is_protected() {
  local name lc
  name="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  IFS=',' read -r -a arr <<< "$PROTECT_CSV"
  for p in "${arr[@]}"; do
    lc="$(echo "$p" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    [[ -n "$lc" && "$name" == "$lc" ]] && return 0
  done
  return 1
}

find_data_dir() {
  local cid
  cid="$(docker ps -q -f name=waba_disparador | head -n1 || true)"
  if [[ -n "$cid" ]]; then
    if docker exec "$cid" test -f /app/data/instance-owners.json 2>/dev/null; then
      echo "container:$cid:/app/data"
      return 0
    fi
  fi
  for d in /var/lib/docker/volumes/*waba*/_data /root/waba-infra/data /opt/easypanel/data; do
    if [[ -f "$d/instance-owners.json" ]]; then
      echo "host:$d"
      return 0
    fi
  done
  # fallback: copy from container to /tmp work
  if [[ -n "$cid" ]]; then
    echo "container:$cid:/app/data"
    return 0
  fi
  return 1
}

evo_delete() {
  local name enc code
  name="$1"
  enc="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$name")"
  curl -sS --max-time 20 -o /dev/null -X DELETE -H "apikey: ${EVO_KEY}" \
    "${EVO_BASE}/instance/logout/${enc}" || true
  code="$(curl -sS --max-time 45 -o /tmp/evo-mozart-del.json -w '%{http_code}' -X DELETE \
    -H "apikey: ${EVO_KEY}" "${EVO_BASE}/instance/delete/${enc}" || echo 000)"
  if [[ "$code" != "200" && "$code" != "201" && "$code" != "404" ]]; then
    code="$(curl -sS --max-time 45 -o /tmp/evo-mozart-del.json -w '%{http_code}' -X DELETE \
      -H "apikey: ${EVO_KEY}" "${EVO_BASE}/instance/deleteInstance/${enc}" || echo 000)"
  fi
  echo "$code"
}

# Fix: python_list_owned invocation above is wrong — rewrite properly below in main

main() {
  log "MODE=${MODE} OWNER=${OWNER_LC} PROTECT=${PROTECT_CSV}"
  local loc kind cid data_dir work
  loc="$(find_data_dir)" || { log "ERROR: não achei instance-owners.json"; exit 2; }
  kind="${loc%%:*}"
  rest="${loc#*:}"
  if [[ "$kind" == "container" ]]; then
    cid="${rest%%:*}"
    data_dir="${rest#*:}"
    work="/tmp/waba-mozart-purge-$$"
    mkdir -p "$work"
    docker cp "${cid}:${data_dir}/." "$work/" || true
    log "data via container ${cid}:${data_dir} → ${work}"
  else
    data_dir="${rest}"
    work="$data_dir"
    log "data host ${work}"
  fi

  local owners_file="${work}/instance-owners.json"
  if [[ ! -f "$owners_file" ]]; then
    log "ERROR: missing ${owners_file}"
    exit 3
  fi

  mapfile -t OWNED < <(OWNER_LC="$OWNER_LC" python3 - "$owners_file" <<'PY'
import json, os, sys
path = sys.argv[1]
owner = os.environ["OWNER_LC"]
with open(path, "r", encoding="utf-8") as f:
    store = json.load(f)
inst = store.get("instances") or {}
names = sorted({str(k).strip() for k, v in inst.items()
                if str((v or {}).get("ownerEmail") or "").strip().lower() == owner and str(k).strip()})
print("\n".join(names))
PY
)

  log "Instâncias no ownership de ${OWNER_LC}: ${#OWNED[@]}"
  local to_delete=()
  local skipped=()
  for n in "${OWNED[@]}"; do
    [[ -z "$n" ]] && continue
    if is_protected "$n" && [[ "$FORCE_PROTECT" != "1" ]]; then
      skipped+=("$n")
      log "PROTECT skip: $n"
    else
      to_delete+=("$n")
      log "WILL PURGE: $n"
    fi
  done

  if [[ "$MODE" == "dry-run" ]]; then
    log "dry-run only — nada alterado. to_delete=${#to_delete[@]} skipped=${#skipped[@]}"
    printf '%s\n' "${to_delete[@]}"
    exit 0
  fi

  if [[ "$MODE" != "run" ]]; then
    log "Uso: $0 run|dry-run"
    exit 1
  fi

  # 1) EVO delete
  for n in "${to_delete[@]}"; do
    code="$(evo_delete "$n")"
    log "EVO delete ${n} → HTTP ${code}"
  done

  # 2) Patch JSON stores in work dir
  TO_DELETE_JSON="$(printf '%s\n' "${to_delete[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
  OWNER_LC="$OWNER_LC" TO_DELETE_JSON="$TO_DELETE_JSON" python3 - "$work" <<'PY'
import json, os, sys, pathlib
work = pathlib.Path(sys.argv[1])
owner = os.environ["OWNER_LC"]
kill = set(json.loads(os.environ["TO_DELETE_JSON"]))
kill_l = {k.lower() for k in kill}

def load(name):
    p = work / name
    if not p.exists():
        return None, p
    try:
        return json.loads(p.read_text(encoding="utf-8")), p
    except Exception:
        return None, p

def save(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# instance-owners
owners, p = load("instance-owners.json")
if owners is not None:
    inst = owners.get("instances") or {}
    deleted = owners.get("deletedInstances") or {}
    for k in list(inst.keys()):
        if k.lower() in kill_l:
            del inst[k]
            deleted[k] = {"deletedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z"}
    owners["instances"] = inst
    owners["deletedInstances"] = deleted
    save(p, owners)
    print(f"instance-owners: kept={len(inst)} deletedMarked={len([k for k in deleted if k.lower() in kill_l])}")

# conversation graph — wipe owner
graph, p = load("aquecedor-conversation-graph.json")
if graph is not None:
    owners_map = graph.get("owners") or {}
    if owner in owners_map:
        del owners_map[owner]
        graph["owners"] = owners_map
        save(p, graph)
        print("conversation-graph: owner removed")

# desired owners
des, p = load("aquecedor-desired-owners.json")
if des is not None:
    desired = des.get("desired") or {}
    if owner in desired:
        del desired[owner]
        des["desired"] = desired
        save(p, des)
        print("desired-owners: cleared")

# owner motors / runtime snapshots (varios nomes possíveis)
for fname in ("aquecedor-owner-motors.json", "aquecedor-owner-runtime.json", "runtime-intent.json"):
    obj, p = load(fname)
    if obj is None:
        continue
    changed = False
    if isinstance(obj, dict):
        if "owners" in obj and isinstance(obj["owners"], dict) and owner in obj["owners"]:
            del obj["owners"][owner]
            changed = True
        if "desired" in obj and isinstance(obj["desired"], dict) and owner in obj["desired"]:
            del obj["desired"][owner]
            changed = True
        if "aquecedorRuntimeDesiredByOwner" in obj and isinstance(obj["aquecedorRuntimeDesiredByOwner"], dict):
            if owner in obj["aquecedorRuntimeDesiredByOwner"]:
                del obj["aquecedorRuntimeDesiredByOwner"][owner]
                changed = True
        # runtime-intent global flag — leave file but if only mozart, set false
        if fname == "runtime-intent.json" and "aquecedorRuntimeDesired" in obj:
            obj["aquecedorRuntimeDesired"] = False
            changed = True
    if changed:
        save(p, obj)
        print(f"{fname}: cleaned")

# lifecycle — remove purged instance keys
life, p = load("aquecedor-instance-lifecycle.json")
if life is not None:
    inst = life.get("instances") or {}
    for k in list(inst.keys()):
        if k.lower() in kill_l:
            del inst[k]
    life["instances"] = inst
    save(p, life)
    print(f"lifecycle: remaining={len(inst)}")

# delivery cooldowns
cool, p = load("aquecedor-delivery-cooldowns.json")
if cool is not None:
    directed = cool.get("directed") or {}
    for k in list(directed.keys()):
        kl = k.lower()
        if any(n in kl for n in kill_l):
            del directed[k]
    cool["directed"] = directed
    save(p, cool)
    print(f"cooldowns: remaining={len(directed)}")

# aliases / whatsapp profile names
for fname in ("instance-aliases.json", "whatsapp-profile-names.json", "evo-instances-cache.json"):
    obj, p = load(fname)
    if obj is None:
        continue
    if isinstance(obj, dict):
        # structure varies: {map:{}} or flat
        root = obj.get("aliases") if isinstance(obj.get("aliases"), dict) else obj
        if isinstance(root, dict):
            for k in list(root.keys()):
                if k.lower() in kill_l:
                    del root[k]
        save(p, obj)
        print(f"{fname}: scrubbed")

print("json patch done")
PY

  # 3) Copy back to container if needed
  if [[ "$kind" == "container" ]]; then
    log "Copiando data limpa de volta para ${cid}:${data_dir}"
    docker cp "$work/." "${cid}:${data_dir}/"
  fi

  # 4) Restart WABA para soltar estado em memória
  log "Restart service ${WABA_SERVICE} (estado em memória)"
  docker service update --force "${WABA_SERVICE}" >/tmp/waba-force-update.out 2>&1 || \
    log "WARN: service update falhou — veja /tmp/waba-force-update.out"

  log "DONE purge mozart. Protected kept on EVO: ${skipped[*]:-none}"
  log "Purged: ${to_delete[*]:-none}"
}

main "$@"
