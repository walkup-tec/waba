# LOG — Dashboard Aquecedor: cache para carregamento rápido

**Data:** 2026-06-25  
**Pedido:** Demora ao carregar o dashboard do Aquecedor; exibir informações rapidamente (cache ou recurso similar).

## Contexto

O dashboard (`#tab-dashboard`) ficava em "Carregando dados de envios... Conectando no servidor de dados" até `GET /dados` responder (até 15s). A rota consulta Supabase (`logs_envios_br`) com até 2000–5000 linhas e, em range, paginação pesada para `countsBySender`.

Já existia cache em memória (`rawEvents`) apenas durante a sessão, sem persistência — ao recarregar a página ou na primeira visita, a tela ficava vazia.

## Solução

### Frontend (`index.html`)

- Cache **localStorage** por usuário + URL de `/dados` (filtro/range), TTL 30 min.
- Funções: `buildDadosFetchUrl`, `persistDashboardDadosCache`, `restoreDashboardDadosCache`, `hydrateDashboardFromLocalCache`, `applyDashboardDadosPayload`.
- **No login:** hidrata dashboard a partir do cache (antes de abrir a aba).
- **Em `carregar()`:** se houver cache, renderiza imediatamente (métricas, lista, gráficos) e busca dados frescos em background.
- **Fallback:** se `/dados` falhar e não houver dados em memória, tenta localStorage antes de mostrar erro.

Padrão alinhado ao cache de instâncias (`persistInstancesLocalCache` / `hydrateInstancesFromLocalCache`).

### Backend (`src/index.ts`)

- Cache **in-memory** TTL 45s em `GET /dados` (chave `default` ou `range:start:end`).
- Headers: `Cache-Control: private, max-age=30`, `X-Waba-Dados-Cache: hit|miss`.
- Reduz hits repetidos ao Supabase (refresh automático a cada 15s na UI).

## Arquivos alterados

- `index.html` — cache local + hidratação no login e em `carregar()`
- `src/index.ts` — cache TTL em `/dados`
- `src/deploy-marker.ts` — `DEPLOY-2026-06-25-aquecedor-dashboard-dados-cache`

## Como validar

1. Abrir dashboard Aquecedor e aguardar carga completa (primeira vez).
2. Recarregar a página (F5): métricas e lista devem aparecer **instantaneamente** com label "Cache local (HH:MM) — atualizando...".
3. Após alguns segundos, label muda para "Atualizado às HH:MM:SS".
4. DevTools → Network: segunda requisição `/dados` em ~15s; header `X-Waba-Dados-Cache: hit` em hits consecutivos no servidor.
5. `GET /health` → marker `DEPLOY-2026-06-25-aquecedor-dashboard-dados-cache`.

## Segurança

- Cache local keyed por e-mail da sessão (`wabaSessionEmail`); não expõe segredos.
- Backend cache é por processo (sem dados sensíveis além do que `/dados` já retorna).

## Palavras-chave

`dashboard`, `aquecedor`, `cache`, `/dados`, `localStorage`, `logs_envios_br`, `carregar`, `hydrateDashboardFromLocalCache`
