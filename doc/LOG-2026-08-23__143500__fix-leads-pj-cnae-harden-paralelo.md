# Fix: CNAE harden sob raspagem paralela

## Pedido
Opcao 3: manter paralelo; endurecer so a selecao do CNAE.

## Mudancas
- Poll do search/checkbox no modal (Xvfb)
- Ate 3 retries in-place (CASADOSDADOS_CNAE_RETRIES)
- Timeout 45s/tentativa (CASADOSDADOS_CNAE_TIMEOUT_MS)
- Jitter leve antes do CNAE

## Marker
DEPLOY-2026-08-23-leads-pj-cnae-harden
