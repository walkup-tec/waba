# Deploy produção — Admin Financeiro cadastro fornecedores (V02 → produção)

**Data:** 2026-07-09  
**Pedido:** Subir para produção as atualizações de **Admin → Financeiro → Cadastro fornecedores** testadas no V02.

## Escopo (commit `bfbda1d` + build `dist/`)

### Admin Financeiro — fornecedores
- Múltiplos fornecedores por plano + segmento (prioridade 1–5)
- Select operacional, plano (Oficial/Alternativa), PIX
- Validação e auto-save da config split

### Backend
- `waba-financeiro-split.repository.ts` / `.service.ts` — prioridade, segmento, operacional
- `waba-campaign-supplier-assignment.service.ts` — fila de atribuição campanhas
- `waba-operacional-campanhas.service.ts` — BM inoperante, reassign 30h, split pós-finalizar
- `waba-operacional-campaign-notify.service.ts` — alertas master/operacional

### UI (`index.html`)
- `renderAdminFinanceiroSplitSuppliers()` — cadastro/lista fornecedores
- Coluna segmento em Admin Campanhas (modal)

## Deploy marker

`DEPLOY-2026-07-09-financeiro-fornecedores-producao`

## Produção — checklist

1. **Easypanel → `waba_disparador` → Redeploy**
2. `GET https://waba.draxsistemas.com.br/health` → marker acima
3. Login master → **Admin → Financeiro** → cadastrar/editar fornecedor (plano, segmento, prioridade, operacional, PIX)
4. Admin → Campanhas → verificar coluna segmento e fluxo operacional

## Observação

- Código `src/` já estava em `master` desde `bfbda1d`; faltava **`dist/`** commitado para o Docker/Easypanel.
- Alteração local “ocultar saldo Alternativa Bets” **não** incluída neste deploy.

## Palavras-chave

`financeiro fornecedores`, `split prioridade`, `campaign-supplier-assignment`, `BM inoperante`, `deploy producao`
