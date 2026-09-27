#!/bin/bash
# EMERGÊNCIA 2026-09-27 — Traefik 0/1 + todos os hosts 404
#
# O que o restore-404-all NÃO faz: se TRAEFIK_PROVIDERS_FILE_* já existe,
# ele recusa force. Com Traefik 0/1 e :80/:443 vazios isso deixa o site morto.
#
# Este script:
#   1) desliga timers que forçam/HUP Traefik
#   2) libera docker-proxy zumbi em :80/:443
#   3) sobe easypanel-traefik até 1/1 + portas
#   4) confirma que o container lê /data/config (host /etc/easypanel/traefik/config)
#   5) corrige entryPoints web/websecure → http/https
#   6) garante backends 172.17.0.1:30180/30210/30211
#   7) probe LOCAL com --resolve (não DNS/Cloudflare)
#
# NÃO Redeploy waba_disparador. NÃO HUP.
# Cole no VPS root. Cole a saída inteira no chat se health != 200.
set -uo pipefail

DIR=/etc/easypanel/traefik/config
MAIN=$DIR/main.yaml
CUSTOM=$DIR/custom.yaml
LOG=/var/log/emergency-traefik-0-1-restore-$(date +%Y%m%d-%H%M%S).log
TS=$(date +%Y%m%d-%H%M%S)
SVC=easypanel-traefik
BOOTSTRAP=/root/traefik-easypanel-bootstrap-vps.sh
REPO=https://raw.githubusercontent.com/walkup-tec/waba/master/scripts

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

probe_local() {
  local url=$1 host=$2 code
  code=$(curl -sk -o /dev/null -m 12 -w '%{http_code}' \
    --resolve "${host}:443:127.0.0.1" "$url" 2>/dev/null || true)
  [[ -n "$code" ]] || code=000
  printf '%s' "$code"
}

replicas() {
  docker service ls --filter "name=${SVC}" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo '?'
}

port_up() { ss -tln 2>/dev/null | grep -qE ":${1} "; }

traefik_cid() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1 || true
}

log "=========== 0) PREP ==========="
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service \
  traefik-permanent-waba-fix.timer traefik-permanent-waba-watch.service \
  traefik-permanent-walkup-evo-fix.timer traefik-permanent-walkup-evo-watch.service
do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers de force/HUP OFF"
log "app local :30180/health=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:30180/health 2>/dev/null || echo 000)"
log "traefik replicas=$(replicas)"
ss -tln | grep -E ':(80|443) ' | tee -a "$LOG" || log "AVISO: :80/:443 não escutam"

log "=========== 1) LIBERAR PORTAS ZUMBI ==========="
free_port() {
  local port=$1 pids pid
  if [[ -n "$(traefik_cid)" ]] && port_up "$port"; then
    return 0
  fi
  port_up "$port" || return 0
  pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  for pid in $pids; do
    if [[ "$(cat "/proc/${pid}/comm" 2>/dev/null)" == "docker-proxy" ]]; then
      log "kill docker-proxy zumbi pid=$pid porta=$port"
      kill "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
}
free_port 80
free_port 443
docker ps -a --filter name=easypanel-traefik -q 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1 || true

log "=========== 2) SUBIR TRAEFIK ==========="
if [[ ! -x "$BOOTSTRAP" ]]; then
  log "baixando bootstrap"
  curl -fsSL "${REPO}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOTSTRAP" || true
  sed -i 's/\r$//' "$BOOTSTRAP" 2>/dev/null || true
  chmod +x "$BOOTSTRAP" 2>/dev/null || true
fi

if [[ -x "$BOOTSTRAP" ]]; then
  log "bootstrap run"
  bash "$BOOTSTRAP" run | tee -a "$LOG" || true
else
  log "bootstrap ausente — force Swarm direto"
  timeout 120 docker service update --update-failure-action continue --force "$SVC" >>"$LOG" 2>&1 || true
fi

for i in $(seq 1 24); do
  if [[ "$(replicas)" == "1/1" ]] && port_up 80 && port_up 443 && [[ -n "$(traefik_cid)" ]]; then
    log "Traefik 1/1 com :80 e :443 (t=${i})"
    break
  fi
  sleep 5
done

log "pós-bootstrap replicas=$(replicas) cid=$(traefik_cid)"
ss -tln | grep -E ':(80|443) ' | tee -a "$LOG" || log "AINDA sem :80/:443"

if [[ -z "$(traefik_cid)" ]]; then
  log "ERRO: Traefik sem container — dump Swarm"
  docker service ps "$SVC" --no-trunc 2>/dev/null | head -12 | tee -a "$LOG"
  docker service logs "$SVC" --tail 40 2>&1 | tee -a "$LOG" || true
  log "DONE (Traefik não subiu). Cole esta saída no chat."
  exit 1
fi

CID=$(traefik_cid)
log "container=${CID:0:12}"

