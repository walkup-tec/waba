#!/bin/bash
# Correção imediata wabadisparos + bet — restaura backends Easypanel (sem scripts legados).
# Versão: fix-wabadisparos-bet-2026-07-09-v4
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/restore-easypanel-traefik-backends-vps.sh"
