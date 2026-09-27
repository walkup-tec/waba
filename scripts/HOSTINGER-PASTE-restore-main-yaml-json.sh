#!/bin/bash
# EMERGÊNCIA 2026-09-27 — Traefik 1/1 mas file provider recusa main.yaml
# Erro: yaml: line 187: did not find expected node content
# Causa: main.yaml inválido → ZERO routers → 404 em todos os Hosts.
# Ação: restaurar o .bak mais novo que json.loads aceita, patch de URL via JSON
# (sem regex). NÃO HUP. NÃO Redeploy waba_disparador.
set -uo pipefail

DIR=/etc/easypanel/traefik/config
MAIN=$DIR/main.yaml
LOG=/var/log/restore-main-yaml-json-$(date +%Y%m%d-%H%M%S).log
TS=$(date +%Y%m%d-%H%M%S)

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

probe() {
  local url=$1 host=$2 code
  code=$(curl -sk -o /dev/null -m 12 -w '%{http_code}' \
    --resolve "${host}:443:127.0.0.1" "$url" 2>/dev/null || true)
  [[ -n "$code" ]] || code=000
  printf '%s' "$code"
}

log "=========== 1) LINHA 187 (arquivo atual) ==========="
log "size=$(wc -c <"$MAIN" 2>/dev/null || echo 0)"
sed -n '175,200p' "$MAIN" | tee -a "$LOG" || true
python3 - "$MAIN" <<'PY' || true
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
raw = p.read_text(encoding="utf-8", errors="replace")
try:
    json.loads(raw)
    print("json.loads: OK")
except json.JSONDecodeError as e:
    print(f"json.loads: FAIL line={e.lineno} col={e.colno} msg={e.msg}")
    lines = raw.splitlines()
    i = max(0, (e.lineno or 1) - 4)
    j = min(len(lines), (e.lineno or 1) + 3)
    for n in range(i, j):
        print(f"{n+1:4d}|{lines[n]}")
PY

log "=========== 2) RESTAURAR BAK JSON VÁLIDO ==========="
BEST=$(python3 - "$DIR" "$MAIN" "$TS" <<'PY'
import json, sys
from pathlib import Path

d = Path(sys.argv[1])
main = Path(sys.argv[2])
ts = sys.argv[3]
SKIP_SUB = (
    "bak-0-1-restore",
    "bak-before-restore",
    "broken",
    "bak-before-json",
)

def load(p: Path):
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None, ""
    if len(t) < 200 or t.count("{") != t.count("}"):
        return None, t
    try:
        return json.loads(t), t
    except json.JSONDecodeError:
        return None, t

CANON = {
    "waba_paginadevendas": "http://172.17.0.1:30210/",
    "waba_bets_pv": "http://172.17.0.1:30211/",
    "waba_waba_disparador": "http://172.17.0.1:30180/",
    "waba_waba-disparador": "http://172.17.0.1:30180/",
}

def http_block(data):
    if not isinstance(data, dict):
        return None
    if isinstance(data.get("http"), dict):
        return data["http"]
    if "services" in data or "routers" in data:
        return data
    return None

def walk_services(http):
    services = (http or {}).get("services") or {}
    changed = 0
    for svc_name, spec in services.items():
        if not isinstance(spec, dict):
            continue
        lb = spec.get("loadBalancer") or {}
        servers = lb.get("servers") or []
        target = None
        low = svc_name.lower()
        for family, url in CANON.items():
            if family.lower() in low:
                target = url
                break
        if not target:
            continue
        for srv in servers:
            if isinstance(srv, dict) and srv.get("url") != target:
                srv["url"] = target
                changed += 1
    return changed

cur_data, cur_t = load(main)
source = main
data = cur_data

if data is None:
    cands = []
    for p in d.glob("main.yaml*"):
        if p.name == "main.yaml":
            continue
        name = p.name.lower()
        if any(s in name for s in SKIP_SUB):
            continue
        loaded, t = load(p)
        if loaded is None:
            continue
        if "wabadisparos.com.br" not in t:
            continue
        if "waba.draxsistemas.com.br" not in t and "waba_waba_disparador" not in t:
            continue
        score = p.stat().st_mtime
        if "sv-safe" in name or "strip-sv" in name:
            score += 1e7
        if "golden" in name:
            score -= 1e8
        if "waba-only" in name:
            score += 1e6
        cands.append((score, p, loaded, t))
    if not cands:
        print("")
        sys.exit(0)
    cands.sort(key=lambda x: x[0], reverse=True)
    _, source, data, _ = cands[0]
    print(f"# candidates {len(cands)} best={source}", file=sys.stderr)
    for s, p, _, _ in cands[:8]:
        print(f"# cand {p.name} mtime_score={s:.0f} size={p.stat().st_size}", file=sys.stderr)
else:
    print("# current main.yaml is valid JSON — roundtrip only", file=sys.stderr)

bak = main.with_name(f"main.yaml.bak-before-json-{ts}")
bak.write_text(main.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")

http = http_block(data)
changed = walk_services(http) if isinstance(http, dict) else 0

# roundtrip JSON — Traefik file provider parseia isso de forma estável
out = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
json.loads(out)  # sanity
main.write_text(out, encoding="utf-8")
print(str(source))
print(f"changed_urls={changed}", file=sys.stderr)
print(f"wrote_bytes={len(out.encode())}", file=sys.stderr)
PY
)

BEST=$(echo "$BEST" | tr -d '\r' | tail -n 1)
echo "$BEST" | tee -a "$LOG"
if [[ -z "${BEST}" ]]; then
  log "ERRO: nenhum bak com JSON válido + wabadisparos. ls bak:"
  ls -lt "$DIR"/main.yaml.bak* 2>/dev/null | head -20 | tee -a "$LOG"
  exit 1
fi
log "restaurado de: $BEST"

python3 - "$MAIN" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
json.loads(p.read_text(encoding="utf-8"))
print("json.loads pós-restore: OK")
print("wabadisparos", p.read_text(encoding="utf-8").count("wabadisparos"))
print("draxsistemas", p.read_text(encoding="utf-8").count("draxsistemas"))
PY

log "aguardando file watch 20s (sem HUP)..."
sleep 20

log "=========== 3) VALIDAÇÃO ==========="
D=$(probe https://wabadisparos.com.br/ wabadisparos.com.br)
B=$(probe https://bet.waba.info/ bet.waba.info)
H=$(probe https://waba.draxsistemas.com.br/health waba.draxsistemas.com.br)
S=$(probe https://acesso-sinalverde.com/ acesso-sinalverde.com)
M=$(probe https://app.somaconecta.com.br/api/health app.somaconecta.com.br)
L=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:30180/health 2>/dev/null || echo 000)
log "LOCAL disparos=$D bet=$B health=$H sv=$S soma=$M app=$L"

if [[ "$H" != "200" ]]; then
  log "--- traefik errors (tail) ---"
  docker service logs easypanel-traefik --tail 25 2>&1 | grep -iE 'error|yaml|main.yaml' | tail -15 | tee -a "$LOG" || true
fi

log "DONE log=$LOG"
[[ "$H" == "200" ]]
exit $?
