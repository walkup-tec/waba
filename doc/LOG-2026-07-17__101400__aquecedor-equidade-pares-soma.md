# LOG — Aquecedor: pares só Drax↔Walkup / Soma fora do ciclo + contador “…”

**Data:** 2026-07-17 10:14 BRT  
**Marker:** `DEPLOY-2026-07-17-aquecedor-equidade-janela-24h`

## Contexto do pedido

Usuário: “Não estamos tendo pares entre todos. Somente Drax e Walkup trocaram mensagem entre si. A Soma não entrou no ciclo. E não está exibindo a quantidade de instâncias ativas no aquecedor.”

UI: lista Envios só `Drax ↔ walkup`; status `Aquecedor em pausa · instâncias: …`.

## Diagnóstico

### Identidade das instâncias (EVO)

| Alias UI | Nome técnico EVO | Número | Owner |
|---|---|---|---|
| Drax | `1321-01` | 555181082477 | mozart.pmo@gmail.com |
| walkup | `walkup` | 555197462102 | mozart.pmo@gmail.com |
| Soma | `soma` | 555197979224 | mozart.pmo@gmail.com |

Todas open/live. Soma **não** está desconectada.

### Causa raiz — equidade acumulada (histórico eterno)

`loadAquecedorTurnManager` usava **todo** o lookback (500 eventos, desde ~16/06) para contadores de equidade (`sendCount`, `receiveCount`, `directedSendCounts`).

Simulação (`scripts/simulate-aquecedor-pick.cjs`) com dados reais:

- `soma|walkup` = **281** trocas históricas → score de `walkup→soma` explosivo
- Última troca soma↔walkup: **08/07** (9 dias)
- Desde então o ciclo “hub” ficou em `1321-01 ↔ walkup` e `1321-01 ↔ soma`
- `soma→walkup` bloqueado por “soma enviou por último no par” (turno antigo nunca expirava)
- Escolhido sempre o par menos saturado **dentro dos elegíveis**, que raramente incluía soma↔walkup

### Contador “instâncias: …”

`connectedSummary` vivia só em memória. Após redeploy/boot, `count=0` até o próximo ciclo → UI mostra `instâncias: …` enquanto `running`/`desired`.

## Solução

1. **Janela de equidade 24h** (`AQUECEDOR_TURN_EQUITY_WINDOW_MS`): contadores de score usam só eventos recentes; turno A↔B e `outboundSinceInbound` continuam no histórico completo (anti-spam).
2. **Turno de par stale 6h** (`AQUECEDOR_PAIR_TURN_STALE_MS`): se o par não troca há >6h, limpa `lastSender` / `pendingReplyFrom` (e zera `outboundSinceInbound` se o último envio da instância também for antigo).
3. **Persistir `connectedSummary`** em `runtime-intent.json` (por owner) + restaurar no reload.
4. **GET `/aquecedor/status`**: se `desired=true` e summary >2 min / ausente, refresca contagem (resolve EVO + lifecycle) e persiste.

### Validação offline

Após o patch, a mesma simulação escolhe: **`soma → walkup`** (par esquecido volta ao ciclo).

## Arquivos

- `src/index.ts` — turn manager + status refresh
- `src/services/aquecedor-owner-runtime.registry.ts` — persistência do summary
- `src/deploy-marker.ts`
- `dist/index.js`, `dist/services/aquecedor-owner-runtime.registry.js`, `dist/deploy-marker.js`
- `scripts/simulate-aquecedor-pick.cjs`

## Como validar em produção

1. Redeploy `waba_disparador` no Easypanel.
2. `/health` → `deployMarker: DEPLOY-2026-07-17-aquecedor-equidade-janela-24h`.
3. UI: contador deve mostrar `N instâncias no ciclo` (não `…`).
4. Em Envios: em alguns ciclos deve aparecer `soma ↔ walkup` (além de pares com Drax/`1321-01`).

## Keywords

`aquecedor`, `pares`, `equidade`, `janela 24h`, `stale turn`, `soma`, `walkup`, `1321-01`, `Drax`, `connectedInstanceCount`, `instâncias: …`
