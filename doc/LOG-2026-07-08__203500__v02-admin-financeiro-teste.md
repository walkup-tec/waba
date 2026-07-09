# LOG — V02 Admin Financeiro pronto para teste

**Data:** 2026-07-08

## Pedido

Revisar atualizações da semana em **Admin → Financeiro** (ordem de prioridade, select de fornecedores) e subir no ambiente V02 para teste.

## Auditoria (código / git)

Não há commits **desta semana** exclusivos de Financeiro/split. As funcionalidades citadas já estão no código desde **jun/2026** (`e849b4f` — pack produção):

| Recurso | Onde | Comportamento |
|---------|------|---------------|
| **Ordem de prioridade** (linhas do split) | `index.html` → `sortSplitSettlementLines()` | CET → fornecedor → parceiros (alfabético) |
| **Select plano fornecedor** | `renderAdminFinanceiroSplitSuppliers()` | `<select>` API Oficial / Alternativa |
| **Select usuário master** (rateio lucro) | `buildSplitMasterSelectOptions()` + `masterUsers` no overview | Lista masters do sistema |
| **Auto-save split** | `persistAdminFinanceiroSplitConfig()` debounced | Grava ao incluir/editar |
| **Refresh completo** | `loadAdminFinanceiro()` | Métricas + split + pedidos paginados |
| **Monitor Asaas** | `src/admin/waba-admin.routes.ts` | Status/run/test-alert (jul/07) |

Commits jul/2026 relacionados indiretamente: `47d0a05` (uptime monitor), `7d55eee` (luzes CPU) — não alteram UI do split, mas fazem parte do ecossistema admin desta semana.

## Ações executadas

1. `npm run build` — OK
2. Reinício `npm run dev:v02` (porta 3012)
3. Health validado

## Como testar no V02

1. Abrir: http://localhost:3012/version-02/
2. Login **master** (ex.: `walkup@walkuptec.com.br`)
3. Menu **Admin → Financeiro**
4. **Split de receita → Fornecedores** — expandir card; ver select de plano e formulário incluir
5. **Split de receita → Rateio do lucro** — select de usuário master (não digitar e-mail livre)
6. **Histórico de splits** — linhas na ordem CET → fornecedor → parceiros
7. Ctrl+F5 se UI antiga em cache

## Dados V02

Config split local: `data/v02/waba-financeiro-split-config.json` (gitignored).

## Pendências

- Se havia alteração **não commitada** desta semana (ex.: perdida no `git checkout index.html`), não foi encontrada em stash nem diff — avisar o que falta para reimplementar.

## Palavras-chave

admin financeiro, split fornecedores, select master, sortSplitSettlementLines, v02 teste, prioridade linhas split
