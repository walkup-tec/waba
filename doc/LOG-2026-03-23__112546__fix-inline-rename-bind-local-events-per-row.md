# LOG - fix-inline-rename-bind-local-events-per-row

## Contexto

Persistia problema no check (`✓`) da edicao inline do nome da instancia: nao salvava e nao retornava ao estado inicial.

## Ajuste realizado

- Removida dependencia de delegacao global para eventos da edicao inline.
- Eventos de editar/salvar/input/teclado passaram a ser vinculados diretamente nos elementos da linha renderizada:
  - `.instance-inline-edit-btn`
  - `.instance-inline-save-btn`
  - `.instance-inline-input`
- Mantido fluxo:
  - salvar via API
  - voltar ao estado inicial apos sucesso
  - `Enter` confirma e `Esc` cancela

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- `npm run build` concluido com sucesso.
- Sem erros de lint no arquivo alterado.

## Palavras-chave

- inline-rename-local-events
- instance-inline-save
- fix-check-not-saving
