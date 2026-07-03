# LOG — Boas-vindas WhatsApp: fallback por número

**Data:** 2026-07-03

## Pedido

Se a instância **51981077770** estiver desconectada, disparar boas-vindas pela instância **5197462102**.

## Solução

1. **`resolveConnectedEvoInstanceByPhoneHint`** em `waba-push-community.service.ts` — localiza instância **conectada** pelo número/nome.
2. **`buildWelcomeSendCandidates`** em boas-vindas:
   - Tenta `51981077770` (env: `WABA_WELCOME_WHATSAPP_PRIMARY_PHONE`)
   - Se offline/ausente → `5197462102` (env: `WABA_WELCOME_WHATSAPP_FALLBACK_PHONE`)
   - Senão → resolução legada (nome/config push)

## Validar

Marker `DEPLOY-2026-07-03-boas-vindas-whatsapp-phone-fallback`. Reenviar boas-vindas no admin para assinante de teste.

## Palavras-chave

`51981077770`, `5197462102`, `resolveConnectedEvoInstanceByPhoneHint`, boas-vindas WhatsApp
