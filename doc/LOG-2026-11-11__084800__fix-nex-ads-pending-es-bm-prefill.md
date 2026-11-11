# LOG — Nex Ads: número Pendente não aparece / + sem WABA

## Contexto
BM **Nex Ads** (`2515673625607910`) tem `+55 51 92636-4461` **Pendente** no Meta Business Suite, mas no Laboratório Drax o card fica com **WABA —** e **0 números**, impedindo ativar o PIN.

## Causa
1. A Graph do app Drax não devolve WABA/phones para esse BM (token sem asset / conta ainda Pendente) — o recovery `portfolio-focus-recover` já estava em produção e ainda assim o card vinha vazio.
2. O botão **+** só pré-preenchia o Embedded Signup quando **já existia WABA** (`businessId && wabaId`). Sem WABA, o ES abria genérico e não mirava o portfólio Nex Ads.
3. Tentativa anti-Flaviane com `break`/scrub em `fillEmptyAdmin` quando owned/client vinham vazios quebrava Casa Buzina e WABA client de agência — removida; Flaviane fica no hydrate (dropa WABA com owner de outro BM).

## Solução
1. `buildMetaEsSetupPrefill` + `wabaAddMetaWhatsappNumber` / `wabaMetaEsBuildLoginOptions`: prefill com **BM sozinho** quando não há WABA.
2. `focus-recover`: inclui `collectInvitedBusinessWabaRefs`.
3. Hydrate: descarta WABA com `owner` de outro BM; mantém a WABA da conexão se a Graph não trouxer owner.

## Arquivos
- `src/integrations/meta-whatsapp/meta-es-fb-login.ts`
- `src/integrations/meta-whatsapp/meta-es-fb-login.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `index.html`
- `src/deploy-marker.ts`

## Como validar
1. Deploy `waba_disparador` com marker `DEPLOY-2026-11-11-nex-ads-es-bm-prefill`.
2. Laboratório → Portfólios → Nex Ads → **+** → ES deve abrir no BM `…7910`.
3. Após vincular, **Atualizar** → número `4461` com status pendente e campo PIN.
4. `node --require ts-node/register --test src/integrations/meta-whatsapp/meta-es-fb-login.test.ts`
5. `npm run test:meta-portfolio`

## Segurança
Sem novos segredos; prefill só com IDs públicos de BM/WABA.

## Palavras-chave
Nex Ads, 7910, 92636-4461, Pendente, Embedded Signup, setup.business, portfolio-focus-recover, Flaviane stale WABA
