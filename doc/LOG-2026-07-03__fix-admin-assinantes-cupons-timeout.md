# Fix timeout Admin Assinantes / Cupons

## Contexto

Na aba **Admin → Assinantes**, as tabelas de **cupons** e **assinantes cadastrados** exibiam `timeout` na célula e «Falha ao carregar» no resumo após ~12s.

## Causa raiz

1. **Backend N+1:** `listSubscribers()` chamava `getCreditsSummary(email)` para **cada** assinante. Esse método, por linha:
   - Lia o JSON completo de pedidos (`orderRepository.list()`)
   - Lia intakes por e-mail (`listByEmail` → `readStore()`)
   - Executava settlement de bônus (possíveis writes)
   - Lia usage e bonus repositories repetidamente

2. **Event loop bloqueado:** com muitos assinantes, a requisição `/admin/subscribers` demorava >12s e bloqueava o Node de forma síncrona. `/admin/coupons` (endpoint leve) também expirava no cliente por fila/contention.

3. **Frontend:** `fetchWithTimeout` rejeitava com `Error("timeout")` e a mensagem aparecia crua na tabela.

## Solução

### Backend (`src/admin/waba-admin-subscribers.service.ts`)

- Pré-indexar pedidos pagos de disparos **uma vez** (`buildPaidDisparosOrdersByEmail`).
- Calcular `contractedValueCents` e `contractedShipments` em memória (`summarizePaidDisparosOrders`).
- Manter intakes pré-indexados por e-mail (já existia).
- **Não** chamar `getCreditsSummary` na listagem (settlement/migração permanecem no detalhe do assinante).

### Frontend (`index.html`)

- Timeout de `/admin/subscribers` e `/admin/coupons`: 12s → **45s**.
- Mensagem amigável na tabela via `resolveAdminSubscriberFetchError` (cupons + assinantes).

## Arquivos alterados

- `src/admin/waba-admin-subscribers.service.ts`
- `index.html`
- `dist/index.html` (via `npm run build`)

## Como validar

1. `npm run build`
2. Abrir **Admin → Assinantes** com usuário master.
3. Cupons e assinantes devem carregar em poucos segundos (não exibir `timeout`).
4. Detalhe de um assinante (`GET /admin/subscribers/:id`) continua com créditos completos via `getCreditsSummary`.

## Segurança

Sem alteração de auth; rotas continuam restritas ao master.

## Palavras-chave

`loadAdminSubscribers`, `listSubscribers`, `getCreditsSummary`, `fetchWithTimeout`, `buildPaidDisparosOrdersByEmail`, timeout admin cupons
