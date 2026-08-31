# LOG — API Alternativa compra de números (R$ 20)

**Data:** 2026-06-19

## Pedido
Fluxo API Alternativa: alternativa à seleção de instâncias do Aquecedor — usuário compra números a R$ 20,00 cada, paga PIX total, conecta via QR.

## Backend
- `waba-alternativa-numbers.service.ts` — slots comprados/ativados/disponíveis
- `alternativa-number-activation.repository.ts` — persistência ativações
- `WabaBillingOrder.product`: `waba-alternativa-numbers`
- Rotas:
  - `GET /billing/alternativa-numbers/config`
  - `GET /billing/alternativa-numbers/summary`
  - `POST /billing/alternativa-numbers/checkout`
  - `POST /billing/alternativa-numbers/activate`
- PIX via Asaas (mesmo fluxo de créditos); pedido `quantity × R$ 20`

## Frontend (API Alternativa / disparo-evo)
- Seção 1 com abas: **Instâncias do Aquecedor** | **Comprar números**
- Comprar: stepper qty, total, **Pagar com PIX**, **Conectar número comprado** (QR wizard)
- Após PIX confirmado → aba Comprar + hint conectar
- Dual-list separado para números comprados/ativados

## Teste local
1. `npm run dev:v02` → API Alternativa
2. Aba **Comprar números** → qty → Pagar com PIX (Asaas sandbox)
3. Após pagamento → Conectar número → QR
4. Selecionar números ativados para disparo

## Pendências
- Commit/deploy produção (não solicitado)
- Master pode bypass slots? (hoje respeita slots por e-mail)
