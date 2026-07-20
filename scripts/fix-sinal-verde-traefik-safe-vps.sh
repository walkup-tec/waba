#!/bin/bash
# Fix SEGURO — só acesso-sinalverde.com. NÃO toca routers WABA.
#
# 404 JSON Cannot GET /api/errors/not-found = Traefik sem Host match (ou service morto).
# 502 bad-gateway = backend down.
#
# REGRAS (incidente 2026-07-20):
#   - NUNCA inserir blocos após waba_paginadevendas / bets / disparador
#   - NUNCA criar chaves novas no main.yaml se Host(acesso-sinalverde) não existir
#   - NUNCA force Traefik / HUP
#   - Abortar gravação se chaves desbalanceadas OU se wabadisparos sumir
#
# Uso (root VPS):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-sinal-verde-traefik-safe-vps.sh" \
#     -o /tmp/fix-sv-safe.sh
#   sed -i 's/\r$//' /tmp/fix-sv-safe.sh && bash /tmp/fix-sv-safe.sh
#
# Doc: https://doc.traefik.io/traefik/getting-started/configuration-overview/
#      https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
# Versão: fix-sinal-verde-safe-2026-07-20-v2
set -euo pipefail

VERSION="fix-sinal-verde-safe-2026-07-20-v2"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="/var/log/fix-sinal-verde-safe.log"
CRM="${SV_SWARM_SERVICE:-sinal-verde_acesso-sinalverde}"
HOST_PORT="${SV_PUBLISHED_PORT:-30310}"
TARGET_PORT="${SV_PORT:-3000}"
DOMAIN="${SV_PUBLIC_HOST:-acesso-sinalverde.com}"
DOMAIN_WWW="${SV_PUBLIC_WWW:-www.acesso-sinalverde.com}"
GW="${WABA_HOST_GW:-172.17.0.1}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || echo 000; }

[[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }

# Heal SV antigo pode estar brigando — desliga
systemctl stop sinal-verde-heal.timer sinal-verde-heal-watch.service 2>/dev/null || true
systemctl disable sinal-verde-heal.timer sinal-verde-heal-watch.service 2>/dev/null || true
rm -f /var/run/heal-sinal-verde-pos-redeploy.lock 2>/dev/null || true

log "=== 1) diagnóstico ==="
echo -n "WABA disparos: "; http_code https://wabadisparos.com.br/; echo
echo -n "WABA bet: "; http_code https://bet.waba.info/; echo
echo -n "WABA health: "; http_code https://waba.draxsistemas.com.br/health; echo
echo -n "SV https: "; http_code "https://${DOMAIN}/"; echo
echo -n "SV local :${HOST_PORT}: "; http_code "http://127.0.0.1:${HOST_PORT}/"; echo

if ! docker service ls --format '{{.Name}}' | grep -qx "$CRM"; then
  log "ERRO: serviço ${CRM} ausente"
  docker service ls | grep -i sinal || true
  exit 1
fi

echo "=== CRM publish ==="
docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' || true
echo
echo "=== trechos main.yaml (sinal-verde / acesso-sinalverde / 30310) ==="
grep -n 'sinal-verde\|acesso-sinalverde\|30310' "$CFG" | head -60 || echo "(nenhuma linha)"

# Guard WABA intacto antes
python3 - "$CFG" <<'PY' || { log "ABORT: main.yaml inválido/sem WABA"; exit 2; }
from pathlib import Path
import sys
t = Path(sys.argv[1]).read_text(encoding="utf-8")
assert t.count("{") == t.count("}"), "chaves desbalanceadas"
assert "wabadisparos.com.br" in t, "sem wabadisparos"
assert "bet.waba.info" in t or "waba_bets_pv" in t, "sem bet"
print("guard WABA OK")
PY

log "=== 2) garantir publish CRM :${HOST_PORT} → ${TARGET_PORT} ==="
PORTS="$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo '[]')"
if echo "$PORTS" | grep -q "\"PublishedPort\":${HOST_PORT}\|\"PublishedPort\": ${HOST_PORT}"; then
  log "publish :${HOST_PORT} já presente"
else
  log "adicionando publish :${HOST_PORT}"
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || {
      log "ERRO publish — porta pode estar em uso:"
      ss -lntp | grep ":${HOST_PORT}" || true
      docker ps --format '{{.Names}} {{.Ports}}' | grep "${HOST_PORT}" || true
      exit 1
    }
  sleep 6
fi

LOCAL="$(http_code "http://127.0.0.1:${HOST_PORT}/")"
log "local :${HOST_PORT} → ${LOCAL}"
case "$LOCAL" in
  200|301|302|303|307|308|401) ;;
  *)
    log "AVISO: CRM local não responde bem (${LOCAL}) — Traefik sozinho não resolve"
    docker service ps "$CRM" --no-trunc 2>&1 | head -15 || true
    ;;
esac

log "=== 3) patch Traefik SOMENTE chaves/routers Sinal Verde já existentes ==="
cp -a "$CFG" "${CFG}.bak-sv-safe-$(date +%Y%m%d-%H%M%S)"

python3 - "$CFG" "$HOST_PORT" "$GW" "$DOMAIN" "$DOMAIN_WWW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
port, gw, domain, domain_www = sys.argv[2:6]
url = f"http://{gw}:{port}/"
text0 = path.read_text(encoding="utf-8")
text = text0

if text.count("{") != text.count("}"):
    print("ABORT unbalanced")
    sys.exit(2)
if "wabadisparos.com.br" not in text:
    print("ABORT missing wabadisparos")
    sys.exit(2)

has_host = f"Host(`{domain}`)" in text or f"Host(`{domain_www}`)" in text
print(f"Host({domain}) presente no yaml: {has_host}")

