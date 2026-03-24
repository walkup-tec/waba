# LOG - ui-instancias-toggle-aquecedor-disparador-verde

## Contexto

Solicitado ajuste visual na tela de `Instâncias` para reduzir variação de cores e padronizar os boxes de `Aquecedor` e `Disparador` em verde conforme paleta.

## Ações executadas

- Ajustado CSS em `index.html`:
  - Adicionada regra para `.instance-role-toggle` com `accent-color: #16a34a`.
- Impacto:
  - checkboxes de `Aquecedor` e `Disparador` passam a usar verde consistente na seleção.

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validação

- `npm run build` executado com sucesso.
- Sem erros de lint no arquivo alterado.

## Palavras-chave

- ui-instancias
- toggle-verde
- aquecedor-disparador-paleta
