# Fix: card «Instâncias ativas» vs filtro Conectados

## Contexto

Na aba Instâncias, o card **Instâncias ativas** mostrava **9** e o filtro **Conectados** listava **6 exibidas**. O subtítulo do card é «Instâncias Conectadas», mas a soma usava outra regra.

## Causa

| UI | Regra antiga |
|----|----------------|
| Card ativas | `i.isOpen` (sessão EVO aberta) |
| Filtro Conectados | `resolveInstanceAquecedorStatusLabel === "conectado"` |

Instâncias em **Preparando** (e **Restrição**) podem estar `isOpen === true` na Evolution e **não** entram no filtro Conectados. Ex.: 6 conectadas + ~3 preparando abertas ≈ 9 no card.

## Solução

Em `updateInstancesIndicators()` (`index.html` / `dist/index.html`):

- `ativas` → `isInstanceConnectedFilter(i)` (igual ao filtro Conectados)
- `desconectadas` → `isInstanceDisconnectedFilter(i)` (igual ao filtro Desconectados)

Preparando e Restrição continuam nos cards próprios.

## Arquivos

- `index.html`
- `dist/index.html`

## Como validar

1. Abrir Instâncias.
2. Card **Instâncias ativas** deve bater com **N exibidas** no filtro Conectados.
3. Card Preparando / Restrição / Desconectadas alinhados aos respectivos filtros.

## Observações

- Só UI (FTP / bundle). Sem mudança de Node/marker.
- Palavras-chave: indicadores, isOpen, conectado, Preparando, updateInstancesIndicators
