#!/bin/bash
# Restaura routers landings (Host público + backend 172.17.0.1).
# NÃO roda restore-easypanel-backends — ele reverte backends e derruba todos os sites.
# Versão: traefik-reconcile-2026-07-09-v5
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE_LANDING="${DIR}/restore-landing-routers-vps.sh"

if [[ -f "$RESTORE_LANDING" ]]; then
  exec bash "$RESTORE_LANDING"
fi

echo "ERRO: restore-landing-routers-vps.sh ausente em ${DIR}"
exit 1
