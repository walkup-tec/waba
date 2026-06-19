# LOG — FAB Suporte 15px margem esquerda

**Data:** 2026-06-18  
**Contexto:** usuário atualizou página e botão `?` continuava à direita da sidebar (~98px).

## Causa raiz

1. Servidor `dev:v02` na porta 3012 roda de **`D:\Waba`**, não `E:\Waba` (edições anteriores no path errado).
2. Mesmo com CSS correto, **`syncWabaSupportFabPosition()`** aplicava `left` inline via `sidebar.getBoundingClientRect().right + 14`, sobrescrevendo o CSS.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `D:\Waba\index.html` | CSS desktop: `left: 15px !important`; JS: `setProperty("left", "15px")` no desktop |
| `D:\Waba\src\deploy-marker.ts` | `DEPLOY-2026-06-18-waba-support-fab-left-15px` |

## Validação

```text
node check served HTML:
  calc(14px + 70px) → false
  left: 15px !important → true
```

## Pendências

- Hard refresh no browser (Ctrl+F5) se cache antigo.
- Reiniciar `npm run dev:v02` só para novo `deployMarker` no `/health`.
- Deploy Easypanel para produção.
