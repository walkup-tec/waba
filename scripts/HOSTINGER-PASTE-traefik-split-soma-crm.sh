#!/bin/bash
# COLE NO HOSTINGER (root) — isola Soma CRM em soma-crm.yaml + guard
# Valida WABA + Sinal Verde + Soma. Sem force Traefik.
set -euo pipefail
mkdir -p /root/waba-infra
cd /root/waba-infra
base="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts"
for f in fix-soma-crm-isolated-yaml-vps.sh soma-crm-overlay-guard-vps.sh; do
  curl -fsSL "${base}/${f}" -o "$f"
  sed -i 's/\r$//' "$f"
  chmod +x "$f"
done

echo "===== PRECHECK ====="
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
echo -n "soma:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://app.somaconecta.com.br/
echo -n "soma_health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://app.somaconecta.com.br/api/health
echo -n "local30300:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 http://127.0.0.1:30300/api/health || echo 000

echo "===== ISOLATE soma-crm.yaml ====="
bash ./fix-soma-crm-isolated-yaml-vps.sh

echo "===== GUARD INSTALL ====="
bash ./soma-crm-overlay-guard-vps.sh install || true
bash ./soma-crm-overlay-guard-vps.sh status || true

echo "===== FINAL ====="
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
echo -n "soma:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://app.somaconecta.com.br/
echo -n "soma_health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://app.somaconecta.com.br/api/health
ls -la /etc/easypanel/traefik/config/soma-crm.yaml
head -c 350 /etc/easypanel/traefik/config/soma-crm.yaml; echo
grep -qiE 'soma-promotora|gestao-interno|somaconecta' /etc/easypanel/traefik/config/main.yaml \
  && echo "WARN: main ainda tem Soma" || echo "main: limpo Soma"
