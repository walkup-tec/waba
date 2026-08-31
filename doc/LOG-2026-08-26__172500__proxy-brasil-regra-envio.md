# LOG — Proxy Brasil: regra de envio e desligamento

## Contexto do pedido

Campanha Alternativa não pode enviar sem Proxy Brasil ligada. Proxy não pode ficar ligada em instância desconectada ou fora da seleção da campanha.

## Ações

- Camada pura `src/proxy/proxy-brasil-campaign.rules.ts` (sem HTTP).
- Orquestração em `src/proxy/evo-instance-proxy.service.ts` (`reconcileProxyBrasilForCampaignInstances`).
- Gate de envio em `pickDisparadorInstanceForConfig` e no tick (`/proxy/find` tem que ser `enabled: true`).
- Ativar: `prepare` + só segue se alguma selecionada estiver `open` com proxy ligada.
- Tick: só desliga (desconectada / saiu da seleção). Não liga proxy no meio do disparo.
- Ligar: Gerar campanha, troca (quem entra), Ativar.

## Solução

1. **Pode enviar** só se selecionada + `connectionState=open` + `GET /proxy/find` enabled ([Evolution Get Proxy](https://docs.evolutionfoundation.com.br/evolution-api/get-proxy)).
2. **Ligar** (`POST /proxy/set` enabled true) na criação, na entrada da troca e no Ativar.
3. **Desligar** se desconectada confirmada ou se não está em nenhuma campanha `running`/`paused`.
4. Estado `unknown`/`connecting` não desliga (evita falso offline).
5. Instâncias só no Aquecedor (QR Proxy Campanha, ainda sem campanha) não entram no varrer global.

## Arquivos

- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/proxy/proxy-brasil-campaign.rules.selfcheck.ts`
- `src/proxy/evo-instance-proxy.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/` correspondente
- `doc/memoria.md`

## Como validar

1. `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → `proxy-brasil-campaign.rules ok`
2. Após Redeploy: `GET /health` com marker `DEPLOY-2026-08-26-proxy-brasil-regra-envio`
3. Ativar campanha: se as instâncias estiverem `open` sem proxy, o Ativar aplica Proxy; se nenhuma ficar pronta, 409
4. Envio: `proxy/find` null/false → não envia
5. Chip desconectado na campanha: Proxy desliga só nesse nome
6. Campanha finished/excluída: Proxy desliga se outra campanha viva não a segura

## Segurança

Sem log de senha/host da Proxy. Sem `sendText` de teste.

## Palavras-chave

Proxy Brasil, proxy/find, proxy/set, campanha Alternativa, gate de envio, desconectada, seleção, reconcile
