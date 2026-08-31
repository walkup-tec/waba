# Tick da campanha derrubava pareamento com proxy/set

## Contexto do pedido

Operador conectou várias instâncias de manhã; 3 desconectaram sozinhas. Sintoma: “instâncias perdem conexão por nada”.

## Comandos / ações

Investigação no código de produção (`master`): tick da campanha, reconcile Proxy Brasil, prepare após «+ Instâncias» / auto-swap. Sem `sendText` de probe.

## Solução implementada

1. **Causa:** O tick (campanha `running` e `paused`) chamava `reconcileProxyBrasilForLiveCampaign(..., true)` a cada ciclo. Com a sessão `open` e `/proxy/find` ≠ true (comum após QR do Aquecedor, sem «Proxy Campanha», e após Redeploy com cache vazio), o WABA fazia `POST /proxy/set`. Evolution trata isso como conflict → `device_removed`. O mesmo prepare rodava ao incluir número na campanha. Desligar proxy em todos os offline da seleção repetia o incidente de 12/08.
2. **Regra já documentada e não cumprida no tick:** não fazer `proxy/set` nem restart em número de campanha viva. Ligar Proxy só no QR «Proxy Campanha».
3. **Código:**
   - `shouldSkipProxySetBecauseSessionOpen`: prepare não aplica `proxy/set` se já está `open`.
   - Tick: `allowEnable: false` e `allowDisableHeld: false`.
   - Disable de proxy só em nomes que **saíram** da seleção, nunca nos que ficaram, e nunca em sessão `open`.

## Arquivos criados/alterados

- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/proxy/evo-instance-proxy.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-28-083300-keep-pairing-chip-live`
- `.cursor/project-memory/02-BUSINESS_RULES.md`, `05-DECISIONS.md`, `06-CURRENT_STATUS.md`

## Como validar

1. `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → `proxy-brasil-campaign.rules ok`
2. Após Redeploy EasyPanel `waba_disparador`: `GET /health` com marker `DEPLOY-2026-08-28-080000-keep-pairing-no-proxy-set`
3. Funcional: reconectar números no Aquecedor (sem Proxy Campanha) com campanha pausada/em execução — a sessão deve **permanecer** `open`. Sem `sendText` de teste.

## Observações de segurança

Sem log de chaves. Sem probe WhatsApp.

## Palavras-chave

proxy/set, device_removed, pareamento, tick campanha, Proxy Campanha, reconnect, WB desconectada
