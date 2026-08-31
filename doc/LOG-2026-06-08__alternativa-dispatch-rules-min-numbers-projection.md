# LOG — API Alternativa: regras de compra, throttle 300/dia, projeção campanha

**Data:** 2026-06-08  
**Serviço:** waba_disparador  
**Marker:** `DEPLOY-2026-06-08-alternativa-dispatch-rules-ux`

## Solicitação

- Mínimo **3 números ativados** para disparar (motor).
- Picker de ativação só após **4+ números comprados** (cumulativo).
- Remover **Temporizador** e **Limite de segurança** da UI do assinante (disparo-evo).
- Backend calcula throttle para **máx. 300 envios/dia/número**.
- Etapa Campanha: quantidade de envios + projeção de tempo (como API Oficial).
- UX alinhado ao fluxo atual.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/disparos/alternativa-dispatch-rules.ts` | Constantes + throttle + estimativa duração |
| `src/billing/waba-alternativa-numbers.service.ts` | `dispatchRules`, `canPickNumbers`, `canSend` no summary |
| `src/index.ts` | Auto-throttle, limite diário por instância, validação min 3, `/disparos/alternativa/estimate` |
| `index.html` | UI: painel regras, picker bloqueado <4, campanha evo com qty + projeção, wizard alternativa |
| `src/deploy-marker.ts` | Marker deploy |

## Validação

- `npm run build` — OK (tsc + copy index.html)
- V02 reiniciado em `http://localhost:3012/version-02/`
- `GET /version-02/health` → `deployMarker: DEPLOY-2026-06-08-alternativa-dispatch-rules-ux`, `wabaEnv: v02`

## Pendências

- Commit/push `master` + redeploy Easypanel pelo usuário
- Teste V02: `npm run dev:v02` — fluxo comprar → ativar (≥4 comprados, ≥3 ativos) → campanha com projeção

## Chats abertas

- Regras API Alternativa números + campanha (este item)
