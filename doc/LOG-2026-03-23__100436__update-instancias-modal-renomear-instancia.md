# LOG - update-instancias-modal-renomear-instancia

## Contexto do pedido

Foi solicitado, na pagina `Instancias`, permitir clicar sobre a instancia para abrir um modal de alteracao de nome.

## Acoes executadas

- Frontend (`index.html`):
  - Criado modal `rename-instance-overlay` com campos de nome atual e novo nome.
  - Tornados clicaveis os campos de nome na tabela (colunas `Nome` e `Instancia`) com gatilho para abrir o modal.
  - Implementadas funcoes:
    - `openRenameInstanceModal`
    - `closeRenameInstanceModal`
    - `saveInstanceRename`
  - Adicionados listeners para:
    - salvar no botao
    - cancelar
    - fechar clicando fora
    - confirmar com tecla Enter
  - Adicionado estilo visual para os nomes clicaveis (`instance-name-link`).

- Backend (`src/index.ts`):
  - Novo endpoint: `POST /instancias/:name/renomear`.
  - Validacoes:
    - nome atual e novo obrigatorios
    - novo nome diferente do atual
    - bloqueio de conflito com nome de instancia ativa/conectada
  - Integracao com Evolution API via tentativas de rotas de rename/update (fallbacks).
  - Adicionado suporte a metodo `PUT` em `callEvoAction`.
  - Adicionada variavel de ambiente `EVO_RENAME_URL_TEMPLATE` com fallback padrao.

## Arquivos alterados

- `index.html`
- `src/index.ts`
- `dist/index.html` (build)
- `dist/index.js` (build)

## Validacao

- Comando executado:
  - `npm run build`
- Resultado:
  - compilacao TypeScript ok
  - `dist/` atualizado com sucesso

## Observacoes de seguranca

- Nenhuma chave/segredo exposto.
- Validacao de conflito de nome ativo mantida para evitar duplicidade operacional.

## Palavras-chave para evitar duplicacao futura

- instancias-renomear
- modal-editar-nome-instancia
- endpoint-instancias-renomear
- evo-rename-fallback
