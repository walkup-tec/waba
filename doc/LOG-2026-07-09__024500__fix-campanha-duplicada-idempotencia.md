# Fix — campanha duplicada ao Gerar Campanha (timeout + retry)

**Data:** 2026-07-09  
**Caso:** `obotmoney@gmail.com` — "Teste Bets Produção" (23:37) e "Teste Produção 02" (23:40), mesmos 50 envios Bets/Oficial.

## Causa raiz

1. **Frontend** `fetchDisCampaignWizardIntakeWithRetry` reenviava o POST até **3 vezes** em erro 5xx, timeout ou rede.
2. **Backend** criava nova campanha a cada POST sem chave idempotente.
3. Se a 1ª requisição **gravava** a campanha mas a resposta falhava (timeout ~3 min, notify lento, gateway), o retry gerava **duplicata** e consumia créditos de novo.

## Correção

### Backend (`campaignIntakeApiVersion` 3)
- Campo `clientRequestId` no intake.
- `findByOwnerAndClientRequestId` — replay retorna **200** com `deduplicated: true` (sem nova campanha/crédito).
- Notify operacional em `try/catch` — falha de e-mail/WhatsApp **não** derruba o POST após gravar.

### Frontend
- UUID `clientRequestId` por clique em Gerar Campanha.
- Retry reduzido para **2** tentativas (mesma chave = seguro).
- Mensagem de timeout orienta verificar lista antes de reenviar.

## Marker

`DEPLOY-2026-07-09-fix-campanha-duplicada-idempotencia`

## Validar

1. Redeploy `waba_disparador` + `/health` marker e `campaignIntakeApiVersion: 3`.
2. Gerar campanha; simular lentidão — segunda tentativa com mesma sessão não duplica.
3. Duplicatas já existentes em produção: cancelar manualmente no operacional se necessário.

## Palavras-chave

`campanha duplicada`, `clientRequestId`, `idempotencia`, `Gerar Campanha`, `fetchDisCampaignWizardIntakeWithRetry`
