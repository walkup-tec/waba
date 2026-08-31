# Campanha Alternativa: perda de pareamento no disparo

## Contexto do pedido

Durante disparo API Alternativa as instâncias perdiam o pareamento com a Evolution. Conexão instável.

## Sintoma / hipótese

- Sintoma: sessão WhatsApp cai (precisa QR de novo) enquanto a campanha envia.
- Hipótese (confiança alta): no meio do envio o WABA chamava `prepareProxyBrasilSessionForCampaignSend` (`proxy/set` e, em falha, disable + restart). A flag `ready` da Proxy vive só em memória — some no Redeploy. O 1º lead após o deploy reaplicava proxy com a sessão aberta → `device_removed` / conflict.

## Evidências

- `isProxyBrasilSessionReadyForSend` lê Map em memória (`prepareStatusByInstance`).
- `processOneCampaignDispatch` chamava prepare completo se `ready` fosse falso.
- Prepare pode `POST /proxy/set` e `failAndRollback` (disable + `instance/restart`).
- Comentário no próprio disparo: restart no meio gera conflict/device_removed.
- `markProxyBrasilSessionReadyForSend` existia e não era usada no disparo.
- Timeline: Redeploy do botão + campanha rodando.

## Solução

No disparo: se a instância está `open`, só marca `ready`. Sem `proxy/set`, sem restart, sem desligar proxy na pausa por “saiu de open”.

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`
- Marker `DEPLOY-2026-08-20-alternativa-no-proxy-mid-send`

## Como validar

Pausar campanha, parear de novo os números que caíram, Redeploy, `/health` com o marker, reativar. A sessão não deve pedir QR só porque a campanha está enviando.

## Palavras-chave

pareamento, proxy/set, device_removed, mid-send, API Alternativa, Redeploy
