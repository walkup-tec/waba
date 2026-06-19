# LOG — Créditos teste mozart.pmo@gmail.com (500 por API)

**Data:** 2026-06-18  
**Solicitação:** 500 envios de cada API para testes do usuário mozart.pmo@gmail.com

## Ações

1. Executado `node scripts/grant-disparos-credits-v02.cjs mozart.pmo@gmail.com 500`
2. Ajustados pedidos fictícios pagos para saldo exato após consumo de campanhas:
   - **API Oficial** (`402b734d-ab30-40dc-bd0d-f73e989abf2b`): 600 envios (total contratado 800)
   - **API Alternativa** (`47752b89-22b1-47b0-967d-734afc343c82`): 500 envios (total contratado 700)
3. Pedidos marcados com `bonusShipmentsApplied: 1` para evitar re-settlement de bônus pelo dev server

## Saldo validado (data/v02)

| API | Contratado | Consumido | Disponível |
|-----|----------|-----------|------------|
| Oficial | 800 | 300 | **500** |
| Alternativa | 700 | 200 | **500** |

## Arquivos alterados

- `data/v02/waba-billing-orders.json`
- `data/v02/waba-disparos-credit-usage.json` (consumo sincronizado com intakes)
- `doc/memoria.md`

## Validação

- Recarregar painel Disparos logado como mozart.pmo@gmail.com (Ctrl+F5)
- Ambiente: `npm run dev:v02` → http://localhost:3012/version-02/

## Pendências

- Nenhuma para este pedido (somente ambiente local v02)
