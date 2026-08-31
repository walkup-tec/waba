# LOG — Aquecedor master escopo global

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-master-global-scope`

## Sintoma
Produção: «Menos de 2 instâncias no seu escopo (0)» com instâncias visíveis/habilitadas no painel.

## Causa
Motor usava só `instance-owners.json` + ativações Alternativa. Master via instâncias no painel (após reconcile na listagem), mas o Aquecedor não reconciliava órfãs nem incluía todas as conectadas com `useAquecedor`.

## Correção
- `isAquecedorGlobalScopeOwner`: master admin + role master no sistema
- Master: reconcile órfãs + escopo = todas instâncias EVO conectadas (live → cache) com Aquecedor habilitado
- Assinante: comportamento anterior mantido

## Deploy
Commit `47c049e` → merge `master` → Easypanel `waba_disparador`.

Validar: parar/iniciar Aquecedor; mensagem deve mostrar N instâncias no escopo ≥ 2.
