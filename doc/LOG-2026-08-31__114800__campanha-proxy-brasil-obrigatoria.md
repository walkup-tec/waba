# LOG — Campanha: Proxy Brasil obrigatória nas instâncias ativas

## Contexto do pedido

Campanha Alternativa em execução disparava sem Proxy Brasil nas instâncias `open`. A regra permanente já exigia Proxy ligada em toda instância ativa.

## Comandos / ações

Investigação em produção: `/proxy/find` `null` em `1261`, `walkup-5401` e `wb-walkup` enquanto enviavam. Causa no código: exceção `open-cannot-set-proxy` e prepare que marcava `ok: true` com sessão `open` sem proxy.

## Solução implementada

1. `instanceMaySendWithProxyBrasil` volta a bloquear envio se `/proxy/find` não for `enabled: true`. Sem atalho para sessão já `open`.
2. Prepare de número `open` sem proxy devolve **falha** (`needsProxyPairing`) e **não** chama `proxy/set` (preserva pareamento).
3. Tick: pick não escolhe chip sem Proxy; se nenhum estiver pronto, pausa pedindo QR **Proxy Campanha**. Retoma sozinha quando algum chip `open` tiver Proxy.
4. Ativar campanha: 409 se nenhuma selecionada estiver `open` com Proxy.
5. UI: chip `open` sem Proxy fica âmbar (não verde). «Proteção ativa» só com Proxy confirmada em todas as conectadas.

## Arquivos criados/alterados

- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/proxy/evo-instance-proxy.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-31-114800-campanha-proxy-obrigatoria`
- `dist/` correspondente
- `.cursor/project-memory/02-BUSINESS_RULES.md`, `05-DECISIONS.md`, `06-CURRENT_STATUS.md`, `08-DEPLOY.md`, `INDEX.md`
- `doc/memoria.md`

## Como validar

1. `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → `proxy-brasil-campaign.rules ok`
2. Após Redeploy EasyPanel `waba_disparador`: `GET /health` com marker `DEPLOY-2026-08-31-114800-campanha-proxy-obrigatoria`
3. Funcional: campanha com chips `open` sem Proxy **não** envia; pausa até reconectar no Aquecedor com Proxy Campanha. Sem `proxy/set` em sessão pareada. Sem `sendText` de teste.

## Observações de segurança

Sem log de senha/host da Proxy. Sem probe WhatsApp neste passo.

## Palavras-chave

Proxy Brasil, proxy/find, campanha Alternativa, Proxy Campanha, open-cannot-set-proxy, pareamento
