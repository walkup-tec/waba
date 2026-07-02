# Admin Assinantes — criar assinantes e cupons de desconto

## Contexto

Pedido para melhorar o menu **Admin · Assinantes** (usuário master):

- Criar **assinantes** pelo painel
- Criar **cupons de desconto** com validade: 12h, 24h, personalizada ou vitalícia
- % de desconto sobre o total da cobrança de créditos
- Alias padrão: `WABA-[caractere especial][4 dígitos]` (ex.: `WABA-#4821`)
- No checkout PIX de créditos: campo para cupom, aplicar desconto **antes** de gerar a cobrança

## Solução implementada

### Backend

- `src/billing/waba-coupon-identifiers.ts` — regex, normalização e geração de alias
- `src/billing/waba-coupon.repository.ts` — persistência em `waba-coupons.json`
- `src/billing/waba-coupon.service.ts` — CRUD, validação, quote e registro de uso
- `src/admin/waba-admin-subscribers-create.service.ts` — criação de assinante via `WabaSubscriberService.register`
- `src/billing/waba-billing.service.ts` — quote no checkout; `listValueCents` vs `valueCents` final
- `src/billing/waba-billing-order.repository.ts` — campos `couponId`, `couponAlias`, `discountPercent`, `listValueCents`
- `src/billing/waba-billing.routes.ts` — `POST /billing/disparos/coupon/validate`
- `src/admin/waba-admin.routes.ts` — endpoints admin de assinantes e cupons
- `src/services/production-data-persistence.service.ts` — catálogo inclui `waba-coupons.json`

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/admin/subscribers` | Master cria assinante |
| GET | `/admin/coupons` | Lista cupons |
| POST | `/admin/coupons` | Cria cupom |
| PATCH | `/admin/coupons/:couponId/deactivate` | Desativa cupom |
| POST | `/billing/disparos/coupon/validate` | Valida cupom e retorna quote |
| POST | `/billing/disparos/checkout` | Aceita `couponAlias` opcional |

### Frontend (`index.html`)

- Painel `#tab-admin-assinantes`: formulários de novo assinante e cupons + tabela
- Modal `#disparos-billing-overlay`: campo cupom, botão Aplicar, resumo de desconto
- Listener do botão `#disparos-billing-coupon-apply-btn` e Enter no campo
- `syncAdminCouponValidityUi()` na inicialização do painel admin

### Deploy marker

`DEPLOY-2026-06-21-admin-assinantes-cupons-desconto`

## Como validar

1. Login como **master** → Admin · Assinantes
2. Criar assinante (nome, e-mail, senha, WhatsApp, CPF/CNPJ)
3. Criar cupom (12h / 24h / personalizada / vitalícia) com % de desconto
4. Login como assinante → Comprar créditos → selecionar pacote → modal PIX
5. Informar cupom → **Aplicar** → valor exibe desconto
6. **Gerar PIX** → cobrança Asaas com valor final descontado
7. Cupom expirado/inativo deve ser rejeitado na validação

## Segurança

- Rotas `/admin/*` restritas a master
- Cupom validado no servidor (não confiar só no valor enviado pelo cliente)
- `valueCents` do checkout recalculado a partir da tabela de preços + cupom
- Segredos Asaas permanecem no servidor (`ASAAS_API_KEY`)

## Palavras-chave

`admin-assinantes`, `waba-coupons.json`, `WABA-#1234`, `quoteDisparosCoupon`, `couponAlias`, `disparos-billing-overlay`
