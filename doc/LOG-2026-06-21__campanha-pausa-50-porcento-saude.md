# LOG — Regra 50% instâncias ativas (pausa por saúde)

## Contexto

Regra pré-existente que precisava continuar valendo: quando números disparadores vão sendo bloqueados e menos de **50%** das instâncias selecionadas permanecem ativas, a campanha deve pausar com status **«Pausada · Pausa manual ou automática por regra de saúde.»**

Convive com a regra de mínimo 4 números conectados (mensagem + «+ Instâncias»).

## O que já existia no backend

- `shouldPauseByDisconnectedRatio`: `disconnectedCount / selectedCount >= 0.5`
- Pausa automática no tick (`runCampaignDispatchTick`)
- Bloqueio de ativação em `POST /disparos/campanhas/:id/estado` (409)

## Ajustes desta sessão

### `src/index.ts`

- `buildCampaignRuntimeStage` recebe `instanceHealth` e distingue pausa manual vs. pausa por saúde.

### `index.html`

- Restaurado `shouldPauseByDisconnectedRatio` na UI de campanhas EVO.
- Alerta: «Menos de 50% das instâncias selecionadas estão ativas (X de Y).»
- «Ativar campanha» desabilitado quando **50%** ou **mínimo 4** violados.
- «+ Instâncias» permanece **somente** para `needsMoreInstancesForMinimum`.

## Validação

```powershell
cd D:\Waba-master
npm run build
```

Cenários:
- 6 instâncias, 2 ativas → pausa + alerta 50% + bloqueio ativar.
- 8 instâncias, 4 ativas (50% desconectadas) → pausa 50% sem alerta de mínimo 4.
- 4 instâncias, 1 ativa → ambos alertas (50% e mínimo 4) + «+ Instâncias».

## Palavras-chave

`shouldPauseByDisconnectedRatio`, `50-porcento-desconectadas`, `regra de saúde`, `campaignBlockedByHealth`
