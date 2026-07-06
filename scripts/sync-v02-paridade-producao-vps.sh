#!/bin/bash
# Sincroniza ambiente V02 com produção no VPS (código via Git + dados + Traefik).
#
# Pré-requisitos:
#   - Easypanel serviço waba/waba_disparador_v02 (branch v02) com redeploy após push
#   - Env V02: WABA_ENV=v02, WABA_BASE_PATH=/version-02, WABA_UI_PROFILE=production
#   - Copiar demais env vars do waba_disparador (EVO, Supabase, Asaas, SMTP, etc.)
#
# Uso (root no VPS):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/v02/scripts/sync-v02-paridade-producao-vps.sh" -o /tmp/sync-v02.sh
#   sed -i 's/\r$//' /tmp/sync-v02.sh && chmod +x /tmp/sync-v02.sh
#   /tmp/sync-v02.sh run
#
# Versão: sync-v02-paridade-2026-07-06-v1
set -euo pipefail

SYNC_VERSION="sync-v02-paridade-2026-07-06-v1"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
PROD_PORT="${WABA_PROD_HOST_PORT:-30180}"
V02_PORT="${WABA_V02_HOST_PORT:-30200}"
PROD_SWARM="${WABA_PROD_SWARM:-waba_waba_disparador}"
V02_SWARM="${WABA_V02_SWARM:-waba_waba_disparador_v02}"
PUBLIC_HOST="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
LOG="${SYNC_V02_LOG:-/var/log/sync-v02-paridade-producao.log}"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

resolve_container() {
  local want="$1"
  local cid name
  for cid in $(docker ps -q -f "name=waba_disparador" -f status=running); do
    name=$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | tr -d '/')
    case "$want" in
      prod)
        [[ "$name" == *"_v02"* || "$name" == *"_v01"* || "$name" == *"v02"* || "$name" == *"v01"* ]] && continue
        echo "$cid"
        return 0
        ;;
      v02)
        [[ "$name" == *"v02"* ]] || continue
        echo "$cid"
        return 0
        ;;
    esac
  done
  return 1
}

ensure_host_port() {
  local swarm="$1" port="$2"
  if curl -sf -m 4 "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    log "Porta ${port} OK (${swarm})"
    return 0
  fi
  if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$swarm"; then
    log "AVISO: serviço Swarm ${swarm} ausente"
    return 1
  fi
  log "Publicando ${swarm} → host:${port}"
  timeout 90 docker service update \
    --publish-add "mode=host,published=${port},target=80,protocol=tcp" \
    "$swarm" >>"$LOG" 2>&1 || true
  sleep 8
}

patch_traefik_version_paths() {
  [[ -f "$CFG" ]] || { log "ERRO: ${CFG} ausente"; return 1; }
  cp -a "$CFG" "${CFG}.bak-sync-v02-$(date +%Y%m%d-%H%M%S)"

  python3 - "$CFG" "$PUBLIC_HOST" "$PROD_PORT" "$V02_PORT" <<'PY'
import re, sys
path, host, prod_port, v02_port = sys.argv[1:5]
text = open(path, encoding="utf-8").read()

middlewares_block = """
    waba-strip-v02:
      stripPrefix:
        prefixes:
          - /version-02
"""

if "waba-strip-v02:" not in text:
    if "middlewares:" in text:
        text = text.replace("middlewares:", "middlewares:" + middlewares_block, 1)
    else:
        text = text.replace("http:", "http:\n  middlewares:" + middlewares_block, 1)

def upsert_router(name, rule, service, middleware=None, priority=100):
    global text
    block = f"""
    {name}:
      rule: {rule}
      entryPoints:
        - websecure
      service: {service}
      tls: {{}}
      priority: {priority}
"""
    if middleware:
        block = block.replace("      tls:", f"      middlewares:\n        - {middleware}\n      tls:")
    pat = rf"    {re.escape(name)}:\n(?:      .*\n)*?(?=    [a-zA-Z0-9_-]+:|  [a-z]+:)"
    if re.search(pat, text):
        text = re.sub(pat, block.strip() + "\n", text, count=1)
    else:
        text = text.replace("  routers:", "  routers:" + block, 1)

def upsert_service(name, url):
    global text
    block = f"""
    {name}:
      loadBalancer:
        servers:
          - url: "{url}"
"""
    pat = rf'    {re.escape(name)}:\n(?:      .*\n)*?(?=    [a-zA-Z0-9_-]+:|  [a-z]+:)'
    if re.search(pat, text):
        text = re.sub(pat, block.strip() + "\n", text, count=1)
    else:
        text = text.replace("  services:", "  services:" + block, 1)

upsert_router(
    "waba-v02",
    f"Host(`{host}`) && PathPrefix(`/version-02`)",
    "waba-v02-svc",
    middleware="waba-strip-v02",
    priority=100,
)
upsert_service("waba-v02-svc", f"http://172.17.0.1:{v02_port}/")

# Garante prod na porta correta se bloco existir
text = re.sub(
    rf'("waba-prod-svc"[^}}]*"url"\s*:\s*")[^"]+(")',
    rf'\g<1>http://172.17.0.1:{prod_port}/\2',
    text,
    count=1,
)

open(path, "w", encoding="utf-8").write(text)
print(f"  Traefik: v02 → 172.17.0.1:{v02_port}, PathPrefix /version-02")
PY

  local traefik
  traefik=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$traefik" ]] && docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  log "Traefik recarregado"
}

