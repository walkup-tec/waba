#!/usr/bin/env bash
# Diagnóstico: Evolution API P1001 — Can't reach database server
# Uso no VPS (root): bash /root/diagnose-evo-postgres-vps.sh

set -euo pipefail

EVO_SVC="${EVO_SWARM_SERVICE:-walkup_evo-walkup-api}"
DB_SVC="${EVO_DB_SWARM_SERVICE:-walkup_evo-walkup-api-db}"
REDIS_SVC="${EVO_REDIS_SWARM_SERVICE:-walkup_evo-walkup-api-redis}"

echo "=== Evolution / PostgreSQL — $(date -Is) ==="
echo

echo "--- Docker Swarm ---"
systemctl is-active docker 2>/dev/null || true
docker info --format 'Swarm: {{.Swarm.LocalNodeState}}' 2>/dev/null || true
echo

echo "--- Serviços walkup (evo + db + redis) ---"
docker service ls 2>/dev/null | grep -E 'walkup|evo' || echo "(nenhum serviço walkup/evo listado)"
echo

for svc in "$DB_SVC" "$EVO_SVC" "$REDIS_SVC"; do
  echo "--- Tasks: $svc ---"
  docker service ps "$svc" --no-trunc 2>/dev/null | head -8 || echo "  serviço $svc não encontrado"
  echo
done

echo "--- Porta host Evolution (30181) ---"
ss -tlnp 2>/dev/null | grep ':30181' || echo "  :30181 não escuta (publish-add pode faltar)"
echo

echo "--- Teste HTTP Evolution local ---"
curl -sS -o /dev/null -w "  fetchInstances: HTTP %{http_code}\n" --max-time 8 \
  -H "apikey: ${EVO_API_KEY:-}" \
  "http://127.0.0.1:30181/instance/fetchInstances" 2>/dev/null \
  || echo "  curl falhou (EVO down ou API key)"
echo

echo "--- Logs recentes DB (últimas 15 linhas) ---"
docker service logs "$DB_SVC" --tail 15 2>/dev/null || echo "  sem logs do $DB_SVC"
echo

echo "--- Logs recentes Evolution (últimas 20 linhas) ---"
docker service logs "$EVO_SVC" --tail 20 2>/dev/null || echo "  sem logs do $EVO_SVC"
echo

echo "=== Interpretação rápida ==="
echo "• P1001 + DB com 0/1 ou Failed → subir/recriar PostgreSQL no Easypanel ANTES da Evolution."
echo "• DB 1/1 e EVO ainda P1001 → rede overlay; restart DB depois EVO: docker service update --force $DB_SVC && sleep 20 && docker service update --force $EVO_SVC"
echo "• DB ausente no 'docker service ls' → serviço evo-walkup-api-db deletado no Easypanel; restaurar volume/backup ou recriar app DB no projeto walkup."
echo
