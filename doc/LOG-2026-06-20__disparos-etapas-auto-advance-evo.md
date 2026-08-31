# LOG — Etapas Disparos: auto-abrir próxima seção (API Alternativa)

**Data:** 2026-06-20

## Problema
No modo API Alternativa (`waba-disparo-evo-mode`), ao salvar uma etapa, a próxima não abria. Etapas 2 (Temporizador) e 3 (Limite) ficam ocultas via CSS, mas ainda entravam na sequência.

## Correção
- `getDisparosFlowSections()` — só etapas visíveis no fluxo
- Salvar etapa → abre próxima **visível**
- `resetDisparosSectionFlow()` e estado inicial respeitam fluxo visível
- `normalizeDisparosSectionFlow()` ao entrar em modo EVO

## Arquivo
- `index.html`

## Teste
API Alternativa → salvar "Seleção de números" → deve abrir "Expediente" automaticamente.
