# Fix: instância walkup entrando no disparador com Disparador OFF

## Contexto

Campanha «Motor Próprio de Envio» exibia `walkup` como instância ativa (pill verde), mas na aba Instâncias `walkup` estava com:
- Aquecedor: ON
- Disparador: OFF
- Fazenda: OFF

O auto-replenish e `resolveAutoInstancesForCampaign` incluíam instâncias conectadas no aquecedor **sem** checar `use_disparador`.

## Causa raiz

1. `resolveAutoInstancesForCampaign` — ramo `aquecedorConnected` só exigia `useAquecedor !== false`.
2. `filterDisparadorInstancesReadyForAuth` — não filtrava por `useDisparador`.
3. `filterFazendaClaimableForAuth` / `resolveWarmFazendaReplacementsForAuth` — não validavam `useFazenda` + `useDisparador`.
4. Campanhas já salvas com instância inelegível não eram sanitizadas no tick.

## Solução

Em `src/index.ts`:

- Helpers `isInstanceEligibleForDisparador` e `isInstanceEligibleForFazendaPool`.
- `filterDisparadorInstancesReadyForAuth` — exclui `useDisparador === false`.
- `filterFazendaClaimableForAuth` — exige `useFazenda === true` e `useDisparador !== false`.
- `resolveWarmFazendaReplacementsForAuth` — aplica filtros antes de ordenar por warmth.
- `resolveAutoInstancesForCampaign` — `aquecedorConnected` exige elegibilidade no disparador.
- `tryAutoReplenishCampaignInstances` — remove instâncias inelegíveis de `selectedDisparadorInstances` e persiste.
- `sanitizeCampaignSelectedDisparadorInstances` — roda a cada tick em campanhas `running` e `paused`.

## Arquivos alterados

- `D:\Waba-master\src\index.ts` (dev ativo)
- `E:\Waba\src\index.ts` (espelho)

## Validação

```powershell
cd D:\Waba-master
npm run build
powershell -File scripts\dev-v02.ps1
```

- Após restart, `data/v02/disparos-local-state.json` da campanha Mozart não lista mais `walkup` em `selectedDisparadorInstances`.
- Novos auto-adds não incluem instâncias com Disparador OFF.

## Palavras-chave

`useDisparador`, `use_disparador`, `isInstanceEligibleForDisparador`, `sanitizeCampaignSelectedDisparadorInstances`, `resolveAutoInstancesForCampaign`, `walkup`
