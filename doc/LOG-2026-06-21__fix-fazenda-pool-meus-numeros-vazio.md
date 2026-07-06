# LOG — Meus números vazio (pool Fazenda)

**Contexto:** Aba «Meus números» mostrava lista vazia apesar de 10 instâncias com `use_fazenda=true` no Supabase.

## Causa

1. **Backend:** `listMasterFazendaInstanceNames` só retornava instâncias **do dono master** (`walkup@walkuptec.com.br`). No V02 as instâncias estão em `mozart.pmo@gmail.com` → pool vazio.
2. **Frontend:** lista usava só `availableToClaim` (exige `isOpen`). Com Evolution instável, números offline não apareciam.

## Correção

- **Pool:** priorizar todas as instâncias com `useFazenda=true` no `instancias_uso_config` (fallback legado: dono master).
- **UI:** `renderFazendaCardList` lista `pool.items` não atribuídos (até `availableSlots`), inclusive offline (badge «Offline»). Sem ícone de aquecido — cards só nome/meta.

## Arquivos

- `src/instances/waba-fazenda-pool.service.ts`
- `index.html` (`renderFazendaCardList`, `syncDisparadorNumberPicker`)

## Validar

Disparos → API Alternativa → Meus números (6 slots): deve listar até 6 instâncias Fazenda. Ctrl+F5 após restart V02.

**Palavras-chave:** fazendaPool, use_fazenda, Meus números, availableToClaim, listMasterFazendaInstanceNames
