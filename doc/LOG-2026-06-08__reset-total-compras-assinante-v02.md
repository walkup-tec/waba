# Reset total — compras de assinante (v02)

**Data:** 2026-06-08  
**Ambiente:** `WABA_ENV=v02` (`data/v02/`)  
**Supabase DEV:** `wcexaxeenvuigktyomdq`

## Pedido
Excluir por completo todas as compras de assinante do sistema (banco + arquivos locais) para teste do zero.

## Executado

Script: `node scripts/reset-all-subscriber-purchases-v02.cjs`

### Antes → depois (local)

| Arquivo / pasta | Antes | Depois |
|-----------------|------:|-------:|
| `waba-billing-orders.json` | 15 | 0 |
| `waba-disparos-credit-usage.json` | 1 entrada | 0 |
| `waba-disparos-bonus-balances.json` | 1 entrada | 0 |
| `waba-financeiro-split-settlements.json` | 9 | 0 |
| `waba-campaign-intakes.json` | 11 | 0 |
| `campaign-intakes/*` (pastas) | 17 | 0 |

### Supabase

- `disparos_campaigns`: 0 → 0
- `disparos_campaign_leads`: 0 → 0

### Mantido (não apagado)

- `waba-subscribers.json` — cadastro/login assinantes
- `waba-system-users.json` — masters
- `waba-financeiro-split-config.json` — configuração split (fornecedores/rateio)
- `disparos-local-state.json` — campanhas operacionais master (sem `ownerEmail`)
- `aquecedor-*`, `instance-owners.json`, `runtime-intent.json`

## Próximo passo

1. Reiniciar `npm run dev:v02` (se servidor ativo) e F5 no painel
2. Testar nova compra PIX do zero
3. Validar saldo zerado para assinantes existentes (ex.: mozart.pmo@gmail.com)

## Pendências

- Pedidos no Asaas (sandbox/produção) **não** foram cancelados — só dados locais + Supabase WABA
