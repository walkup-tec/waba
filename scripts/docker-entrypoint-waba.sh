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

exec "$@"
