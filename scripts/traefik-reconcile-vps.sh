#!/bin/bash
# Restaura routers/backends: landings (Host público) + formato Easypanel.
# Versão: traefik-reconcile-2026-07-09-v4
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE_LANDING="${DIR}/restore-landing-routers-vps.sh"
RESTORE_EP="${DIR}/restore-easypanel-traefik-backends-vps.sh"

if [[ -f "$RESTORE_LANDING" ]]; then
  SKIP_RECONCILE=1 bash "$RESTORE_LANDING" || true
fi

if [[ -f "$RESTORE_EP" ]]; then
  exec bash "$RESTORE_EP"
fi

echo "ERRO: restore-easypanel-traefik-backends-vps.sh ausente em ${DIR}"
exit 1
