#!/bin/bash
# COLE NO HOSTINGER (root) — restaura Sinal Verde SEM tocar backends WABA
# 1) Instala heal isolado (timer + watch + path no main.yaml)
# 2) Regenera sinal-verde.yaml + publish :30310
# 3) Strip seguro de chaves SV no main (com rollback se WABA cair)
set -uo pipefail

REPO="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts"

echo "===== PRE ====="
curl -sS -o /dev/null -w "disparos:%{http_code}\n" --max-time 12 https://wabadisparos.com.br/ || true
curl -sS -o /dev/null -w "sv:%{http_code}\n" --max-time 12 https://acesso-sinalverde.com/ || true

curl -fsSL "${REPO}/heal-sinal-verde-pos-redeploy-vps.sh" -o /tmp/heal-sv.sh
sed -i 's/\r$//' /tmp/heal-sv.sh
chmod +x /tmp/heal-sv.sh
bash /tmp/heal-sv.sh install
bash /tmp/heal-sv.sh burst
bash /tmp/heal-sv.sh status

echo "===== POS ====="
curl -sS -o /dev/null -w "disparos:%{http_code}\n" --max-time 12 https://wabadisparos.com.br/ || true
curl -sS -o /dev/null -w "bet:%{http_code}\n" --max-time 12 https://bet.waba.info/ || true
curl -sS -o /dev/null -w "sv:%{http_code}\n" --max-time 12 https://acesso-sinalverde.com/ || true
curl -sS -o /dev/null -w "soma:%{http_code}\n" --max-time 12 https://app.somaconecta.com.br/api/health || true
echo "DONE — se disparos!=200, NÃO rode mais nada; cole a saída no chat"
