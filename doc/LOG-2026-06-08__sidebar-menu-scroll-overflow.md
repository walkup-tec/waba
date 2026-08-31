# LOG — Sidebar menu overflow (todos grupos abertos)

**Data:** 2026-06-08  
**Pedido:** Menu lateral escondido na parte inferior quando todos os grupos estão expandidos.

## Causa
`.tabs-wrapper` fixo com altura limitada, mas `.desktop-tabs` sem scroll; ao expandir sidebar o JS abria os 3 grupos (Aquecedor, Disparos, Admin).

## Correção (`index.html`)
- `overflow: hidden` em `.tabs-wrapper`; `flex:1; min-height:0; overflow-y:auto` em `.desktop-tabs`
- Scrollbar fina tema escuro
- `focusDesktopMenuGroupForActiveTab()` ao expandir — só o grupo da aba ativa fica aberto
- `setActiveTab` garante grupo da aba ativa aberto

## Validação
- `node scripts/copy-index-html.mjs`
