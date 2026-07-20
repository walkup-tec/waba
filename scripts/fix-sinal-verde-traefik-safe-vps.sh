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
# Versão: fix-sinal-verde-safe-2026-07-20-v1
set -euo pipefail

VERSION="fix-sinal-verde-safe-2026-07-20-v1"
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

def is_sv_key(key: str) -> bool:
    kl = key.lower()
    return ("sinal-verde" in kl) or ("acesso-sinalverde" in kl)

has_host = f"Host(`{domain}`)" in text or f"Host(`{domain_www}`)" in text
print(f"Host({domain}) presente no yaml: {has_host}")

svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{', re.M)
nfix = 0
sv_lb = None

# 1) URLs de loadBalancer SV existentes
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    kl = key.lower()
    block, bstart, bend = extract_block(text, m.start())
    if "loadBalancer" in block and is_sv_key(key) and not kl.startswith("http-") and not kl.startswith("https-"):
        if "easypanel" in kl:
            pos = bend
            continue
        sv_lb = key if (key.endswith("-0") or sv_lb is None) else sv_lb
        nb = re.sub(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        # nunca deixar :3000 do host (painel Easypanel)
        if f"{gw}:3000" in nb:
            nb = nb.replace(f"http://{gw}:3000/", url).replace(f"http://{gw}:3000", url.rstrip("/"))
        if nb != block:
            text = text[:bstart] + nb + text[bend:]
            bend = bstart + len(nb)
            nfix += 1
            print(f"service {key} -> {url}")
    pos = bend

print(f"sv_lb={sv_lb}")

# 2) routers que JÁ têm Host(acesso-sinalverde) → service correto + entryPoints
if sv_lb and has_host:
    pos = 0
    while True:
        m = svc_pat.search(text, pos)
        if not m:
            break
        key = m.group(1)
        block, bstart, bend = extract_block(text, m.start())
        if "rule" not in block:
            pos = bend
            continue
        rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', block)
        if not rule_m:
            pos = bend
            continue
        rule = rule_m.group(1)
        if f"Host(`{domain}`)" not in rule and f"Host(`{domain_www}`)" not in rule:
            pos = bend
            continue
        nb = block
        if re.search(r'"websecure"|"web"', nb):
            if key.startswith("https-") or "websecure" in nb:
                nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["https"]', nb, count=1)
            else:
                nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', '"entryPoints": ["http"]', nb, count=1)
            print(f"router {key} entryPoints fixed")
        for d in (domain, domain_www):
            nb = nb.replace(f"Host(`{d}/`)", f"Host(`{d}`)")
        # NUNCA apontar service para chave http-/https- (router)
        if not sv_lb.startswith("http-") and not sv_lb.startswith("https-"):
            nb2 = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{sv_lb}\2", nb, count=1)
            if nb2 != nb:
                print(f"router {key} -> service {sv_lb}")
                nb = nb2
        if nb != block:
            text = text[:bstart] + nb + text[bend:]
            bend = bstart + len(nb)
            nfix += 1
        pos = bend

# Guards finais — NUNCA gravar se WABA sumiu
if text.count("{") != text.count("}"):
    print("ABORT: unbalanced after patch")
    sys.exit(2)
for must in ("wabadisparos.com.br",):
    if must not in text:
        print(f"ABORT: missing {must}")
        sys.exit(2)

if text == text0:
    print("nenhuma alteração necessária no yaml (ou sem chaves SV)")
else:
    path.write_text(text, encoding="utf-8")
    print(f"OK patched={nfix} (sem HUP — file watch)")

if not has_host:
    print("NEED_EASYPANEL_DOMAIN=1")
    sys.exit(3)
if not sv_lb:
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
