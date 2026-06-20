# LOG — UI histórico split: texto limpo + sinais de status

**Data:** 2026-06-08  
**Contexto:** Pedido do usuário para simplificar linhas do rateio e trocar badges/× por sinais coloridos.

## Solicitação

- Texto das linhas:
  - `Fornecedor API Oficial: R$ 19,00 (100 envios × R$ 0,19)`
  - `Walkup: R$ 5,50 participação 50%`
  - `Teste Split: R$ 5,50 participação 50%`
- Remover PIX e prefixo duplicado "Fornecedor Fornecedor".
- Status visual:
  - Vermelho = erro (`failed`)
  - Amarelo = processando (`processing`, `pending`, `partial`)
  - Verde = sucesso (`paid`)

## Alterações

| Arquivo | O quê |
|---------|--------|
| `index.html` | CSS `.admin-financeiro-split-signal`; `renderSplitPayoutSignal()`; `formatSplitSettlementLineBody()`; `renderAdminFinanceiroSplitSettlements` usa novo formato |

## Validação

- F5 no Admin Financeiro com `npm run dev:v02` (servidor já em execução usa `index.html` da raiz).

## Pendências

- Repasse pedido `7e2213b8-…`: 2 linhas processing, 1 failed (saldo Teste Split) — operacional via **Refazer Pix**.
