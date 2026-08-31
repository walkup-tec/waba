# Log: card Disparos — Instância da vez com rótulo correto

## Contexto

No resumo da aba **Disparos**, o card **Instância ativa** (subtítulo **Instância da vez**, `#disparos-instancia-ativa`) exibia apenas o nome técnico retornado por `GET /disparos/next-instance`, em vez do mesmo rótulo usado na lista/seletor (alias + `instanceLabel`, como em `syncDisparadorNumberPicker`).

## Ações executadas

- Variável `disparosNextInstanceTechnicalCache`: guarda o último nome técnico devolvido por `/disparos/next-instance` (sem novo request ao só atualizar labels).
- `getDisparadorInstanceLabelByValue`: resolve rótulo com a mesma prioridade do seletor — `instanceAlias` → `instanceLabel` → nome técnico.
- `applyDisparosActiveInstanceCardDisplay(technicalName)`: atualiza o texto do card.
- `refreshDisparosActiveInstanceCardLabelOnly()`: reaplica o rótulo a partir do cache (após `/instancias`, sync do picker, ou `updateLocalInstanceLabels`).
- `refreshDisparosActiveInstanceFromServer()`: único ponto que chama `/disparos/next-instance`, atualiza cache e o card.
- `loadDisparosTemplates`: passou a usar `refreshDisparosActiveInstanceFromServer()` no lugar do fetch inline.
- `carregar()` (após `syncDisparadorNumberPicker`): chama `refreshDisparosActiveInstanceCardLabelOnly()`.
- `updateLocalInstanceLabels`: ao final, `refreshDisparosActiveInstanceCardLabelOnly()`.

## Arquivos alterados

- `index.html` (copiado para `dist/index.html` via `npm run build`)

## Como validar

1. `npm run build` / `npm start`
2. Abrir aba **Disparos** com instâncias que tenham **alias** em Instâncias
3. Confirmar que **Instância da vez** mostra o mesmo rótulo que no dual-list “Números do disparador”
4. Renomear alias (inline) e, após atualizar dados, confirmar que o card reflete o novo nome sem precisar consumir outro passo de round-robin além do polling já existente

## Segurança

- Nenhum segredo adicionado; apenas exibição no cliente.

## Palavras-chave

`disparos-instancia-ativa`, `disparosNextInstanceTechnicalCache`, `getDisparadorInstanceLabelByValue`, `refreshDisparosActiveInstanceFromServer`, `refreshDisparosActiveInstanceCardLabelOnly`, `next-instance`
