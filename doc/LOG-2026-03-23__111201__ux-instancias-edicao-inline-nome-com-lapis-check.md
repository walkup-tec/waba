# LOG - ux-instancias-edicao-inline-nome-com-lapis-check

## Contexto do pedido

Usuario solicitou tornar a alteracao de nome mais intuitiva na coluna **Nome da Instancia**:
- Exibir lapis para indicar edicao.
- Ao editar, trocar lapis por check para confirmar salvamento.
- Evitar dependencia do modal para essa acao.

## Acoes executadas

- Frontend (`index.html`):
  - Coluna renomeada para `Nome da Instância`.
  - Implementada edicao inline por linha:
    - estado normal: nome + botao com icone de lapis (`✎`)
    - estado de edicao: input + botao de confirmacao (`✓`)
  - Fluxo de interacao:
    - clique no lapis abre input de edicao na propria linha
    - clique no check salva o novo nome
    - `Enter` confirma salvamento
    - `Esc` cancela edicao inline
  - Mantida reutilizacao da mesma API backend de renomeacao (`POST /instancias/:name/renomear`).
  - Modal antigo permanece no codigo, mas edicao principal agora ocorre inline na tabela.

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- `npm run build` executado com sucesso.
- Sem erros de lint em `index.html`.

## Observacoes de seguranca

- Nenhum segredo exposto.
- Sem mudancas de permissao/autenticacao; apenas UX de edicao.

## Palavras-chave

- instancias-edicao-inline
- nome-da-instancia-lapis-check
- rename-inline-instancias
