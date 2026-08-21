#!/bin/bash
# EMERGÊNCIA 2026-07-21 — Traefik sem routers (SV 404 + cert self-signed + WABA 000)
# 1) Diagnóstico (sem mudança)
# 2) Restaura main.yaml do melhor bak se inválido/sem routers WABA
# 3) Regenera sinal-verde.yaml canônico (http.routers) SEM patchar backends WABA
# 4) Probes com -k e --resolve (evita falso 000 por SSL)
# NÃO force Traefik. NÃO HUP.
set -uo pipefail

DIR=/etc/easypanel/traefik/config
MAIN=$DIR/main.yaml
SV=$DIR/sinal-verde.yaml
SOMA=$DIR/soma-crm.yaml
LOG=/var/log/emergency-traefik-sv-waba-$(date +%Y%m%d-%H%M%S).log
TS=$(date +%Y%m%d%H%M%S)
CRM=sinal-verde_acesso-sinalverde
HOST_PORT=30310
URL="http://172.17.0.1:${HOST_PORT}/"
DOMAIN=acesso-sinalverde.com

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
# -k evita falso 000 por cert self-signed; --resolve força IP local do Traefik
probe() {
  local url=$1 host=${2:-}
  if [[ -n "$host" ]]; then
    curl -sk -o /dev/null -m 12 -w '%{http_code}' --resolve "${host}:443:127.0.0.1" "$url" 2>/dev/null || printf '000'
  else
    curl -sk -o /dev/null -m 12 -w '%{http_code}' "$url" 2>/dev/null || printf '000'
  fi
}
braces_ok() {
  python3 - "$1" <<'PY' 2>/dev/null
import sys
from pathlib import Path
p = Path(sys.argv[1])
if not p.is_file():
    raise SystemExit(1)
t = p.read_text(encoding="utf-8", errors="replace")
raise SystemExit(0 if t.count("{") == t.count("}") and len(t) > 80 else 1)
PY
}

log "=========== 1) DIAGNÓSTICO ==========="
log "traefik=$(docker service ls --filter name=easypanel-traefik --format '{{.Replicas}}' | head -1)"
ss -tln | grep -E ':(80|443)\s' | tee -a "$LOG" || log "AVISO: :80/:443 não escutando"
log "env file provider:"
docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'PROVIDERS_FILE|ENTRYPOINTS' | tee -a "$LOG" || log "(sem env PROVIDERS_FILE)"
log "main braces=$(braces_ok "$MAIN" && echo OK || echo BAD) size=$(wc -c <"$MAIN" 2>/dev/null || echo 0)"
log "sv braces=$(braces_ok "$SV" && echo OK || echo BAD) size=$(wc -c <"$SV" 2>/dev/null || echo 0)"
log "soma braces=$(braces_ok "$SOMA" && echo OK || echo BAD) size=$(wc -c <"$SOMA" 2>/dev/null || echo 0)"
log "wabadisparos no main: $(grep -c 'wabadisparos' "$MAIN" 2>/dev/null || echo 0)"
log "sinal-verde no main: $(grep -ciE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null || echo 0)"
log "CRM publish:"
docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null | tee -a "$LOG" || true
log "local CRM=$(probe "http://127.0.0.1:${HOST_PORT}/")"
log "--- head sinal-verde.yaml ---"
head -40 "$SV" 2>/dev/null | tee -a "$LOG" || log "SV yaml ausente"
log "--- traefik errors (tail) ---"
docker service logs easypanel-traefik --tail 80 2>&1 \
  | grep -iE 'error|invalid|cannot|failed|provider' | tail -20 | tee -a "$LOG" || true

log "probes pré (com -k):"
log "  disparos=$(probe https://wabadisparos.com.br/ wabadisparos.com.br)"
log "  bet=$(probe https://bet.waba.info/ bet.waba.info)"
log "  health=$(probe https://waba.draxsistemas.com.br/health waba.draxsistemas.com.br)"
log "  sv=$(probe https://acesso-sinalverde.com/ acesso-sinalverde.com)"
log "  soma=$(probe https://app.somaconecta.com.br/api/health app.somaconecta.com.br)"

