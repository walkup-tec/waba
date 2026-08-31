#!/bin/bash
# COLE NO HOSTINGER — corrige formato sinal-verde.yaml (http.routers) + strip SV do main + guard
# NÃO mexe em directory provider / NÃO force Traefik. WABA deve permanecer 200.
set -euo pipefail
mkdir -p /root/waba-infra
cd /root/waba-infra
SHA="${WABA_SCRIPTS_SHA:-e6d3cf6}"
# Prefer master; fallback SHA se CDN atrasar
base="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts"
for f in fix-sinal-verde-isolated-yaml-vps.sh \
         fix-sinal-verde-traefik-safe-vps.sh \
         sinal-verde-overlay-guard-vps.sh \
         traefik-split-sinal-verde-yaml-vps.sh; do
  if ! curl -fsSL "${base}/${f}" -o "$f"; then
    curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/${SHA}/scripts/${f}" -o "$f" || true
  fi
  sed -i 's/\r$//' "$f" 2>/dev/null || true
  chmod +x "$f" 2>/dev/null || true
done

echo "===== FIX FORMATO sinal-verde.yaml ====="
bash ./fix-sinal-verde-isolated-yaml-vps.sh

echo "===== GUARD INSTALL ====="
bash ./sinal-verde-overlay-guard-vps.sh install || true
bash ./sinal-verde-overlay-guard-vps.sh status || true

echo "===== FINAL ====="
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
ls -la /etc/easypanel/traefik/config/sinal-verde.yaml
head -c 400 /etc/easypanel/traefik/config/sinal-verde.yaml; echo
grep -qiE 'sinal-verde|acesso-sinalverde' /etc/easypanel/traefik/config/main.yaml \
  && echo "WARN: main ainda tem SV" || echo "main: limpo SV"
