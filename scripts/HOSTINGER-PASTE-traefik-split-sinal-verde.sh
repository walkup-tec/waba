#!/bin/bash
# COLE NO HOSTINGER (root) — continua split (inspect já confirmou MODE=directory)
# v2: retry health + heal login se 502 transitório; depois split + guard
set -euo pipefail
mkdir -p /root/waba-infra
cd /root/waba-infra
for f in traefik-split-sinal-verde-yaml-vps.sh \
         fix-sinal-verde-traefik-safe-vps.sh sinal-verde-overlay-guard-vps.sh; do
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/${f}" -o "$f"
  sed -i 's/\r$//' "$f"
  chmod +x "$f"
done

echo "===== PRECHECK WABA ====="
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "local30180:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 http://127.0.0.1:30180/health || echo 000

H=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 https://waba.draxsistemas.com.br/health || echo 000)
if [[ "$H" != "200" ]]; then
  echo "===== HEAL LOGIN (health=$H) ====="
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" \
    -o /tmp/heal-waba-login-vps.sh
  sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
  bash /tmp/heal-waba-login-vps.sh run || true
  sleep 5
fi

echo "===== SPLIT RUN (v2) ====="
bash ./traefik-split-sinal-verde-yaml-vps.sh run
echo "===== GUARD INSTALL ====="
bash ./sinal-verde-overlay-guard-vps.sh install
echo "===== STATUS ====="
bash ./traefik-split-sinal-verde-yaml-vps.sh status
ls -la /etc/easypanel/traefik/config/sinal-verde.yaml || true
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
grep -qiE 'sinal-verde|acesso-sinalverde' /etc/easypanel/traefik/config/main.yaml \
  && echo "WARN: main ainda tem SV" || echo "main: limpo SV"
