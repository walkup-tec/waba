# LOG — UX Comprar números (card picker)

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-comprar-numeros-card-picker-ux`

## Problema
Shuttle dual-listbox (→ ←) confuso; jargão "fazenda"; nomes duplicados ("Atendimento").

## Solução
- Guia 3 passos (Comprar → Ativar → Disparar)
- Cards com botão **Ativar** por número
- Telefone + ID técnico no subtítulo
- Tab dinâmica: "Meus números (N)"
- Backend: `FazendaPoolItem.number` no summary

## Deploy
Commit `74e379a` → `master` + Easypanel `waba_disparador`
