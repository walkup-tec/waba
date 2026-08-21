# Device Cloud — WA fecha no open e trava em Conversas

## Sintoma

Sistema tentava abrir WhatsApp → app fechava → persistia → quando finalmente abria Conversas, a rail ficava com «abriu o navegador» e **parava** (sem ir a Aparelhos conectados).

## Causa (confiança: Alta)

Em `ensureDeviceCloudWhatsAppForeground`, se `classifyDeviceCloudScreen` retornava `unknown` (app ainda carregando / crash dialog), o código dava **BACK** e relaunch. O BACK fechava o WhatsApp que acabava de subir. Depois abortava com mensagem de browser e o fluxo não continuava o menu ⋮.

## Correção

1. **Nunca** BACK em `unknown` — só espera, dismiss crash e relaunch.
2. BACK/HOME só se `browser` confirmado 2 vezes.
3. Settle maior após launch (2,2–2,8s) + poll de classificação.
4. Classificador mais estrito (verde WA → whatsapp; browser só sem verde + teclado claro).
5. Se ainda `unknown` após tentativas, **segue** para o menu ⋮ (não aborta).

## Marker

`DEPLOY-2026-08-20-device-cloud-wa-open-wait-no-back`

## Palavras-chave

ensureDeviceCloudWhatsAppForeground, BACK, crash, Conversas, travou, browser falso
