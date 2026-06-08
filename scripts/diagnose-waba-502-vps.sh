#!/bin/bash
# Diagnóstico rápido: 502 em waba.draxsistemas.com.br (Traefik × waba_disparador).
# Uso no VPS: bash diagnose-waba-502-vps.sh
set -euo pipefail

WABA_PUBLIC_HOST="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
WABA_NET="${WABA_NET:-easypanel-waba}"
WABA_PORT="${WABA_PORT:-3000}"
CFG=/etc/easypanel/traefik/config/main.yaml

echo "=== diagnose-waba-502 $(date -Is) ==="
echo "host=${WABA_PUBLIC_HOST} net=${WABA_NET} port=${WABA_PORT}"
echo ""

echo "--- containers waba ---"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -i waba || echo "(nenhum)"
echo ""

echo "--- swarm waba_disparador ---"
docker service ls 2>/dev/null | grep -i waba || echo "(sem serviço swarm waba)"
docker service ps "$(docker service ls --format '{{.Name}}' 2>/dev/null | grep -i waba_disparador | head -1)" 2>/dev/null \
  | head -8 || true
echo ""

WABA_CID=$(docker ps -q -f name=waba_disparador -f status=running | head -1)
if [[ -z "$WABA_CID" ]]; then
  echo "ERRO: nenhum container running com name~waba_disparador"
else
  echo "--- IP overlay (${WABA_NET}) ---"
  docker inspect "$WABA_CID" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'
  WABA_IP=$(docker inspect "$WABA_CID" --format "{{index .NetworkSettings.Networks \"${WABA_NET}\" \"IPAddress\"}}" 2>/dev/null || true)
  echo "WABA_IP=${WABA_IP:-?}"
  echo ""
  echo "--- health local no container ---"
  docker exec "$WABA_CID" wget -qO- --timeout=5 "http://127.0.0.1:${WABA_PORT}/health" 2>&1 | head -3 || echo "FALHOU"
fi
echo ""

TRAEFIK=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -n "$TRAEFIK" && -n "${WABA_IP:-}" ]]; then
  echo "--- health via rede (Traefik -> WABA) ---"
  docker exec "$TRAEFIK" wget -qO- --timeout=5 "http://${WABA_IP}:${WABA_PORT}/health" 2>&1 | head -3 \
    || echo "FALHOU (Traefik não alcança o app — rede ou IP morto)"
else
  echo "AVISO: Traefik ou WABA_IP ausente para teste de rede"
fi
echo ""

echo "--- HTTPS público (resolve 127.0.0.1 no VPS) ---"
for path in / /health; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --resolve "${WABA_PUBLIC_HOST}:443:127.0.0.1" --max-time 12 \
    "https://${WABA_PUBLIC_HOST}${path}" 2>/dev/null || echo "000")
  echo "  ${WABA_PUBLIC_HOST}${path} -> ${code}"
done
echo ""

if [[ -f "$CFG" ]]; then
  echo "--- trechos main.yaml (waba) ---"
  grep -n -iE 'waba|draxsistemas' "$CFG" | head -30 || echo "(sem match)"
else
  echo "AVISO: ${CFG} não encontrado"
fi
echo ""

echo "--- próximo passo ---"
echo "Se app OK na rede mas HTTPS 502: /root/traefik-permanent-waba-vps.sh install"
echo "Se app não sobe: Easypanel → waba → waba_disparador → Logs / Redeploy"
