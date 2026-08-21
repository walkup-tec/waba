# LOG — fix repasse PIX Walkup falso "Com falha"

## Sintoma

Pedido `58aa9a81-…`: Walkup recebeu PIX, mas UI mostrava vermelho "Com falha" (Eduardo também).

## Causa

1. **Retry** append `:retry:timestamp` na `externalReference` até **> 100 chars** → Asaas rejeita.
2. Linha marcada `failed` mesmo com transferência **DONE** anterior no Asaas.
3. Sync só consultava linhas `processing` com `asaasTransferId` — não reconciliava falhas.

## Correção

- Referência compacta `waba:sp:…` + retry `:rN` (sempre ≤ 100).
- Retry: contador `:rN` em vez de encadear `:retry:…`.
- `syncSettlementLinesForSettlement`: reconcilia `failed`/`processing` via Asaas (`listAsaasTransfers` + filtro exato por ref/valor).
- `retryLineForOrder`: reconcilia antes de reenviar PIX.

## Validar

```bash
npm run build
npm run verify:split-external-ref
```

Simulação pedido Fernando: Walkup → `paid`, Eduardo → `failed`, settlement → `partial`.

Marker: `DEPLOY-2026-08-14-split-pix-ref-sync`
