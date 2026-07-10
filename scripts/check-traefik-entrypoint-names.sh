#!/usr/bin/env bash
# Falha se scripts do repo ainda gerarem entryPoints web/websecure (Easypanel VPS usa http/https).
# Uso local/CI: bash scripts/check-traefik-entrypoint-names.sh
# Versão: check-traefik-entrypoint-names-2026-07-10-v1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Arquivos que ESCREVEM routers no main.yaml Easypanel (não docs genéricas Traefik)
TARGETS=(
  scripts/fix-bet-route-30211-vps.sh
  scripts/fix-bet-404-definitivo-vps.sh
  scripts/bet-watchdog-vps.sh
  scripts/restore-landing-routers-vps.sh
  scripts/traefik-rebuild-landings-clean-vps.sh
  scripts/traefik-recover-443-minimal-vps.sh
  scripts/traefik-permanent-waba-vps.sh
  scripts/sync-v02-paridade-producao-vps.sh
  scripts/infra/traefik-entrypoint-guard-vps.sh
)

fail=0
echo "=== check Traefik entryPoints (proibido: web / websecure em geradores) ==="
for f in "${TARGETS[@]}"; do
  path="$ROOT/$f"
  [[ -f "$path" ]] || { echo "MISSING $f"; fail=1; continue; }
  # Permitir menções em comentários / strings de detecção ("websecure" in body)
  # Proibir atribuição de entryPoints para web/websecure
  if grep -nE 'entryPoints["\x27\][:\s]*\[.*"websecure"|entryPoints["\x27\][:\s]*\[.*"web"[^\]]|-\s*websecure\s*$|entryPoints:\s*\n\s*-\s*websecure|entryPoints:\s*\n\s*-\s*web\s*$|"entryPoints":\s*\["web"\]|"entryPoints":\s*\["websecure"\]' "$path" 2>/dev/null; then
    echo "FAIL $f — ainda gera web/websecure"
    fail=1
  elif grep -nE '"entryPoints":\s*\["web(secure)?"\]' "$path"; then
    echo "FAIL $f"
    fail=1
  else
    echo "OK $f"
  fi
done

# Varredura ampla em scripts/*vps*.sh por literais perigosos em templates
while IFS= read -r hit; do
  echo "WARN literal: $hit"
  # só falha se for assignment entryPoints
  if echo "$hit" | grep -qE 'entryPoints.*web'; then
    fail=1
  fi
done < <(grep -RnE '"entryPoints":\s*\["web(secure)?"\]|entryPoints:\s*$' "$ROOT/scripts" --include='*vps*.sh' 2>/dev/null | grep -E 'websecure|"web"' || true)

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Use entryPoints http/https neste VPS (TRAEFIK_ENTRYPOINTS_HTTP/HTTPS)."
  echo "Ver: scripts/infra/traefik-entrypoint-guard-vps.sh + .cursor/rules/ucp-traefik-static-dynamic.mdc"
  exit 1
fi
echo "All good."
