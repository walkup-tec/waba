# LOG — Iniciar campanha travado em Salvando

**Data:** 2026-07-09

## Sintoma

Botão **Confirmar início** ficava em **Salvando…** por muito tempo; modal só fechava depois.

## Causas

1. Frontend aguardava `loadAdminCampanhas()` (GET lista completa) antes do `finally` liberar o botão.
2. `listCampaigns` chamava `ensureInitialAssignment` em **todas** as campanhas a cada listagem.
3. Resposta POST `/iniciar` retornava `OperacionalCampaignDetail` completo (desnecessário).

## Correção

### Backend
- `markCampaignStarted` → retorna só `OperacionalCampaignListItem` (`toListItem`).
- POST `/iniciar` → JSON leve `{ ok, campaignId, status, displayStatus }`.
- `listCampaigns` → `ensureInitialAssignment` só se sem operacional atribuído.

### Frontend
- Label **Iniciando…** (não Salvando).
- Mutex `adminCampanhasStartBusy`.
- Fecha modal em ~400ms após sucesso; refresh da lista em background.
- Patch otimista no cache local.

## Deploy marker

`DEPLOY-2026-07-09-iniciar-campanha-resposta-rapida`

## Palavras-chave

`Confirmar início`, `Salvando travado`, `markAdminCampanhaStarted`, `iniciar campanha`
