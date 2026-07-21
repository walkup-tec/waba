#!/bin/bash
# EMERGÊNCIA 2026-07-21 — TODOS os hosts 404 (SV, disparos, bet, health, soma)
# Traefik responde mas sem routers => routing config quebrada ou não carregada.
# Diagnóstico + restauração de backup válido. SEM force/HUP no Traefik.
# Cole no VPS root:
#   bash /tmp/emergency-restore-traefik-404-all.sh
set -uo pipefail

DIR=/etc/easypanel/traefik/config
MAIN=$DIR/main.yaml
SV=$DIR/sinal-verde.yaml
SOMA=$DIR/soma-crm.yaml
LOG=/var/log/emergency-restore-traefik-404-all.log
TS=$(date +%Y%m%d-%H%M%S)

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

probe() { curl -sk -o /dev/null -m 12 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

check_file() {
  local f=$1
  if [[ ! -f "$f" ]]; then echo "MISSING"; return; fi
  local size open close
  size=$(wc -c <"$f")
  open=$(grep -o '{' "$f" | wc -l)
  close=$(grep -o '}' "$f" | wc -l)
  if [[ "$size" -lt 50 ]]; then echo "EMPTY(${size}b)"; return; fi
  if [[ "$open" != "$close" ]]; then echo "UNBALANCED(${open}/${close},${size}b)"; return; fi
  echo "OK(${size}b)"
}

log "=========== DIAGNÓSTICO ==========="
log "traefik: $(docker service ls --filter name=easypanel-traefik --format '{{.Replicas}} {{.Image}}' | head -1)"
log "portas escutando: $(ss -tln | grep -E ':(80|443) ' | tr '\n' ' ')"
log "env file provider:"
docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'PROVIDERS_FILE' | tee -a "$LOG" || log "(nenhum TRAEFIK_PROVIDERS_FILE_*)"
log "main.yaml: $(check_file "$MAIN")"
log "sinal-verde.yaml: $(check_file "$SV")"
log "soma-crm.yaml: $(check_file "$SOMA")"
log "conteúdo dir (yaml/yml):"
ls -la "$DIR"/*.yaml "$DIR"/*.yml 2>/dev/null | tee -a "$LOG" || true
log "hosts no main.yaml: $(grep -c 'wabadisparos' "$MAIN" 2>/dev/null || echo 0)x wabadisparos"
log "--- traefik logs (erros file provider, últimas 15) ---"
docker service logs easypanel-traefik --tail 200 2>&1 \
  | grep -iE 'error|invalid|cannot|failed' | tail -15 | tee -a "$LOG" || true
log "--- guard logs SV/Soma (últimas 5 cada) ---"
tail -5 /var/log/sinal-verde-overlay-guard.log 2>/dev/null | tee -a "$LOG" || true
tail -5 /var/log/soma-crm-overlay-guard.log 2>/dev/null | tee -a "$LOG" || true

log "=========== RESTAURAÇÃO ==========="

# 1) main.yaml: se ausente/vazio/desbalanceado/sem wabadisparos => restaurar melhor bak
NEED_RESTORE=0
MAIN_STATE=$(check_file "$MAIN")
if [[ "$MAIN_STATE" != OK* ]] || ! grep -q 'wabadisparos' "$MAIN" 2>/dev/null; then
  NEED_RESTORE=1
fi
if [[ "$NEED_RESTORE" == "1" ]]; then
  log "main.yaml inválido ($MAIN_STATE) — restaurando melhor backup"
  [[ -f "$MAIN" ]] && cp -a "$MAIN" "${MAIN}.broken-${TS}"
  BEST=$(python3 - "$DIR" <<'PY'
import sys
from pathlib import Path
d = Path(sys.argv[1])
cands = []
for p in d.glob("main.yaml.bak*"):
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if t.count("{") != t.count("}"):
        continue
    if "wabadisparos.com.br" not in t:
        continue
    # preferir baks já limpos de SV/Soma (isolamento), mas aceitar qualquer válido
    score = p.stat().st_mtime
    if "sinal-verde" not in t and "somaconecta" not in t:
        score += 10**10
    cands.append((score, str(p)))
if cands:
    cands.sort(reverse=True)
    print(cands[0][1])
PY
)
  if [[ -n "${BEST:-}" ]]; then
    log "restaurando main.yaml <= $BEST"
    cp -a "$BEST" "$MAIN"
  else
    log "ERRO: nenhum bak válido de main.yaml encontrado — listar: ls $DIR/main.yaml.bak*"
  fi
else
  log "main.yaml aparenta OK — não mexo"
fi

# 2) sinal-verde.yaml / soma-crm.yaml: se corrompido, restaurar bak mais novo
for pair in "$SV" "$SOMA"; do
  state=$(check_file "$pair")
  if [[ "$state" != OK* ]]; then
    log "$(basename "$pair") inválido ($state) — procurando bak"
    newest=$(ls -t "${pair}."bak* 2>/dev/null | head -1 || true)
    if [[ -n "$newest" ]]; then
      [[ -f "$pair" ]] && cp -a "$pair" "${pair}.broken-${TS}"
      cp -a "$newest" "$pair"
      log "restaurado $(basename "$pair") <= $newest"
    else
      log "sem bak para $(basename "$pair") — guard/fix vai regenerar"
    fi
  fi
done

# 3) Garantir backends host-gateway no main restaurado (WABA)
python3 - "$MAIN" <<'PY' 2>/dev/null || true
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
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
path.write_text(text, encoding="utf-8")
PY

# 4) Guards isolados (regeneram sinal-verde.yaml / soma-crm.yaml se preciso; só tocam seus arquivos)
[[ -x /root/waba-infra/sinal-verde-overlay-guard-vps.sh ]] && /root/waba-infra/sinal-verde-overlay-guard-vps.sh run >>"$LOG" 2>&1 || true
[[ -x /root/waba-infra/soma-crm-overlay-guard-vps.sh ]] && /root/waba-infra/soma-crm-overlay-guard-vps.sh run >>"$LOG" 2>&1 || true

log "aguardando file watch do Traefik (20s, sem HUP/force)..."
sleep 20

log "=========== VALIDAÇÃO ==========="
log "disparos: $(probe https://wabadisparos.com.br/)"
log "bet:      $(probe https://bet.waba.info/)"
log "health:   $(probe https://waba.draxsistemas.com.br/health)"
log "sv:       $(probe https://acesso-sinalverde.com/)"
log "soma:     $(probe https://app.somaconecta.com.br/api/health)"

# 5) Se TUDO continua 404, o provider pode não estar lendo o dir (env mudou no redeploy)
if [[ "$(probe https://wabadisparos.com.br/)" == "404" ]]; then
  log "AINDA 404 — checando modo do file provider"
  ENVS=$(docker service inspect easypanel-traefik \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null)
  if ! grep -qiE 'PROVIDERS_FILE_(DIRECTORY|FILENAME)' <<<"$ENVS"; then
    log "SEM env de file provider — Easypanel resetou o service. Reaplicando directory+watch (rolling restart)"
    docker service update --detach=false \
      --env-add "TRAEFIK_PROVIDERS_FILE_DIRECTORY=/etc/easypanel/traefik/config" \
      --env-add "TRAEFIK_PROVIDERS_FILE_WATCH=true" \
      easypanel-traefik >>"$LOG" 2>&1 || log "falha env update"
    sleep 25
    log "pós-env: disparos=$(probe https://wabadisparos.com.br/) sv=$(probe https://acesso-sinalverde.com/)"
  else
    log "env presente:"; grep -iE 'PROVIDERS_FILE' <<<"$ENVS" | tee -a "$LOG"
    log "=> possível config inválida ainda; cole no chat: docker service logs easypanel-traefik --tail 60"
  fi
fi

log "=== DONE — cole TODA a saída acima no chat ==="
