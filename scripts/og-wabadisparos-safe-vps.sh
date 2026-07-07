#!/bin/bash
# Injeta APENAS og:image na landing wabadisparos.com.br (SSR) SEM quebrar o serviço.
#
# Garantias anti-quebra:
#   - backup do router antes de tocar
#   - patch feito FORA do container; valida com `node --check`
#   - só copia de volta + restart se a sintaxe estiver VÁLIDA
#   - após restart, testa HTTP 200 interno; se falhar, ROLLBACK automático
#   - NUNCA usa docker service update --force
#
# Uso (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/og-wabadisparos-safe-vps.sh" -o /tmp/og-safe.sh
#   sed -i 's/\r$//' /tmp/og-safe.sh && chmod +x /tmp/og-safe.sh
#   /tmp/og-safe.sh
set -euo pipefail
set +H

OG_IMAGE="${OG_IMAGE:-https://waba.draxsistemas.com.br/media/OGwaba.jpg}"
OG_TYPE="${OG_TYPE:-image/jpeg}"
OG_WIDTH="${OG_WIDTH:-1200}"
OG_HEIGHT="${OG_HEIGHT:-630}"
ROUTER="/app/.output/server/_ssr/router-aV5ItMUH.mjs"
PORT="${WABA_PORT:-3000}"
FILTER="${WABA_CONTAINER_FILTER:-waba_paginadevendas}"
SITE="https://wabadisparos.com.br"
TS="$(date +%Y%m%d-%H%M%S)"

log() { echo "[$(date -Is)] $*"; }

internal_code() {
  local cid="$1"
  docker exec "$cid" sh -c "wget -qSO- 'http://127.0.0.1:${PORT}/' 2>&1 | head -1" \
    | awk '/HTTP\// {print $2; exit}' || echo "000"
}

CID=$(docker ps -q -f "name=${FILTER}" -f status=running | head -1 || true)
if [[ -z "$CID" ]]; then
  log "ERRO: container ${FILTER} não está running. Rode antes: recover-wabadisparos-502-vps.sh"
  exit 1
fi
log "Container: ${CID}"

pre=$(internal_code "$CID")
log "GET / interno (antes): HTTP ${pre}"
if [[ "$pre" != "200" ]]; then
  log "ERRO: site já não está 200 internamente. Estabilize primeiro (recover-502). Abortando."
  exit 1
fi

# 1) extrair router para o host
WORK=$(mktemp -d)
LOCAL="${WORK}/router.mjs"
docker cp "${CID}:${ROUTER}" "$LOCAL"
cp "$LOCAL" "${LOCAL}.orig"
log "Router extraído ($(wc -c < "$LOCAL") bytes)"

# 2) patch local (Node), com validação embutida
cat > "${WORK}/patch.cjs" << 'EOF'
const fs = require("fs");
const p = process.argv[2];
const img = process.env.OG_IMAGE;
const type = process.env.OG_TYPE;
const w = process.env.OG_WIDTH;
const h = process.env.OG_HEIGHT;
let s = fs.readFileSync(p, "utf8");

// remove blocos og:image antigos (idempotente)
s = s
  .replace(/\n\s*\{ property: "og:image", content: "[^"]*" \},/g, "")
  .replace(/\n\s*\{ property: "og:image:type", content: "[^"]*" \},/g, "")
  .replace(/\n\s*\{ property: "og:image:width", content: "[^"]*" \},/g, "")
  .replace(/\n\s*\{ property: "og:image:height", content: "[^"]*" \},/g, "");

const anchor = '{ property: "og:type", content: "website" },';
if (!s.includes(anchor)) {
  console.error("ANCHOR_NOT_FOUND");
  process.exit(2);
}
const block =
  anchor + "\n" +
  '      { property: "og:image", content: "' + img + '" },\n' +
  '      { property: "og:image:type", content: "' + type + '" },\n' +
  '      { property: "og:image:width", content: "' + w + '" },\n' +
  '      { property: "og:image:height", content: "' + h + '" },';
s = s.replace(anchor, block);
fs.writeFileSync(p, s, "utf8");
console.log("PATCHED");
EOF

OG_IMAGE="$OG_IMAGE" OG_TYPE="$OG_TYPE" OG_WIDTH="$OG_WIDTH" OG_HEIGHT="$OG_HEIGHT" \
  node "${WORK}/patch.cjs" "$LOCAL" || { log "ERRO no patch (âncora?). Abortado, container intocado."; rm -rf "$WORK"; exit 1; }

# 3) validar sintaxe ANTES de aplicar
if ! node --check "$LOCAL" 2>"${WORK}/err.txt"; then
  log "ERRO: sintaxe inválida após patch — NÃO aplicado. Container intocado."
  cat "${WORK}/err.txt" || true
  rm -rf "$WORK"
  exit 1
fi
log "Sintaxe válida (node --check OK)"

# 4) backup dentro do container + aplicar
docker exec "$CID" cp "$ROUTER" "${ROUTER}.bak-${TS}"
docker cp "$LOCAL" "${CID}:${ROUTER}"
log "Aplicado. Backup no container: ${ROUTER}.bak-${TS}"

# 5) restart (sem service update) + validar
docker restart "$CID" >/dev/null
sleep 15
post=$(internal_code "$CID")
log "GET / interno (depois): HTTP ${post}"

if [[ "$post" != "200" ]]; then
  log "FALHA pós-restart (HTTP ${post}) — ROLLBACK automático..."
  docker exec "$CID" cp "${ROUTER}.bak-${TS}" "$ROUTER"
  docker restart "$CID" >/dev/null
  sleep 15
  roll=$(internal_code "$CID")
  log "Após rollback: HTTP ${roll}"
  rm -rf "$WORK"
  exit 1
fi

# 6) confirmar og:image no HTML
og_line=$(docker exec "$CID" sh -c "wget -qO- 'http://127.0.0.1:${PORT}/' 2>/dev/null" | grep -Eo 'og:image"[^>]*content="[^"]*"' | head -1 || true)
log "HTML: ${og_line:-og:image não encontrado no render}"

ext=$(curl -sS -o /dev/null -w "%{http_code}" "${SITE}/" 2>/dev/null || echo "000")
log "Externo: HTTP ${ext} ${SITE}/"

rm -rf "$WORK"
log "OK — og:image aplicado sem quebra."
log "Se externo != 200 mas interno 200: é Swarm/Traefik (não o OG). Rode recover-502 se preciso."
log "Debug Meta: https://developers.facebook.com/tools/debug/?q=${SITE}"
