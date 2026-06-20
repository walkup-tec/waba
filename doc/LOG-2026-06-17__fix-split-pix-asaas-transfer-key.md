# Fix split PIX — chave Asaas de transferência

**Data:** 2026-06-17

## Sintoma
Todas as linhas do split com status **FALHOU** e mensagem:
`A chave de API fornecida não possui permissão para realizar operações de saque via API.`

Código Asaas: `insufficient_permission` (HTTP 403).

## Causa raiz
`ASAAS_API_KEY` atual só tem permissão de **cobrança**. Repasses usam `POST /v3/transfers`, que exige chave com permissão de **saque/transferência**.

## Correção no código
- `ASAAS_TRANSFER_API_KEY` — chave dedicada para `/transfers` (fallback: `ASAAS_API_KEY`)
- `probeAsaasTransferPermission()` — diagnóstico no Admin → Financeiro
- Webhook `POST /webhooks/asaas/transfer-authorization` — aprova splits WABA (`waba:split:…`)
- Mensagens de erro mais claras no repasse

## Ação no Asaas (obrigatória)
1. **Integrações → Chaves de API** → gerar chave com permissão de **transferência/saque**
2. Colocar em `.env.v02`: `ASAAS_TRANSFER_API_KEY=...`
3. **Integrações → Mecanismos de segurança**:
   - Whitelist do IP do servidor (dev local: usar túnel ou desativar evento crítico para IP de teste)
   - Webhook de autorização de transferências → `http://localhost:3012/version-02/webhooks/asaas/transfer-authorization` (prod: URL pública)
4. Reiniciar `npm run dev:v02`
5. Admin → Financeiro → **Repassar** no pedido `7e2213b8-…`

## Arquivos
- `src/billing/asaas.client.ts`
- `src/billing/asaas-transfer-auth.service.ts`
- `src/billing/waba-financeiro-split-payout.service.ts`
- `src/billing/waba-billing.routes.ts`
- `src/admin/waba-admin-financeiro.service.ts`
- `index.html`
