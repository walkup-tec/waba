# LOG - update-disparos-selecao-de-numeros-dual-list

## Contexto do pedido

O usuario solicitou mudar a selecao de instancias para disparo: em vez de um `select` multiplo unico, criar uma secao separada chamada **Selecao de numeros**, como primeira secao da pagina, com numeros disponiveis no lado esquerdo e numeros selecionados no lado direito.

## Acoes executadas

- Reestruturada a ordem das secoes em `Disparos` para colocar **Selecao de numeros** como primeira.
- Criado componente dual-list com:
  - `Números disponíveis` (esquerda)
  - botoes de mover (`→` e `←`)
  - `Números selecionados para disparo` (direita)
- Adicionada responsividade da nova secao para mobile.
- Substituida a leitura da configuracao `selectedDisparadorInstances` para usar a lista da direita.
- Atualizada a sincronizacao com instancias ativas/conectadas:
  - carrega candidatos a partir de `instancesData.items` com status `open`
  - aplica pre-selecao da configuracao carregada do backend
  - permite mover itens entre listas por botao e duplo clique
- Build executado para atualizar `dist/index.html`.

## Arquivos alterados

- `index.html`
- `dist/index.html` (gerado por build)

## Validacao

- Comando executado:
  - `npm run build`
- Resultado:
  - build concluido com sucesso
  - sem erros de lint em `index.html`

## Observacoes de seguranca

- Nenhum segredo/chave exposto.
- Alteracao focada em UI e manipulacao de estado de selecao no frontend.

## Palavras-chave para evitar duplicacao futura

- selecao-de-numeros
- dual-list-disparos
- selectedDisparadorInstances
- instancias-open-disparos
