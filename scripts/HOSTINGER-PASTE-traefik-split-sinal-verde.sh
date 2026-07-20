#!/bin/bash
# COLE NO HOSTINGER (root) — one-shot: inspect + split + guard
# Valida WABA antes/depois. Sem force Traefik.
set -euo pipefail
mkdir -p /root/waba-infra
cd /root/waba-infra
for f in traefik-inspect-file-provider-vps.sh traefik-split-sinal-verde-yaml-vps.sh \
         fix-sinal-verde-traefik-safe-vps.sh sinal-verde-overlay-guard-vps.sh; do
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/${f}" -o "$f"
  sed -i 's/\r$//' "$f"
  chmod +x "$f"
done
echo "===== INSPECT ====="
bash ./traefik-inspect-file-provider-vps.sh
echo "===== SPLIT RUN ====="
bash ./traefik-split-sinal-verde-yaml-vps.sh run
echo "===== GUARD INSTALL ====="
bash ./sinal-verde-overlay-guard-vps.sh install
echo "===== STATUS ====="
bash ./traefik-split-sinal-verde-yaml-vps.sh status
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
