# LOG — Indicadores Preparando + Restrição Temporária

## Contexto
Na aba Instâncias, além de ativas/desconectadas, exibir quantidade de instâncias em **Preparando** e **Restrição Temporária**.

## Solução
1. Dois cards no topo do `summary-grid` (acima de ativas/desconectadas):
   - Instâncias Preparando (`#instances-preparing-tab`)
   - Restrição Temporária (`#instances-restriction-tab`)
2. `updateInstancesIndicators()` conta via `isInstancePreparing` / `isInstanceWaRestricted`.
3. Chip de filtro **Restrição** na lista.
4. CSS amber para os novos cards/chips; bordas ativas/desconectadas ajustadas para 3º/4º filho.

## Arquivos
- `index.html` / `dist/index.html`

## Como validar
Abrir aba Instâncias: 4 indicadores; números batem com filtros Preparando / Restrição.

## Palavras-chave
instancias, preparando, restricao-temporaria, summary-card, indicadores
