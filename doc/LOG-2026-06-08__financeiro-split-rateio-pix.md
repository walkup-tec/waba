# Financeiro — Split de receita (PIX + custo por envio)

**Data:** 2026-06-08

## Regra de negócio
Por contratação paga (`waba-disparos`):
1. `custo = envios_contratados × custo_por_envio[apiKind]`
2. `distribuível = valor_pago - custo` (mín. 0)
3. Rateio do distribuível entre participantes ativos conforme `%` (soma = 100%)

Exemplo API Oficial: 1000 envios × R$0,19 = R$190; pago R$300 → R$110; 50%/50% → R$55 cada.

## Arquivos
- `waba-financeiro-split.repository.ts` — config (`data/.../waba-financeiro-split-config.json`)
- `waba-financeiro-split-settlement.repository.ts` — histórico de cálculos
- `waba-financeiro-split.service.ts` — validação + cálculo
- Hook em `waba-billing.service.ts` ao confirmar pagamento (webhook/conciliar)
- UI Admin → Financeiro → seção Split

## API (master)
- `GET/PUT /admin/financeiro/split-config`
- `GET /admin/financeiro/split-settlements`
- Overview inclui `splitConfig` e `splitSettlements`

## Marker
`DEPLOY-2026-06-08-financeiro-split-rateio-pix`

## Pendências
- Repasse PIX automático via Asaas (hoje só calcula e registra)
- Recalcular splits de pedidos antigos (backfill manual)
