#!/bin/bash
# COLE NO HOSTINGER (root) — AUDITORIA read-only da contingência do Sinal Verde.
# NÃO altera nada: sem docker update, sem escrita em YAML, sem systemctl enable/start.
# Só systemctl is-active/is-enabled, docker inspect, curl e leitura de arquivos.
set -uo pipefail

DIR=/etc/easypanel/traefik/config
MAIN=$DIR/main.yaml
SV=$DIR/sinal-verde.yaml
CRM=sinal-verde_acesso-sinalverde
HOST_PORT=30310
DOMAIN=acesso-sinalverde.com

ok() { printf '  [OK]   %s\n' "$*"; }
bad() { printf '  [FALHA]%s\n' " $*"; }
info() { printf '  [ .. ] %s\n' "$*"; }
probe() { curl -sk -o /dev/null -m 12 -w '%{http_code}' "$@" 2>/dev/null || printf '000'; }

echo "=================================================="
echo " AUDITORIA CONTINGÊNCIA SINAL VERDE (read-only)"
echo " $(date -Is)"
echo "=================================================="

echo "--- 1) Unidades systemd (devem estar active/enabled) ---"
for u in heal-sinal-verde.timer heal-sinal-verde-watch.service \
         sinal-verde-main-yaml.path \
         sinal-verde-overlay-guard.timer sinal-verde-overlay-guard-watch.service; do
  act=$(systemctl is-active "$u" 2>/dev/null || echo inactive)
  ena=$(systemctl is-enabled "$u" 2>/dev/null || echo disabled)
  if [ "$act" = "active" ]; then ok "$u ($act/$ena)"; else bad "$u ($act/$ena)"; fi
done

echo "--- 2) Timer: última execução / próxima ---"
systemctl list-timers 'heal-sinal-verde*' 'sinal-verde*' --all 2>/dev/null | head -8

echo "--- 3) Scripts instalados em /root/waba-infra ---"
for f in heal-sinal-verde-pos-redeploy-vps.sh sinal-verde-overlay-guard-vps.sh \
         fix-sinal-verde-isolated-yaml-vps.sh traefik-split-sinal-verde-yaml-vps.sh; do
  if [ -x "/root/waba-infra/$f" ]; then ok "$f"; else bad "$f ausente"; fi
done

echo "--- 4) Publish :$HOST_PORT do CRM (host mode) ---"
ports=$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo null)
echo "  $ports"
if echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then ok "publish :$HOST_PORT presente"; else bad "publish :$HOST_PORT AUSENTE"; fi
rep=$(docker service ls --filter "name=${CRM}" --format '{{.Replicas}}' 2>/dev/null | head -1)
info "replicas CRM = ${rep:-?}"

echo "--- 5) sinal-verde.yaml (isolado, backend host-gateway) ---"
if [ -f "$SV" ]; then
  ok "existe ($(wc -c <"$SV") bytes)"
  grep -q "172.17.0.1:${HOST_PORT}" "$SV" && ok "backend = 172.17.0.1:${HOST_PORT}" || bad "backend NÃO aponta 172.17.0.1:${HOST_PORT}"
  grep -q '"https"' "$SV" && ok "entryPoint https" || bad "sem entryPoint https"
  grep -q 'certResolver' "$SV" && ok "certResolver presente" || info "sem certResolver explícito"
else
  bad "$SV ausente"
fi

echo "--- 6) main.yaml limpo de Sinal Verde (isolamento) ---"
if grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null; then
  bad "main.yaml AINDA tem chaves SV (path unit deve stripar)"
else
  ok "main.yaml limpo de SV"
fi
grep -q 'wabadisparos.com.br' "$MAIN" 2>/dev/null && ok "main.yaml tem WABA (disparos)" || bad "main.yaml SEM wabadisparos"

echo "--- 7) File provider do Traefik (directory + watch) ---"
docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'PROVIDERS_FILE' || info "(sem PROVIDERS_FILE_* explícito no env)"

echo "--- 8) Probes (com -k; --resolve p/ Traefik local) ---"
echo "  local  :$HOST_PORT = $(probe http://127.0.0.1:${HOST_PORT}/)"
echo "  sv      (público)  = $(probe https://${DOMAIN}/)"
echo "  sv      (local TLS)= $(probe --resolve ${DOMAIN}:443:127.0.0.1 https://${DOMAIN}/)"
echo "  disparos           = $(probe https://wabadisparos.com.br/)"
echo "  bet                = $(probe https://bet.waba.info/)"
echo "  soma               = $(probe https://app.somaconecta.com.br/api/health)"

echo "--- 9) Secret do workflow (informativo) ---"
info "GitHub repo sinal-verde-pro precisa da secret VPS_SSH_PRIVATE_KEY p/ heal pós-push (verifique no GitHub, não dá p/ checar daqui)"

echo "=================================================="
echo " RESUMO: [FALHA] em 1,3,4,5 = contingência incompleta → rodar install do heal"
echo "         [OK] em tudo = contingência ativa; 502 pós-redeploy só janela curta"
echo "=================================================="
