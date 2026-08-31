# LOG — Fix Refazer Pix não recriar transferências em processamento

**Data:** 2026-06-08

## Problema

Usuário clicou **Refazer Pix** e as 3 linhas ficaram vermelhas com:
`A chave de API fornecida não possui permissão para realizar operações de saque via API.`

## Causa

1. Linhas **Fornecedor** e **Walkup** já estavam `processing` (transferências PENDING no Asaas).
2. O retry chamava `getAsaasTransfer`; se falhasse, **criava nova transferência** (`POST /transfers`) para todas as linhas.
3. Isso podia falhar com erro de permissão (servidor sem `ASAAS_TRANSFER_API_KEY` carregada) ou duplicar repasses.

## Correção

- `waba-financeiro-split-payout.service.ts`: linha `processing` com `asaasTransferId` → **só consulta** status no Asaas; nunca reenvia PIX.
- `index.html`: toast detalha falhas parciais vs processando vs concluído.

## Estado após script de retry

Pedido `7e2213b8-…`:
- Fornecedor API Oficial: **amarelo** (processing)
- Walkup: **amarelo** (processing)
- Teste Split: **vermelho** — `Saldo insuficiente para realizar a operação.` (carteira Asaas)

## Ação operacional

1. Reiniciar `npm run dev:v02` (garantir `ASAAS_TRANSFER_API_KEY` no processo).
2. F5 no Admin Financeiro.
3. Para Teste Split: depositar saldo na carteira Asaas ou ajustar chave PIX de teste.
