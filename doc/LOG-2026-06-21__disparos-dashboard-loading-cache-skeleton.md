# Disparos Dashboard — carregamento sem tela vazia

## Contexto

Dashboard de Disparos exibia duas linhas idênticas "Carregando relatório consolidado…" e área escura sem estrutura visual enquanto aguardava `/disparos/dashboard/overview`.

## Solução

1. **Skeleton estruturado** — layout real (métricas, pizza, taxas) com shimmer; uma única linha no resumo: "Atualizando indicadores do dashboard…".
2. **Cache local (30 min)** — `localStorage` por e-mail; hidratação no login e ao abrir a aba; revalidação em background.
3. **Prefetch no login** — busca overview + créditos assim que a sessão restaura.
4. **Aba com cache** — `loadDisparosDashboard({ silent: true })` mantém dados visíveis e atualiza sem piscar skeleton.

## Arquivos alterados

- `index.html` — CSS skeleton, cache, prefetch, `loadDisparosDashboard`, `renderDisparosDashboard`, HTML inicial do report

## Como validar

1. Login → abrir Disparos · Dashboard: deve mostrar skeleton ou cache imediato (nunca duas linhas "Carregando…").
2. Segunda visita (< 30 min): dados aparecem na hora; resumo pode mostrar "· atualizando…" brevemente.
3. Hard refresh sem cache: skeleton com cards animados até a API responder.

## Palavras-chave

disparos-dashboard, skeleton, cache local, loading UX, overview prefetch
