# LOG — Aquecedor usa todas instâncias selecionadas (merge live+cache)

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-merge-all-connected`

## Sintoma
Produção: painel mostra N instâncias com Aquecedor habilitado; motor usa subconjunto (ou «menos de 2» intermitente).

## Causa raiz
1. `resolveAquecedorConnectedForOwner` retornava cedo com **só EVO live** quando `fromLive.length >= 2`, ignorando instâncias presentes no cache (`evo-instances-cache.json`) usado pelo painel `/instancias`.
2. `listConnectedEvoInstancesUnscoped` preferia live e descartava cache.
3. Diagnóstico casava instância só por chave live; alias/cache não entravam.

## Correção
- `mergeAquecedorConnectedRows` + `listMergedConnectedEvoInstancesUnscoped` (live ∪ cache, live ganha número).
- Motor, escopo master e diagnóstico usam a lista merged.
- `buildEvoInstanceLookupMap` (live + cache + aliases).
- `enrichAquecedorConnectedNumbersFromControleInstancia` preenche número via Supabase quando EVO omitiu.
- `filterConnectedForAquecedorOwner` com match por alias.

## Validar pós-deploy
1. `GET /health` → marker acima
2. Parar/iniciar Aquecedor (conta master)
3. `GET /aquecedor/diagnostico` → `instancias.eligible.length` = instâncias marcadas no painel
4. Ciclos devem rotacionar pares entre **todas** elegíveis (turno A→B ainda limita 1 envio/ciclo)
