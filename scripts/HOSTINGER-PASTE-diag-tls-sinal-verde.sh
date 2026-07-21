#!/bin/bash
# COLE NO HOSTINGER (root) — DIAGNÓSTICO read-only do TLS/ACME do Sinal Verde.
# NÃO altera nada. Só lê env do Traefik, acme.json e testa o certificado servido.
set -uo pipefail

DIR=/etc/easypanel/traefik/config
SV=$DIR/sinal-verde.yaml
DOMAIN=acesso-sinalverde.com

echo "=================================================="
echo " DIAGNÓSTICO TLS / ACME — $DOMAIN (read-only)"
echo " $(date -Is)"
echo "=================================================="

echo "--- 1) Resolvers ACME definidos no Traefik (static/env) ---"
docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'CERTIFICATESRESOLVERS|ACME|ENTRYPOINTS' \
  | sed -E 's/(STORAGE=|EMAIL=).*/\1***/' || echo "  (nenhum CERTIFICATESRESOLVERS no env)"

echo "--- 2) certResolver pedido no nosso sinal-verde.yaml ---"
grep -iE 'certResolver|entryPoints|main|sans' "$SV" 2>/dev/null || echo "  SV yaml ausente"

echo "--- 3) acme.json: domínios já emitidos ---"
ACME=$(docker service inspect easypanel-traefik \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'ACME_STORAGE=' | head -1 | cut -d= -f2 || true)
# candidatos comuns
for f in "$ACME" /etc/easypanel/traefik/acme.json /data/acme.json \
         /etc/easypanel/traefik/config/acme.json; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  echo "  arquivo: $f ($(wc -c <"$f") bytes)"
  grep -oE '"main":"[^"]+"' "$f" 2>/dev/null | sort -u | sed 's/^/    /' || true
  grep -oiE 'acesso-sinalverde[^"]*' "$f" 2>/dev/null | sort -u | sed 's/^/    (match SV) /' || echo "    (SEM acesso-sinalverde no acme.json)"
done
# também dentro do container, caso o storage seja interno
CID=$(docker ps --filter name=easypanel-traefik --format '{{.ID}}' | head -1)
if [ -n "${CID:-}" ]; then
  echo "  (container) procurando acme.json dentro do Traefik:"
  docker exec "$CID" sh -c 'for p in /data/acme.json /etc/traefik/acme.json /acme.json; do [ -f "$p" ] && echo "    $p $(wc -c <"$p")b" && grep -oE "\"main\":\"[^\"]+\"" "$p" | sort -u | sed "s/^/      /"; done' 2>/dev/null || true
fi

echo "--- 4) Certificado que o Traefik ENTREGA para o domínio (via SNI local) ---"
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates 2>/dev/null \
  | sed 's/^/  /' || echo "  (falha ao ler cert)"

echo "--- 5) Desafio HTTP-01 alcança o Traefik? (porta 80 pública) ---"
echo -n "  http .well-known (local :80 Host): "
curl -sS -o /dev/null -w '%{http_code}\n' -m 10 \
  -H "Host: ${DOMAIN}" "http://127.0.0.1:80/.well-known/acme-challenge/probe-test" || echo 000
echo -n "  http público (segue redirect?): "
curl -sSI -m 12 "http://${DOMAIN}/" 2>/dev/null | grep -iE '^HTTP|^location' | sed 's/^/    /' || echo "    (sem resposta)"

echo "--- 6) DNS do domínio (deve apontar para este VPS) ---"
getent hosts "$DOMAIN" | sed 's/^/  /' || true
getent hosts "www.${DOMAIN}" | sed 's/^/  /' || true
echo "  IP público deste VPS:"; curl -sS -m 8 https://api.ipify.org 2>/dev/null | sed 's/^/    /' || true

echo "=================================================="
echo " LEITURA:"
echo "  - Item 4 'issuer=...Let's Encrypt' = cert OK; 'TRAEFIK DEFAULT CERT' = ACME não emitiu"
echo "  - Item 1 vs 2: o certResolver do SV yaml PRECISA existir no item 1"
echo "  - Item 3 sem acesso-sinalverde = nunca emitiu; item 5 404/000 = desafio não chega"
echo "  - Item 6: IP do domínio != IP do VPS => ACME nunca vai validar"
echo "=================================================="
