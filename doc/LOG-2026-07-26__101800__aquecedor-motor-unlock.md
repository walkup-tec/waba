# LOG — Motor aquecedor: unlock de pares + soft-skip

## Pedido
Corrigir motor que quase não enviava apesar de expediente 5h–23h / intervalo 120–240s. Testes internos sem rajadas; deixar pronto para deploy.

## Correções
1. Pick com soft-skip (até 12 direções/ciclo) — open/turno/cota/duplicata falham sem `sendText`; tenta outro par
2. Cooldown curto 3 min na direção que falhou open
3. Turn manager: peer fora do ciclo libera origem para outros pares (`lastOutboundTo`)
4. Stale de turno do par: 6h → **90 min**
5. Pick filtra direções já bloqueadas pelo turno (grafo + turn alinhados)
6. Resposta forçada do último par respeita blocked/cooldown (não loop eterno)

## Testes (sem EVO/sendText)
- `node scripts/test-aquecedor-motor-unlock.mjs`
- `node scripts/test-aquecedor-pair-deadlock.cjs`
- `node scripts/test-aquecedor-human-pause-window.mjs`

## Marker
`DEPLOY-2026-07-26-aquecedor-motor-unlock`

## Arquivos
- `src/index.ts` (+ dist)
- `src/aquecedor/relationship-manager.service.ts` (+ dist)
- `src/services/aquecedor-instance-lifecycle.service.ts` (+ dist)
- `scripts/test-aquecedor-motor-unlock.mjs`

## Deploy
Push `master` + Redeploy Node `waba_disparador`; `/health` com o marker.