# 1) Troca URL overlay → host gateway (regex família — confiável neste VPS)
#    Causa do 502: http://sinal-verde_acesso-sinalverde:3000/ (Traefik não alcança overlay)
nfix = 0
for family in (
    "sinal-verde_acesso-sinalverde",
    "sinal-verde-acesso-sinalverde",
    "acesso-sinalverde",
):
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text2, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"url family {family}* -> {url} ({n}x)")
        nfix += n
        text = text2

# Também força qualquer url overlay explícita do CRM
text2, n = re.subn(
    r'(http://sinal-verde_acesso-sinalverde(?::\d+)?/?)',
    url,
    text,
)
if n:
    print(f"overlay literal -> {url} ({n}x)")
    nfix += n
    text = text2

# Nunca host :3000 (painel Easypanel)
text2, n = re.subn(rf'http://{re.escape(gw)}:3000/?', url, text)
if n:
    print(f"host :3000 (Easypanel) -> {url} ({n}x)")
    nfix += n
    text = text2

# 2) Descobre loadBalancer real usado pelo Host(acesso-sinalverde.com)
sv_lb = None
# Preferir o service citado no router do domínio público
for m in re.finditer(
    rf'"https?-sinal-verde_acesso-sinalverde-\d+"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*"[^"]*{re.escape(domain)}[^"]*"[\s\S]*?"service"\s*:\s*"([^"]+)"',
    text,
):
    cand = m.group(1)
    if not cand.startswith("http-") and not cand.startswith("https-"):
        sv_lb = cand
        break
if sv_lb is None:
    for key in (
        "sinal-verde_acesso-sinalverde-1",
        "sinal-verde_acesso-sinalverde-0",
    ):
        if f'"{key}"' in text and "loadBalancer" in text:
            sv_lb = key
            break
print(f"sv_lb={sv_lb}")

# 3) entryPoints web/websecure → http/https só nos routers SV
def extract_block(text, start):
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return text[start:end], start, end

svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    kl = key.lower()
    if "sinal-verde" not in kl and "acesso-sinalverde" not in kl:
        pos = m.end()
        continue
    block, bstart, bend = extract_block(text, m.start())
    if "rule" not in block:
        pos = bend
        continue
    nb = block
    if re.search(r'"websecure"|"web"', nb):
        if key.startswith("https-") or "websecure" in nb:
            nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["https"]', nb, count=1)
        else:
            nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["http"]', nb, count=1)
        print(f"router {key} entryPoints fixed")
    if sv_lb:
        rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', nb)
        if rule_m and (f"Host(`{domain}`)" in rule_m.group(1) or f"Host(`{domain_www}`)" in rule_m.group(1)):
            nb2 = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{sv_lb}\2", nb, count=1)
            if nb2 != nb:
                print(f"router {key} -> service {sv_lb}")
                nb = nb2
    if nb != block:
        text = text[:bstart] + nb + text[bend:]
        bend = bstart + len(nb)
        nfix += 1
        pos = bend
    else:
        pos = bend

if text.count("{") != text.count("}"):
    print("ABORT: unbalanced after patch")
    sys.exit(2)
if "wabadisparos.com.br" not in text:
    print("ABORT: missing wabadisparos")
    sys.exit(2)
if "bet.waba.info" not in text and "waba_bets_pv" not in text:
    print("ABORT: missing bet")
    sys.exit(2)

if text == text0:
    print("nenhuma alteração no yaml")
else:
    path.write_text(text, encoding="utf-8")
    print(f"OK patched={nfix} (sem HUP — file watch)")

if not has_host:
    print("NEED_EASYPANEL_DOMAIN=1")
    sys.exit(3)
# Services existem (grep mostrou -0/-1); se URL já estava certa, ok
if "sinal-verde_acesso-sinalverde-0" not in text and "sinal-verde_acesso-sinalverde-1" not in text:
    print("NEED_EASYPANEL_SERVICE=1")
    sys.exit(4)
sys.exit(0)
PY
rc=$?

sleep 12

log "=== 4) validação (WABA deve continuar 200) ==="
for u in \
  "https://wabadisparos.com.br/" \
  "https://bet.waba.info/" \
  "https://waba.draxsistemas.com.br/health" \
  "https://${DOMAIN}/" \
  "https://${DOMAIN}/login"
do
  code=$(http_code "$u")
  echo "${code}  ${u}" | tee -a "$LOG"
done

echo
echo -n "local :${HOST_PORT}: "; http_code "http://127.0.0.1:${HOST_PORT}/"; echo

if [[ "$rc" -eq 3 ]]; then
  cat <<EOF

=== AÇÃO NO EASYPANEL (obrigatória) ===
O main.yaml NÃO tem Host(\`${DOMAIN}\`). Por segurança NÃO criamos router na mão.

1) Easypanel → projeto sinal-verde → app acesso-sinalverde
2) Domains → Add Domain:
   - ${DOMAIN}
   - www.${DOMAIN} (opcional)
3) Destino: o próprio serviço / porta interna 3000 (UI Easypanel)
4) Salvar (Redeploy se pedir)
5) Rodar DE NOVO este script (aí só ajustamos URL → ${GW}:${HOST_PORT})

EOF
  exit 3
fi

if [[ "$rc" -eq 4 ]]; then
  cat <<EOF

=== AÇÃO NO EASYPANEL ===
Há Host do domínio, mas sem loadBalancer sinal-verde no yaml.
Adicione/re-salve o domínio no app (Easypanel recria o service) e rode este script de novo.

EOF
  exit 4
fi

log "=== FIM ${VERSION} rc=${rc} ==="
exit "$rc"
