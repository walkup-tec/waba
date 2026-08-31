# LOG - fix-inline-rename-check-click-target

## Contexto do pedido

Usuario reportou que ao clicar no check (`✓`) da edicao inline do nome da instancia, nao salvava e nao voltava ao estado inicial.

## Causa raiz

O `event.target` podia chegar como no de texto (texto do icone), e o handler exigia `Element`, abortando o fluxo antes de identificar o botao.

## Acoes executadas

- Adicionada funcao utilitaria `getEventElementTarget` para normalizar o alvo do evento:
  - usa o proprio alvo quando ja e `Element`
  - fallback para `parentElement` quando o alvo e no de texto
- Aplicado esse ajuste nos listeners:
  - `click`
  - `input`
  - `keydown`

## Resultado esperado

- Clique no `✓` passa a disparar o salvamento corretamente.
- Fluxo volta ao estado inicial apos salvar (ou cancelar sem alteracao).

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- `npm run build` executado com sucesso.
- Sem erros de lint em `index.html`.

## Palavras-chave

- inline-rename-check
- event-target-text-node
- instancia-edicao-inline-fix
