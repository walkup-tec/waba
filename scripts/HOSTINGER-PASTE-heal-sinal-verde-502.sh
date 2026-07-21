#!/bin/bash
# COLE NO HOSTINGER (root) — diagnóstico + heal Sinal Verde 502
# Só toca no serviço sinal-verde_acesso-sinalverde e no sinal-verde.yaml. NÃO toca WABA/Soma.
set -uo pipefail

CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
SV_YAML="/etc/easypanel/traefik/config/sinal-verde.yaml"

echo "===== DIAGNOSTICO ====="
docker service ls --filter name=sinal-verde --format 'service={{.Name}} replicas={{.Replicas}} image={{.Image}}'
docker service ps "$CRM" --no-trunc --format '{{.Name}} {{.CurrentState}} {{.Error}}' 2>/dev/null | head -5
echo -n "publish: "; docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo "null"
echo -n "local :${HOST_PORT}: "; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 "http://127.0.0.1:${HOST_PORT}/" || echo 000
echo -n "sv_yaml: "; [ -f "$SV_YAML" ] && echo present || echo MISSING
echo -n "guard timer: "; systemctl is-active sinal-verde-overlay-guard.timer 2>/dev/null
echo -n "guard watch: "; systemctl is-active sinal-verde-overlay-guard-watch.service 2>/dev/null
echo "--- guard log (últimas 10) ---"
tail -10 /var/log/sinal-verde-overlay-guard.log 2>/dev/null

echo "===== HEAL ====="
# 1) container do CRM rodando?
replicas=$(docker service ls --filter "name=${CRM}" --format '{{.Replicas}}' | head -1)
if [ "${replicas:-0/1}" != "1/1" ]; then
  echo "CRM ${replicas} — tentando estabilizar (rollback de task com erro)"
  docker service update --detach=true "$CRM" >/dev/null 2>&1 || true
  for i in $(seq 1 20); do
    sleep 5
    replicas=$(docker service ls --filter "name=${CRM}" --format '{{.Replicas}}' | head -1)
    [ "$replicas" = "1/1" ] && break
  done
  echo "replicas agora: ${replicas}"
fi

# 2) publish :30310
if ! docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null | grep -q "\"PublishedPort\":${HOST_PORT}"; then
  echo "publish :${HOST_PORT} ausente — republicando"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
    "$CRM" || true
  sleep 5
fi
echo -n "local :${HOST_PORT} pós-heal: "; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 "http://127.0.0.1:${HOST_PORT}/" || echo 000

# 3) guard run (garante yaml + url canônica)
[ -x /root/waba-infra/sinal-verde-overlay-guard-vps.sh ] && /root/waba-infra/sinal-verde-overlay-guard-vps.sh run

sleep 8
echo "===== FINAL ====="
echo -n "sv:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://acesso-sinalverde.com/
echo -n "disparos:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://wabadisparos.com.br/
echo -n "bet:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://bet.waba.info/
echo -n "health:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://waba.draxsistemas.com.br/health
echo -n "soma_h:"; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 https://app.somaconecta.com.br/api/health
echo "--- se sv ainda 502, colar aqui: docker service logs ${CRM} --tail 30 ---"
