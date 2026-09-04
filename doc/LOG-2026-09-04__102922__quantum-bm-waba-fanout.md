# Quantum — fan-out BM→WABAs (3 números no mesmo Manager)

## Contexto

No Laboratório, o card **Quantum Smart Labs** (BM `3887084984861602`) mostrava badge **1** e só o chip **+55 27 92836-1199**, embora o WhatsApp Manager do mesmo portfólio tenha também:

- `+55 11 95213-1900`
- `+55 21 92368-3286`

WABA exibida na UI: `1056945243858578` (só o número ES).

## Sintoma

- UI: um único número no portfólio Quantum.
- Contador do card = `1`.

## Hipótese (confiança: Alta)

1. **Hydrate lia só o `wabaId` da conexão** → `GET /{wabaId}/phone_numbers` devolve só os chips daquela WABA.
2. No mesmo BM (WhatsApp Manager) existem **várias WABAs**; SP e RJ estão em outras contas.
3. Correção anterior (`unionPortfolioNumbers` no absorb + paginação) cobre **várias conexões Embedded Signup**, mas **não** o caso de **uma conexão** cujo BM tem várias WABAs.

Docs oficiais:

- [Owned WhatsApp Business Accounts](https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/)
- [Business `owned_whatsapp_business_accounts` / `client_whatsapp_business_accounts`](https://developers.facebook.com/docs/marketing-api/reference/business/)
- [WABA `phone_numbers`](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/phone_numbers/)

## Solução

1. `listBusinessWabaIds` — pagina `/{bmId}/owned_whatsapp_business_accounts` e `/{bmId}/client_whatsapp_business_accounts`.
2. Hydrate: une `wabaId` da conexão + WABAs do BM; pagina `phone_numbers` em cada uma; dedupe por `phoneNumberId`.
3. `unionPortfolioNumbers` — ao completar `verifiedName` do stored, **não** rebaixa `CONNECTED`/`ativo` para `pendente` (bug que quebrava o teste de PIN).
4. Testes: fan-out 3 números Quantum com 1 conexão; union Graph+stored; PIN.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`

## Validar

1. Redeploy EasyPanel do `waba_disparador`.
2. `GET /health` → `deployMarker` = `DEPLOY-2026-09-04-102500-quantum-bm-waba-fanout`.
3. Portfólios → Quantum Smart Labs: badge **3** e os três números.
4. Local: `npm run test:meta-portfolio` (51 pass).

## Segurança

Sem novos segredos; tokens Meta não entram na resposta pública.

## Palavras-chave

Quantum Smart Labs, fan-out, owned_whatsapp_business_accounts, client_whatsapp_business_accounts, 3887084984861602, 1056945243858578, 95213-1900, 92836-1199, 92368-3286, unionPortfolioNumbers
