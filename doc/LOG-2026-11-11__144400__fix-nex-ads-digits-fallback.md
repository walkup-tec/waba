# LOG — Nex Ads: chip Pendente 4461 via dígitos + stamp BM no exchange

## Contexto

Portfólio **Nex Ads** `2515673625607910` tem `+55 51 92636-4461` com Status **Pendente** no Meta Business Suite, mas o Laboratório Drax não listava o número para enviar código de ativação (PIN). Deploys anteriores (focus-recover, ES BM-only, claim businessId) não bastaram.

## Causa raiz

1. Edges `owned`/`client` do BM …7910 costumam vir **vazias** para o token do app Drax.
2. O chip só aparece como WABA **client órfã** da agência (`owner_business_info` nulo). Indexar só por `verified_name` falha se a Meta devolver nome genérico/vazio.
3. O `/callback` (exchange) não gravava o `businessId` do card no `pending_token`, então o claim/descoberta não ficava colado no BM Nex Ads.
4. Produção ainda estava em `DEPLOY-2026-11-11-nex-ads-claim-business-id` — as correções locais não estavam no ar.

## Solução

1. **Exchange** grava `businessId` do card no `pending_token` (route + `index.html` + service).
2. Agency/debug scan indexa chips por **`verified_name`** e por **dígitos de exibição**.
3. Registry `KNOWN_PENDING_DISPLAY_PHONES` para Nex Ads (`5551926364461` / `51926364461`) — sem inventar `phone_number_id`/`waba_id`.
4. Fan-out / focus-recover usam `partnerBucketForCardNameOrDigits`.
5. Mensagem vazia no «+» orienta **Atribuir parceiro** quando a Graph ainda não compartilhou o chip.
6. Marker: `DEPLOY-2026-11-11-nex-ads-digits-fallback`.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-known-owned-wabas.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `index.html`
- `src/deploy-marker.ts`
- testes phase3 / portfolio / es-login / known-owned

## Validação

- `test:meta-phase3` — 18 pass
- `meta-es-fb-login` — 11 pass
- `test:meta-portfolio` — 154 pass
- `known-owned-wabas` — 11 pass

## Residual (Case A puro)

Se o número **não** estiver em nenhuma WABA client/debug da agência, a Graph não devolve o chip — é preciso **Atribuir parceiro** (Drax/Walkup) no Business Manager e depois Atualizar no Laboratório.

## Palavras-chave

Nex Ads, 7910, 4461, 92636-4461, digits-fallback, KNOWN_PENDING_DISPLAY_PHONES, exchange businessId, Pendente, PIN, Atribuir parceiro
