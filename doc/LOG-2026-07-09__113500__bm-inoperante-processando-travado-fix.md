# LOG — BM inoperante travado em Processando (op_gabriel)

**Data:** 2026-07-09

## Sintoma

Operador `op_gabriel@...` clicou **BM inoperante** → botão ficou em **Processando**, modal não fechou.

## Causa raiz

`reassignCampaign` aguardava **síncrono** `notifyOperacionalStaffOnCampaignAssigned` (e-mail + WhatsApp com retry em várias instâncias/masters). A requisição HTTP podia exceder o timeout do frontend antes de retornar `200`.

## Correção

### Backend
- `scheduleOperacionalStaffNotifyOnCampaignAssigned` — notificação em background (`setImmediate`).
- `reassignCampaign` responde logo após `assignToSupplier`.
- `markBmInoperante` em reatribuição não carrega `getCampaignDetail` do novo operador (desnecessário para quem clicou).

### Frontend
- Mutex `adminCampanhasBmInoperanteBusy`.
- `finally` libera mutex.
- Timeout: 45s, 2 retries.
- Em timeout: mensagem + fecha modal e atualiza lista.

## Deploy marker

`DEPLOY-2026-07-09-bm-inoperante-resposta-rapida`

## Palavras-chave

`BM inoperante`, `Processando travado`, `op_gabriel`, `notify background`, `reassignCampaign`
