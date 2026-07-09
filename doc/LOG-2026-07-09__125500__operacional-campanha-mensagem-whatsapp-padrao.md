# LOG — Mensagem WhatsApp/e-mail nova campanha (operador + masters)

## Pedido

1. Masters — nova campanha: resumo com linha **Operador** (sem segmento/SLA do operador).
2. Masters — BM inoperante: mensagem `# BM INOPERANTE ATRIBUÍDA` com data da atualização.

## Implementação

- `buildMasterNewCampaignWhatsAppText` — template masters nova campanha
- `buildMasterBmInoperanteCampaignWhatsAppText` — template BM inoperante
- `scheduleMastersBmInoperanteNotify` — dispara ao registrar BM (fila esgotada)
- Operador mantém template completo anterior

## Deploy marker

`DEPLOY-2026-07-09-operacional-mensagem-masters-bm`

## Validar

Nova campanha API Oficial/Alternativa → WhatsApp operacional + masters com resumo completo e URL `?operacionalCampanha=`.

Palavras-chave: `operacional campanha`, `buildOperacionalNewCampaignWhatsAppText`, `segmentLabel`, `notifyOperacionalStaff`
