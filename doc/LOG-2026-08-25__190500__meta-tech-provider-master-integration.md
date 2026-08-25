# Integração Meta Tech Provider sobre origin/master atual

## Contexto do pedido

O commit Meta `1e29b80989044f1b7dab6c11bf0348653bcc76d3` (`feat(meta): prepare Tech Provider Cloud API integration`) foi validado na branch `feat/meta-tech-provider` sobre a base antiga `bd7307f`. `origin/master` está centenas de commits à frente. Esta etapa integrou o pacote sobre o master atual em worktree isolada, sem push e sem deploy.

## Ações executadas

- `git fetch origin` (working tree principal não foi alterada)
- Worktree: `.tmp-meta-master-integration`
- Branch: `feat/meta-tech-provider-master` a partir de `origin/master` (`8f05836`)
- `git cherry-pick 1e29b80989044f1b7dab6c11bf0348653bcc76d3`
- Resolução semântica dos conflitos (nunca `--ours`/`--theirs` em `src/` ou `index.html`)
- `npm run build` na worktree (PASS)
- Suites Meta + verifies estáticos de regressão

## Solução implementada

Regra: **master atual + wiring Meta**, sem substituir arquivos atuais pelas versões antigas do pacote.

### Conflitos resolvidos

| Arquivo | Conflito | Versão master | Versão Meta | Decisão | Por que é segura |
|---|---|---|---|---|---|
| `src/index.ts` (imports) | imports autenticacao vs imports Meta | `resolveWabaRequestAuth` + `type WabaRequestAuth` | imports Meta + `resolveWabaRequestAuth` sem o type | Ambos: imports Meta + type `WabaRequestAuth` do master | `campaignOwnerAuth` e outros usos no master exigem o type; o wiring Meta precisa dos imports |
| `src/index.ts` (rotas públicas) | `/bets` vs páginas legais | `app.get("/bets")` | `sendPublicLegalPage` + `/termos` + `/exclusao*` | Ambos, nesta ordem | Landing Bet do master permanece; páginas legais Meta ficam públicas |
| `src/auth/waba-auth.routes.ts` | bypass GET público | `/bets` | `/termos`, `/exclusao-de-dados`, `/exclusao` | Ambos | Webhook e `GET /integrations/meta/whatsapp/config` já tinham vindo no auto-merge; não se abre rota autenticada |
| `index.html` `getMenuSectionForTab` | seção do tab | `isMarketingTab` → marketing | tabs WhatsApp → `lab-api-oficial` | Ambos | Leads PJ (marketing) e Laboratório Meta coexistem |
| `index.html` `resolveMenuGroupForTab` | grupo da sidebar | marketing | `lab-api-oficial` | Ambos | Idem |
| `index.html` `focusDesktopMenuGroupForActiveTab` | lista de grupos | inclui `marketing`, sem lab | inclui `lab-api-oficial`, sem marketing | União das duas listas | Sem isso um dos grupos ficaria aberto/fechado errado |
| `dist/index.js`, `dist/index.html`, `dist/auth/waba-auth.routes.js` | artefatos gerados | dist atual do master | dist antigo do pacote Meta | Não mesclar à mão; regenerar com `npm run build` após `src/` | Dist final nasce da árvore integrada |

### Auto-merge (sem marcador)

- `package.json`: scripts `test:meta-*` adicionados; dependências do master intactas
- `src/menus/waba-menu-registry.ts` / permissions: seção `lab-api-oficial` + `WABA_TECH_PROVIDER_MENU_IDS`
- Complemento: entrada `whatsapp-templates` no registry (já estava no HTML e no array de IDs; sem ela o menu Templates não entra em permissões)

### Dist commitado

Apenas artefatos Meta + wiring: `dist/index.js`, `dist/index.html`, `dist/auth/waba-auth.routes.js`, `dist/auth/waba-meta-oficial-token-access.js`, `dist/menus/*`, `dist/integrations/meta-whatsapp/*`, `dist/integrations/whatsapp/*`. Rebuild de admin/billing/aquecedor/campanhas/leads **não** entra no commit.

## Arquivos criados/alterados

Pacote Meta (`src/integrations/meta-whatsapp/*`, testes, SQL, docs ENV/LOG), páginas `public-pages/termos.html` e `exclusao-de-dados.html`, wiring em `src/index.ts`, bypass em `src/auth/waba-auth.routes.ts`, menus, `package.json` scripts, UI Laboratório em `index.html`.

## Como validar

```text
# na worktree .tmp-meta-master-integration
npm run build
npm run test:meta-lab-tokens
npm run test:meta-phase2
npm run test:meta-phase3
npm run test:meta-phase5
npm run test:meta-phase6
npm run test:meta-phase7
npm run test:meta-phase8
npm run test:meta-phase9
```

Esperado: build exit 0; 121 PASS / 0 FAIL.

## Observações de segurança

- Sem valores reais de `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `doc/ENV-META.example` só placeholders vazios
- Tokens de teste (`EAAB-...`) só em arquivos `*.test.ts`
- LAB mint/proxy Graph: guest 401; subscriber/operacional/suporte 403; master ok
- Tech Provider: token server-side cifrado; tenant pela sessão; `confirm` só marca `connected` após Graph
- `POST /{WABA_ID}/subscribed_apps` sem `subscribed_fields`
- Webhook GET/POST público, HMAC raw body, sem cookie

## Itens para evitar duplicação

Palavras-chave: `feat/meta-tech-provider-master`, cherry-pick `1e29b80`, origin/master `8f05836`, worktree `.tmp-meta-master-integration`, conflitos `src/index.ts` `/bets`+termos, `index.html` marketing+lab-api-oficial.
