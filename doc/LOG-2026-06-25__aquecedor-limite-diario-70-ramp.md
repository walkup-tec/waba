# LOG — Aquecedor: limite diário 70 com ramp-up até 150

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-aquecedor-limite-diario-70`

## Contexto

Pedido: substituir faixa inicial 8–16 msgs/dia (hash por instância) por **70 msgs/dia** na semana 1, com crescimento semanal de ~40% e teto **150** na semana 4.

## Nova escala (por instância ativa)

| Semana desde ativação | Limite diário |
|----------------------|---------------|
| 1 | 70 |
| 2 | 98 (+40%) |
| 3 | 137 (+40%) |
| 4+ | 150 (teto) |

Fórmula: `min(150, round(70 × 1.4^semana))` — mesmo valor para todas as instâncias na mesma semana de vida.

## Alterações

- `computeDailyCapForInstance` simplificado (sem hash por nome).
- Constantes exportadas: `AQUECEDOR_DAILY_CAP_BASE`, `AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH`, `AQUECEDOR_DAILY_CAP_CEILING`.
- `ensureDailyCap` recalcula o teto a cada ciclo (deploy aplica novo limite sem esperar meia-noite).

## Arquivos

- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/deploy-marker.ts`

## Validar

`npm run build` OK. Após deploy, status do aquecedor deve mostrar limite **70** (ou maior conforme idade da instância), não mais 9.

## Palavras-chave

`aquecedor`, `limite-diario`, `70`, `150`, `ramp-up`, `computeDailyCapForInstance`
