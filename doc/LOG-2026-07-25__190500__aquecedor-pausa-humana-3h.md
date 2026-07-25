# LOG — Pausa humana 3h (não aplicar pós-Preparando)

## Pedido
- Reduzir pausa de 6h → **3h**
- Não aplicar pausa logo ao sair de Preparando: garantir **6h de envio** após `activatedAt`
- Rótulo UI: **«3 horas pausa humana»** (não «espera»)

## Comportamento
| Fase | Regra |
|------|--------|
| Preparando | 6h (inalterado) |
| Active, &lt;6h desde `activatedAt` | **imune** à pausa humana |
| Active, ≥6h desde `activatedAt` | pode entrar em `restricted_wait` por **3h** |

## Arquivos
- `src/services/aquecedor-instance-lifecycle.service.ts` (+ dist)
- `index.html` (CSS class também aceita label legado)
- `scripts/test-aquecedor-human-pause-window.mjs`

## Teste
`node scripts/test-aquecedor-human-pause-window.mjs` → ok

## Marker
`DEPLOY-2026-07-25-pausa-humana-3h`

## Palavras-chave
pausa humana, 3h, pós-preparando 6h, restricted_wait, 6 horas de espera
