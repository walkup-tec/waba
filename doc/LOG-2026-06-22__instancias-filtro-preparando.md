# LOG — Filtro "Preparando" na aba Instâncias

**Data:** 2026-06-22

## Pedido

Chip de filtro **Preparando** ao lado de Todas / Conectadas / Desconectadas, para listar só números em fase de preparação do aquecedor.

## Implementação

- `index.html`: botão `data-status="preparing"` na barra de filtros.
- `isInstancePreparing(inst)`: usa `resolveInstanceAquecedorStatusLabel === "Preparando"`.
- `renderInstancesList`: filtra quando `instancesStatusFilter === "preparing"`.
- **Fix:** Conectadas/Desconectadas usam o rótulo da coluna Status (não só `isOpen` da sessão WhatsApp).
- Chip ativo com destaque âmbar (diferente de Conectadas).

## Validar

1. V02 → Instâncias → clicar **Preparando** → só instâncias com status Preparando (ex.: `atendimento-906`).
2. Pesquisa + filtro Preparando combinam normalmente.

## Palavras-chave

`instancias`, `filtro`, `preparando`, `instances-chip`, `instancesStatusFilter`
