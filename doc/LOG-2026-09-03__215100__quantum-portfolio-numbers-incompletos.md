# Quantum Smart Labs — lista incompleta de números do portfólio

## Contexto do pedido

No Laboratório, o card **Quantum Smart Labs** (BM `3887084984861602`, WABA `1053856057421351`) mostrava badge **1** e só o chip **Relacionamento Deputada Jandira** (`+55 11 95213-1900`), embora a conta tenha mais números integrados (botão **+** / novas conexões Embedded Signup).

## Sintoma observado

- UI: um único número no portfólio Quantum.
- Contador do card = `1`.

## Hipótese principal (confiança: Alta)

1. **Absorb no dedupe usava `mergePortfolioNumbers`**: se o card hospedeiro já tinha qualquer número listável, a segunda conexão do mesmo BM era descartada (host “ganha” inteiro). Cenário típico: adicionar número via **+** no mesmo Business Manager → duas conexões → um card → só os chips da primeira sobrevivem.
2. **`GET {wabaId}/phone_numbers` sem paginação**: a Graph pagina com `paging.cursors.after`; sem seguir o cursor, só a 1ª página entrava.

Doc oficial: [WABA phone_numbers](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/phone_numbers/) e [Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/).

## Solução implementada

1. `unionPortfolioNumbers` — une por `phoneNumberId` sem descartar a 2ª lista.
2. `dedupePortfolioCards` passa a usar `unionPortfolioNumbers` no absorb.
3. `listWabaPhoneNumbersPaged` — até 20 páginas, `limit=100`, cursor `after`.
4. Testes: union, dedupe Quantum, duas WABAs no mesmo BM, paginação Graph.
5. Marker `DEPLOY-2026-09-03-215100-quantum-portfolio-numbers`.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`

## Como validar

1. Redeploy EasyPanel do `waba_disparador`.
2. `GET /health` → `deployMarker` = `DEPLOY-2026-09-03-215100-quantum-portfolio-numbers`.
3. Abrir Portfólios → Quantum Smart Labs: badge e lista devem refletir todos os chips da Meta (não só 1).
4. Local: `npm run test:meta-portfolio` (49 pass).

## Segurança

Sem novos segredos; tokens Meta não entram na resposta pública.

## Palavras-chave

Quantum Smart Labs, portfolio numbers, unionPortfolioNumbers, phone_numbers pagination, Embedded Signup, absorb dedupe, 3887084984861602, 1053856057421351
