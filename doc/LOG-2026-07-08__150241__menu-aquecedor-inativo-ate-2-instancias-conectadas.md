# LOG — Menu Aquecedor inativo até 2 instâncias conectadas

**Data:** 2026-07-08  
**Contexto:** Item **Aquecedor** no menu lateral aparecia ativo mesmo sem 2 instâncias conectadas (regra de negócio).

## Causa

1. `getConfiguredInstancesCount()` contava instâncias com `useAquecedor`, **sem exigir status conectado**.
2. `applyMenuSectionAccess()` só aplicava `disabled` quando `hasAquecedorAccess()` era verdadeiro — em alguns estados o item ficava visualmente ativo.
3. Estilo `.disabled` (opacity 0.45) era pouco visível no menu lateral produção.

## Solução

**Arquivo:** `index.html`

1. Contagem passa a usar `useAquecedor` + `isInstanceConnectedFilter()` (status **conectado**).
2. Bloqueio do menu `aquecedor` quando `isTabLocked("aquecedor")`, sem depender de entitlement.
3. CSS reforçado: `.aquecedor-menu-locked`, grayscale, cor acinzentada, `pointer-events: none`.
4. Mensagens/toasts: "2 instâncias **conectadas** no Aquecedor".
5. `updateTabAccessRules()` no boot para estado correto antes do carregamento Evo.

## Como validar

1. Reiniciar V02 (`npm run dev:v02`).
2. Com 0–1 instância conectada: menu **Aquecedor** acinzentado/inativo; clique mostra toast.
3. Com ≥2 conectadas (useAquecedor): menu ativo; aba Aquecedor liberada.

## Palavras-chave

`aquecedor-menu-locked`, `data-min-instances`, `getConfiguredInstancesCount`, `isInstanceConnectedFilter`, `updateTabAccessRules`
