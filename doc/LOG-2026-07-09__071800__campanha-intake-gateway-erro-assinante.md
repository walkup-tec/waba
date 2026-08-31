# Fix — campanha criada no operacional mas assinante vê erro de gateway

**Data:** 2026-07-09  
**Caso:** `obotmoney@gmail.com` — erro "Servidor temporariamente indisponível" (502/503/504); campanha aparece no painel do operacional (`op_jose`) mas assinante não vê sucesso.

## Causa

O POST `/disparos/campanhas/intake` **aguardava** `notifyOperacionalStaffOnCampaignAssigned` (e-mail + WhatsApp com várias tentativas) **antes** de responder HTTP.

O Traefik/gateway encerrava a conexão (502/503/504) enquanto o Node ainda processava o notify. Resultado:

- Campanha **gravada** e operacional **notificado**
- Cliente recebia erro e não mostrava tela de sucesso
- Lista do assinante não atualizava

## Correção

### Backend
- `finalizeIntakeAfterCreate` agora só faz atribuição ao operacional (síncrono).
- Notify e-mail/WhatsApp em **background** (`runOperacionalNotifyInBackground`).
- POST retorna **201** em poucos segundos.

### Frontend
- Em 502/503/504, timeout ou falha de rede: tenta **recuperação** reenviando o mesmo `clientRequestId` (dedupe → 200).
- Se confirmar campanha existente, mostra sucesso e atualiza lista.
- Mensagem de erro orienta verificar **Minhas campanhas**.

## Marker

`DEPLOY-2026-07-09-campanha-intake-resposta-rapida-notify-async`

## Validar

1. Redeploy `waba_disparador`.
2. Gerar campanha como `obotmoney@gmail.com` → tela de sucesso em < 30s.
3. Operacional continua recebendo aviso (pode levar mais tempo em background).
4. Simular gateway lento: recovery confirma campanha sem duplicar.

## Palavras-chave

`502`, `gateway timeout`, `notify async`, `recoverDisCampaignWizardIntakeAfterFailure`, `obotmoney`
