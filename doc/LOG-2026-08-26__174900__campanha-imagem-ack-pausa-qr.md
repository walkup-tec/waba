# LOG — Campanha: imagem única, ACK, proxy no QR, pausa humana pós-reconexão

## Contexto do pedido

Corrigir na Alternativa: mensagem sem imagem, mensagem com duas imagens, instância caindo no disparo, e pausa humana ao reconectar (ex.: 5181077770 / `drax`). Incluir a regra Proxy Brasil ainda não publicada. Push para `origin/master`.

## Ações

- `sendMedia` e `sendButtons` sem retry HTTP; timeout de base64 não faz fallback URL (segunda imagem).
- Lead guarda `mediaMessageId`; tick seguinte não reenvia imagem; botão só após `DELIVERY_ACK`.
- Alternativa sem 4 imagens 1080×1080 no snapshot não envia texto.
- QR de chip em campanha `running`/`paused` não desliga Proxy Brasil.
- `disableProxy` no meio do disparo só se `connectionState` for desconectado confirmado.
- `noteAquecedorInstanceReconnected` no QR; 20 min sem pausa humana (mesmo com `force`).

## Arquivos

- `src/index.ts`
- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/proxy/proxy-brasil-campaign.rules.selfcheck.ts`
- `src/proxy/evo-instance-proxy.service.ts`
- `src/deploy-marker.ts`
- `dist/` correspondente
- `doc/memoria.md`

## Como validar

1. `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → `proxy-brasil-campaign.rules ok`
2. Após Redeploy EasyPanel: `GET /health` com marker `DEPLOY-2026-08-26-campanha-imagem-ack-pausa-qr`
3. Campanha: uma imagem por lead; se `sendButtons` falhar, o próximo tick não manda outra imagem
4. QR de chip na campanha: Proxy permanece; reconexão não entra em pausa humana nos 20 min seguintes
5. Chips `open` com `/proxy/find` null: Ativar aplica proxy; tick sozinho não liga no meio do disparo

## Observações de segurança

Sem `sendText` de probe. Sem `proxy/set` extra em chips ao vivo fora dos fluxos Ativar/criação/troca.

## Palavras-chave

campanha, sendMedia, duas imagens, DELIVERY_ACK, mediaMessageId, Proxy Brasil, pausa humana, QR, lastReconnectAt
