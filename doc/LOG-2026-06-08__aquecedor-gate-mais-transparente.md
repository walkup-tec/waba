# LOG — overlay Aquecedor mais transparente

**Data:** 2026-06-08  
**Pedido:** aumentar transparência para enxergar mais a tela no fundo (seção Aquecedor bloqueada).

## Arquivos alterados
- `D:\Waba\index.html` — CSS `.aquecedor-section-gate` e painel de fundo

## Valores
| Propriedade | Antes | Depois |
|-------------|-------|--------|
| Fundo blur | 12px | 8px |
| Fundo opacity | 0.42 | 0.62 |
| Overlay bg | rgba(5,5,5,0.38) | rgba(5,5,5,0.2) |
| Overlay blur | 14px | 6px |
| Card bg | 0.9 | 0.82 |

## Validação
- Ctrl+F5 no painel `http://localhost:3012/version-02/` com usuário sem entitlement (ex. mozart.pmo@gmail.com) → aba Aquecedor.

## Pendências
- Nenhuma para este ajuste visual.