log "=========== 3) FILE PROVIDER / MOUNT ==========="
docker service inspect "$SVC" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep -iE 'PROVIDERS_FILE|ENTRYPOINTS' | tee -a "$LOG" || log "(sem PROVIDERS_FILE no env)"
log "mounts:"
docker inspect "$CID" --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' | tee -a "$LOG"
log "host main.yaml: $(wc -c <"$MAIN" 2>/dev/null || echo 0)b wabadisparos=$(grep -c wabadisparos "$MAIN" 2>/dev/null || echo 0)"
log "container /data/config:"
docker exec "$CID" sh -c 'ls -la /data/config 2>/dev/null || ls -la /etc/easypanel/traefik/config 2>/dev/null || echo MISSING' | tee -a "$LOG"
IN_CONTAINER=$(docker exec "$CID" sh -c 'grep -c wabadisparos /data/config/main.yaml 2>/dev/null || echo 0' || echo 0)
log "container wabadisparos count=${IN_CONTAINER}"

if [[ "${IN_CONTAINER}" == "0" ]]; then
  log "container NÃO vê routers — copiando YAML do host para /data/config"
  docker exec "$CID" mkdir -p /data/config || true
  docker cp "${DIR}/." "${CID}:/data/config/" || log "ERRO docker cp"
  sleep 3
  IN_CONTAINER=$(docker exec "$CID" sh -c 'grep -c wabadisparos /data/config/main.yaml 2>/dev/null || echo 0' || echo 0)
  log "após cp wabadisparos count=${IN_CONTAINER}"
fi

if [[ -f "$CUSTOM" ]] && grep -qiE 'accessLog|^\s*api\s*:|^\s*log\s*:' "$CUSTOM"; then
  if ! grep -qE '^\s*(http|tcp|udp|tls)\s*:' "$CUSTOM"; then
    mv -f "$CUSTOM" "${CUSTOM}.static-disabled-${TS}"
    log "custom.yaml estático movido (quebra directory provider)"
  fi
fi

log "=========== 4) ENTRYPOINTS + BACKENDS ==========="
if [[ -f "$MAIN" ]]; then
  cp -a "$MAIN" "${MAIN}.bak-0-1-restore-${TS}"
  python3 - "$MAIN" <<'PY' || true
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

def fix_eps(t: str) -> str:
    def repl(m):
        full, inner = m.group(0), m.group(1)
        if not re.search(r'websecure|\bweb\b', inner, re.I):
            return full
        start = m.start()
        window = t[max(0, start - 300):start]
        key_m = re.search(r'"(https?-[^"]+)"\s*:\s*\{[\s\S]*$', window)
        key = key_m.group(1) if key_m else ""
        if key.startswith("https-"):
            ep = "https"
        elif key.startswith("http-"):
            ep = "http"
        else:
            inner2 = re.sub(r'["\']websecure["\']', '"https"', inner, flags=re.I)
            inner2 = re.sub(r'["\']web["\']', '"http"', inner2, flags=re.I)
            return '"entryPoints": [' + inner2 + ']'
        return f'"entryPoints": ["{ep}"]'
    t = re.sub(r'"entryPoints"\s*:\s*\[(.*?)\]', repl, t, flags=re.S | re.I)
    t = re.sub(r'(?m)^(\s*-\s*)websecure\s*$', r'\1https', t)
    t = re.sub(r'(?m)^(\s*-\s*)web\s*$', r'\1http', t)
    return t

text = fix_eps(text)
CANONICAL = {
    "waba_paginadevendas": "http://172.17.0.1:30210/",
    "waba_bets_pv": "http://172.17.0.1:30211/",
    "waba_waba_disparador": "http://172.17.0.1:30180/",
    "waba_waba-disparador": "http://172.17.0.1:30180/",
}
for family, url in CANONICAL.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"ensure {family} -> {url} ({n}x)")
if text.count("{") != text.count("}"):
    print("ERRO braces")
    sys.exit(2)
path.write_text(text, encoding="utf-8")
print("main.yaml patched")
PY
fi

if [[ -x /root/waba-infra/traefik-entrypoint-guard-vps.sh ]]; then
  /root/waba-infra/traefik-entrypoint-guard-vps.sh run >>"$LOG" 2>&1 || true
fi

log "aguardando file watch 15s (sem HUP)..."
sleep 15

log "=========== 5) VALIDAÇÃO LOCAL ==========="
D=$(probe_local https://wabadisparos.com.br/ wabadisparos.com.br)
B=$(probe_local https://bet.waba.info/ bet.waba.info)
H=$(probe_local https://waba.draxsistemas.com.br/health waba.draxsistemas.com.br)
S=$(probe_local https://acesso-sinalverde.com/ acesso-sinalverde.com)
M=$(probe_local https://app.somaconecta.com.br/api/health app.somaconecta.com.br)
L=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:30180/health 2>/dev/null || echo 000)
log "LOCAL --resolve disparos=$D bet=$B health=$H sv=$S soma=$M app=$L"

if [[ "$H" != "200" ]]; then
  log "--- traefik logs ---"
  docker service logs "$SVC" --tail 60 2>&1 | tee -a "$LOG" || true
  log "--- service ps ---"
  docker service ps "$SVC" --no-trunc 2>/dev/null | head -8 | tee -a "$LOG" || true
  log "--- Host() no main.yaml (amostra) ---"
  grep -n 'Host(`' "$MAIN" | head -20 | tee -a "$LOG" || true
fi

log "DONE log=$LOG"
log "Esperado: health=200 (JSON). Se health=404 com Traefik 1/1, cole esta saída no chat."
[[ "$H" == "200" ]]
exit $?
