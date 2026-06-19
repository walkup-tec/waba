# LOG — Disparos dashboard: autocomplete de assinante (master)

**Data:** 2026-06-08

## Solicitação
Na busca do comparativo (master), localizar por trecho do **nome** ou **e-mail** do assinante e exibir resultados **logo abaixo** do campo para seleção.

## Alterações

### Backend
- `src/disparos/waba-disparos-dashboard.service.ts`
  - `compareSubscribers: { email, fullName }[]` no overview master
  - `buildCompareSubscribersFromIntakes()` — assinantes com campanhas comparáveis
  - `buildMasterSubscribersDisparosDashboardOverview` passa perfis `{ email, fullName }`
- `src/disparos/waba-campaign-intake.routes.ts` — envia `fullName` dos assinantes

### Frontend (`index.html`)
- Campo com dropdown `#disparos-dashboard-compare-subscriber-suggestions`
- Busca por nome/e-mail; gráfico filtra só após **clicar** no resultado
- Variável `disparosDashboardCompareSelectedSubscriberEmail`
- CSS do dropdown abaixo do input

## Validação
- `npm run build` OK (tsc + copy index.html)

## Pendências
- Testar no browser como master com `npm run dev:v02`
- Deploy Easypanel se solicitado