log "=========== 2) RESTAURAR main.yaml SE PRECISO ==========="
NEED_MAIN=0
if ! braces_ok "$MAIN"; then NEED_MAIN=1; log "main braces BAD"; fi
if ! grep -q 'wabadisparos.com.br' "$MAIN" 2>/dev/null; then NEED_MAIN=1; log "main sem wabadisparos"; fi
# Se bet/disparos 404 com -k, routers não carregaram
PRE_DISP=$(probe https://wabadisparos.com.br/ wabadisparos.com.br)
if [[ "$PRE_DISP" == "404" || "$PRE_DISP" == "000" ]]; then
  NEED_MAIN=1
  log "disparos pré=$PRE_DISP — forçando restore de bak"
fi

if [[ "$NEED_MAIN" == "1" ]]; then
  [[ -f "$MAIN" ]] && cp -a "$MAIN" "${MAIN}.broken-${TS}"
  BEST=$(python3 - "$DIR" <<'PY'
import sys
from pathlib import Path
d = Path(sys.argv[1])
cands = []
for p in sorted(d.glob("main.yaml.bak*"), key=lambda x: x.stat().st_mtime, reverse=True):
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if t.count("{") != t.count("}"):
        continue
    if "wabadisparos.com.br" not in t:
        continue
    if "172.17.0.1:30210" not in t and "30210" not in t:
        continue
    # Preferir bak sem chaves SV (isolamento)
    score = p.stat().st_mtime
    if "acesso-sinalverde" not in t.lower() and "sinal-verde" not in t.lower():
        score += 1e12
    cands.append((score, str(p)))
print(cands[0][1] if cands else "")
PY
)
  if [[ -z "${BEST:-}" ]]; then
    log "ERRO: nenhum bak válido. ls:"; ls -lt "$DIR"/main.yaml.bak* 2>/dev/null | head -15 | tee -a "$LOG"
  else
    log "restaurando main <= $BEST"
    cp -a "$BEST" "$MAIN"
    # garantir backends host gateway WABA (não toca SV)
    python3 - "$MAIN" <<'PY'
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
        print(f"ensure {family} -> {url} ({n})")
if text.count("{") != text.count("}"):
    raise SystemExit("ABORT braces após patch")
path.write_text(text, encoding="utf-8")
PY
  fi
else
  log "main.yaml aparenta OK — sem restore"
fi

log "=========== 3) REGENERAR sinal-verde.yaml (isolado) ==========="
# publish CRM
if docker service ls --format '{{.Name}}' | grep -qx "$CRM"; then
  if ! docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    log "publish :${HOST_PORT}"
    docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
    timeout 90 docker service update \
      --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
      "$CRM" || true
    sleep 4
  fi
fi

RESOLVER=$(docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE '^TRAEFIK_CERTIFICATESRESOLVERS_' | head -1 \
  | sed -E 's/^TRAEFIK_CERTIFICATESRESOLVERS_([^_]+)_.*/\1/i' \
  | tr '[:upper:]' '[:lower:]' || true)
[[ -n "$RESOLVER" ]] || RESOLVER=letsencrypt
log "certResolver=$RESOLVER"

[[ -f "$SV" ]] && cp -a "$SV" "${SV}.bak-${TS}" || true
python3 - "$SV" "$URL" "$DOMAIN" "$RESOLVER" <<'PY'
import json, sys
from pathlib import Path
path, url, domain, resolver = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
www = f"www.{domain}"
rule = f"Host(`{domain}`) || Host(`{www}`)"
data = {
  "http": {
    "middlewares": {
      "sv-redirect-https": {"redirectScheme": {"scheme": "https", "permanent": True}}
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
        "tls": {
          "certResolver": resolver,
          "domains": [{"main": domain, "sans": [www]}],
        },
      },
    },
    "services": {
      "sinal-verde_acesso-sinalverde-0": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
      "sinal-verde_acesso-sinalverde-1": {
        "loadBalancer": {"servers": [{"url": url}], "passHostHeader": True}
      },
    },
  }
}
tmp = path.with_suffix(".yaml.tmp")
tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
tmp.replace(path)
print(f"wrote {path}")
PY

# Strip SV do main se reapareceu (só se WABA ok depois)
if grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null; then
  log "main ainda tem SV — strip seguro após wait"
fi

log "aguardando file watch 20s (sem HUP/force)..."
sleep 20

log "=========== 4) VALIDAÇÃO ==========="
D=$(probe https://wabadisparos.com.br/ wabadisparos.com.br)
B=$(probe https://bet.waba.info/ bet.waba.info)
H=$(probe https://waba.draxsistemas.com.br/health waba.draxsistemas.com.br)
S=$(probe https://acesso-sinalverde.com/ acesso-sinalverde.com)
M=$(probe https://app.somaconecta.com.br/api/health app.somaconecta.com.br)
L=$(probe "http://127.0.0.1:${HOST_PORT}/")
log "disparos=$D bet=$B health=$H sv=$S soma=$M local=$L"

# Se file provider sumiu do env, reaplicar directory+watch (rolling — só se tudo 404)
if [[ "$D" == "404" || "$D" == "000" ]]; then
  ENVS=$(docker service inspect easypanel-traefik \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null || true)
  if ! grep -qiE 'PROVIDERS_FILE_(DIRECTORY|FILENAME)' <<<"$ENVS"; then
    log "SEM PROVIDERS_FILE_* — reaplicando directory+watch (rolling restart Traefik)"
    docker service update --detach=false \
      --env-add "TRAEFIK_PROVIDERS_FILE_DIRECTORY=/etc/easypanel/traefik/config" \
      --env-add "TRAEFIK_PROVIDERS_FILE_WATCH=true" \
      easypanel-traefik >>"$LOG" 2>&1 || log "falha env update"
    sleep 25
    log "pós-env disparos=$(probe https://wabadisparos.com.br/ wabadisparos.com.br) sv=$(probe https://acesso-sinalverde.com/ acesso-sinalverde.com)"
  else
    log "env presente:"; grep -iE 'PROVIDERS_FILE' <<<"$ENVS" | tee -a "$LOG"
    log "logs Traefik:"; docker service logs easypanel-traefik --tail 40 2>&1 | tee -a "$LOG" || true
  fi
fi

# Strip SV do main somente se WABA voltou
D2=$(probe https://wabadisparos.com.br/ wabadisparos.com.br)
if [[ "$D2" == "200" || "$D2" == "301" || "$D2" == "302" || "$D2" == "307" || "$D2" == "308" ]]; then
  if grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null; then
    if [[ -x /root/waba-infra/heal-sinal-verde-pos-redeploy-vps.sh ]]; then
      log "WABA OK — strip SV seguro"
      /root/waba-infra/heal-sinal-verde-pos-redeploy-vps.sh strip-only >>"$LOG" 2>&1 || true
      sleep 8
    fi
  fi
fi

log "FINAL disparos=$(probe https://wabadisparos.com.br/ wabadisparos.com.br) bet=$(probe https://bet.waba.info/ bet.waba.info) sv=$(probe https://acesso-sinalverde.com/ acesso-sinalverde.com) soma=$(probe https://app.somaconecta.com.br/api/health app.somaconecta.com.br) local=$(probe http://127.0.0.1:${HOST_PORT}/)"
log "DONE — cole TODA a saída no chat. log=$LOG"
