# LOG — Leads PJ: paginação Xvfb + anti-parada

## Contexto

Retomada travava em `posicionando retomada passo N/25 (UI pág. 5 → 11)` com pool 0. Keepalive mostrava “Ao vivo” sem avançar.

## Causa

1. Checkpoint fantasma (pág. 11) com **pool vazio**.
2. Posicionamento por cliques Playwright lentos/instáveis no Xvfb.
3. Falha no jump **lançava erro** e reiniciava o ciclo em vez de copiar.

## Solução

1. **Service:** pool 0 + checkpoint > 1 → força página 1; reconnect com archived 0 → página 1.
2. **Adapter:** salto via DOM nativo (`click()` / input), aproximação por maior botão visível, next com timeout curto (~10–12s).
3. Se posicionar falhar → **reinicia da página 1** (dedupe no pool) — não para a extração.
4. Marker: `DEPLOY-2026-08-23-1805-leads-pj-pagination-xvfb-v4` (commit `dist/` obrigatório).

## Validar

1. Redeploy `waba_disparador` → `/health` = marker v4.
2. Corban: não deve ficar minutos em `passo X/25` com pool 0.
3. Deve aparecer `Copiando: página N` e `pool` crescendo.
