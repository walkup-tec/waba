#!/bin/bash
# Restaura routers/backends ao formato Easypanel (sem 172.17.0.1 inventado).
# Delega para restore-easypanel-traefik-backends-vps.sh
#
# Versão: traefik-reconcile-2026-07-09-v3
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${DIR}/restore-easypanel-traefik-backends-vps.sh"
