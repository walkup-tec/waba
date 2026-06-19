#!/bin/bash
# Diagnóstico: 404/502 na Evolution API (walkup-evo-walkup-api).
# Uso no VPS: bash diagnose-walkup-evo-502-vps.sh
set -euo pipefail

EVO_PUBLIC_HOST="${EVO_PUBLIC_HOST:-walkup-evo-walkup-api.achpyp.easypanel.host}"
EVO_NET="${EVO_NET:-easypanel-walkup}"
EVO_PORT="${EVO_PORT:-8080}"
EVO_HOST_PUBLISHED_PORT="${EVO_HOST_PUBLISHED_PORT:-30181}"
EVO_API_KEY="${EVO_API_KEY:-429683C4C977415CAAFCCE10F7D57E11}"
CFG=/etc/easypanel/traefik/config/main.yaml

echo "=== diagnose-walkup-evo $(date -Is) ==="
echo "host=${EVO_PUBLIC_HOST} net=${EVO_NET} port=${EVO_PORT} host_port=${EVO_HOST_PUBLISHED_PORT}"
echo ""

echo "--- containers evo-walkup ---"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -iE 'evo-walkup|walkup-evo' || echo "(nenhum)"
echo ""

echo "--- swarm walkup_evo-walkup-api ---"
docker service ls 2>/dev/null | grep -iE 'evo-walkup|walkup-evo' || echo "(sem serviço)"
docker service inspect walkup_evo-walkup-api --format '{{json .Endpoint.Ports}}' 2>/dev/null || true
echo ""

EVO_CID=$(docker ps -q -f name=evo-walkup-api -f status=running | head -1)
if [[ -z "$EVO_CID" ]]; then
  echo "ERRO: nenhum container running com name~evo-walkup-api"
else
  echo "--- IP overlay (${EVO_NET}) ---"
  docker inspect "$EVO_CID" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'
  echo ""
  echo "--- fetchInstances local no container ---"
  docker exec "$EVO_CID" wget -qO- --timeout=5 --header="apikey: ${EVO_API_KEY}" \
    "http://127.0.0.1:${EVO_PORT}/instance/fetchInstances" 2>&1 | head -2 || echo "FALHOU"
fi
echo ""

echo "--- host gateway (127.0.0.1:${EVO_HOST_PUBLISHED_PORT}) ---"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "apikey: ${EVO_API_KEY}" \
  "http://127.0.0.1:${EVO_HOST_PUBLISHED_PORT}/instance/fetchInstances" 2>/dev/null || echo "FALHOU"
echo ""

TRAEFIK=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -n "$TRAEFIK" ]]; then
  echo "--- via Traefik -> 172.17.0.1:${EVO_HOST_PUBLISHED_PORT} ---"
  docker exec "$TRAEFIK" wget -qO- --timeout=5 --header="apikey: ${EVO_API_KEY}" \
    "http://172.17.0.1:${EVO_HOST_PUBLISHED_PORT}/instance/fetchInstances" 2>&1 | head -2 || echo "FALHOU"
fi
echo ""

echo "--- HTTPS público ---"
for path in / /instance/fetchInstances; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --resolve "${EVO_PUBLIC_HOST}:443:127.0.0.1" --max-time 12 \
    "https://${EVO_PUBLIC_HOST}${path}" 2>/dev/null || echo "000")
  echo "  ${EVO_PUBLIC_HOST}${path} -> ${code}"
done
echo ""

if [[ -f "$CFG" ]]; then
  echo "--- trechos main.yaml (evo-walkup-api) ---"
  grep -n -iE 'evo-walkup-api|walkup_evo-walkup' "$CFG" | head -20 || echo "(sem match)"
fi
echo ""

echo "--- próximo passo ---"
echo "Se host 200 mas HTTPS 404/502: /root/traefik-permanent-walkup-evo-vps.sh install"
echo "Se host falha: Easypanel → walkup → evo-walkup-api → Logs"
