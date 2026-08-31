#!/usr/bin/env bash
# WABA container entrypoint — sobe Xvfb para Leads PJ (Casa dos Dados).
# Headless Chromium é bloqueado pelo anti-bot; no V02 a janela é visível e passa.
# No Docker usamos display virtual (:99) e Playwright com headless:false.
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"

if command -v Xvfb >/dev/null 2>&1; then
  if ! pgrep -f "Xvfb ${DISPLAY}" >/dev/null 2>&1; then
    Xvfb "${DISPLAY}" -screen 0 1440x900x24 -ac -nolisten tcp \
      >/tmp/waba-xvfb.log 2>&1 &
    sleep 0.8
  fi
fi

# Fase B — diagnóstico /dev/shm (Playwright/Chromium).
if [[ -d /dev/shm ]]; then
  shm_line="$(df -h /dev/shm 2>/dev/null | tail -n1 || true)"
  echo "[entrypoint] /dev/shm: ${shm_line}"
  # Aviso se parecer o default Docker 64M (sem alterar mount — precisa Swarm tmpfs).
  if echo "${shm_line}" | grep -Eqi '64M|63M|62M'; then
    echo "[entrypoint] AVISO: /dev/shm ~64M — Chromium longo pode crashar. Rode scripts/waba-leads-pj-shm-swarm.sh apply no VPS."
  fi
fi

exec "$@"