sync_data_prod_to_v02() {
  local prod_cid v02_cid backup
  prod_cid=$(resolve_container prod || true)
  v02_cid=$(resolve_container v02 || true)
  [[ -n "$prod_cid" ]] || { log "ERRO: container produção não encontrado"; return 1; }
  [[ -n "$v02_cid" ]] || { log "ERRO: container V02 não encontrado — redeploy waba_disparador_v02"; return 1; }

  backup="/tmp/waba-v02-data-backup-$(date +%Y%m%d-%H%M%S).tgz"
  log "Backup V02 atual → ${backup}"
  docker exec "$v02_cid" tar czf - -C /app/data . >"$backup" 2>/dev/null || true

  log "Copiando /app/data produção → V02 (assinantes, usuários, campanhas...)"
  docker exec "$prod_cid" tar czf - -C /app/data . \
    | docker exec -i "$v02_cid" sh -c 'rm -rf /app/data/* /app/data/.[!.]* 2>/dev/null; mkdir -p /app/data && tar xzf - -C /app/data'

  log "Dados sincronizados. Reiniciando V02..."
  docker restart "$v02_cid" >/dev/null
  sleep 12
}

validate_health() {
  local url code body
  for url in \
    "https://${PUBLIC_HOST}/health" \
    "https://${PUBLIC_HOST}/version-02/health"; do
    body=$(curl -sS -m 20 "$url" 2>/dev/null || echo '{"error":"curl"}')
    code=$(curl -sS -o /dev/null -w "%{http_code}" -m 20 "$url" 2>/dev/null || echo "000")
    log "GET ${url} → HTTP ${code}"
    echo "$body" | head -c 200 | tee -a "$LOG"
    echo "" | tee -a "$LOG"
  done
}

run_sync() {
  log "=== ${SYNC_VERSION} início ==="
  ensure_host_port "$PROD_SWARM" "$PROD_PORT" || true
  ensure_host_port "$V02_SWARM" "$V02_PORT" || true
  patch_traefik_version_paths || true

  if [[ -x /root/traefik-permanent-waba-vps.sh ]]; then
    /root/traefik-permanent-waba-vps.sh run >>"$LOG" 2>&1 || true
  fi

  sync_data_prod_to_v02 || log "AVISO: sync dados falhou — verifique se waba_disparador_v02 está Up"
  validate_health
  log "=== ${SYNC_VERSION} fim ==="
  echo ""
  echo "Próximo passo Easypanel:"
  echo "  1. Serviço waba_disparador_v02 → branch v02 → Redeploy"
  echo "  2. Env: WABA_ENV=v02, WABA_BASE_PATH=/version-02, WABA_UI_PROFILE=production"
  echo "  3. Copiar demais vars do waba_disparador (EVO, Supabase, Asaas...)"
  echo "  4. Testar: https://${PUBLIC_HOST}/version-02/"
}

case "${1:-run}" in
  run) run_sync ;;
  data-only) sync_data_prod_to_v02 ;;
  traefik-only) patch_traefik_version_paths ;;
  validate) validate_health ;;
  *)
    echo "Uso: $0 run | data-only | traefik-only | validate"
    exit 1
    ;;
esac
