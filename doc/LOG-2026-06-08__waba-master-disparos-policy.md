# LOG — Política master parametrizável (disparos + split)

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-waba-master-disparos-policy`

## Solicitação

Usuários master com créditos ilimitados configuráveis e split de receita parametrizável (Fornecedores / Lucros). Com Lucros desmarcado, sem repasse PIX de lucro via Asaas.

## Alterações

| Área | Arquivo |
|------|---------|
| Modelo usuário | `src/users/waba-system-user.repository.ts` |
| Política master | `src/users/waba-master-disparos-policy.service.ts` (novo) |
| CRUD admin | `src/users/waba-system-user.service.ts`, `src/admin/waba-admin.routes.ts` |
| Créditos | `src/billing/waba-disparos-credits.service.ts` |
| Intake campanhas | `src/disparos/waba-campaign-intake.routes.ts` |
| Split financeiro | `src/billing/waba-financeiro-split.service.ts` |
| UI Admin · Usuários | `index.html` |

## Comportamento

- **Créditos ilimitados (master):** bypass de saldo no intake e campanhas legacy; UI mostra «Ilimitado».
- **Split Fornecedores:** repasse PIX ao fornecedor quando marcado; desmarcado → linha skipped, sem PIX.
- **Split Lucros:** repasse PIX aos participantes quando marcado; desmarcado → sem linhas partner, sem PIX de lucro.
- **Padrão** (master novo ou legado sem campos): ilimitado ✓, fornecedores ✓, lucros ✗.

## Validação

- `npm run build` — OK

## Pendências

- Commit + push Easypanel quando usuário solicitar deploy.
- Usuários master já existentes em produção herdam defaults na leitura (campos opcionais no JSON).
