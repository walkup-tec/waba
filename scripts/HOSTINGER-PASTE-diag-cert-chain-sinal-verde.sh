#!/bin/bash
# COLE NO HOSTINGER (root) — READ-ONLY. Mostra a CADEIA completa servida + config ACME.
# Objetivo: confirmar se o cert cai na hierarquia nova (Root YR/YE) não confiável nos navegadores.
set -uo pipefail
DOMAIN=acesso-sinalverde.com

echo "=== 1) Cadeia COMPLETA servida (SNI ${DOMAIN}) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" -showcerts 2>/dev/null \
  | grep -E 's:|i:' | sed 's/^/  /'
echo
echo "=== 2) Verificação de confiança (como um cliente faria) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null \
  | grep -iE 'Verify return code|verification'
echo
echo "=== 3) Config ACME do resolver letsencrypt (preferredChain?) ==="
docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'ACME' | sed -E 's/(EMAIL=|STORAGE=).*/\1***/' | sed 's/^/  /'
echo "  (procurando PREFERREDCHAIN / CASERVER acima — se ausente, usa produção default)"
echo
echo "=== 4) Emissor do leaf (resumo) ==="
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -issuer -subject 2>/dev/null | sed 's/^/  /'
echo
echo "LEITURA:"
echo "  - Se aparecer 'Root YR'/'Root YE' no fim da cadeia (item 1) e Verify != 0 => cadeia nova não confiável"
echo "  - Fix definitivo = preferredChain 'ISRG Root X1' no resolver (INFRA compartilhada) OU reemissão"
