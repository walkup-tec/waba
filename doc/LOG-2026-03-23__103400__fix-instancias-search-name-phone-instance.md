# LOG - fix-instancias-search-name-phone-instance

## Contexto do pedido

Usuario informou que o campo de pesquisa na pagina `Instancias` nao estava funcionando como esperado. Regra desejada: localizar por qualquer caractere comparando nome, telefone e instancia.

## Causa raiz

O filtro usava apenas `displayName`, ignorando `instanceName` e telefone.

## Acoes executadas

- Atualizado filtro em `renderInstancesList` (`index.html`) para buscar por:
  - `displayName`
  - `instanceName`
  - `displayNumber`
  - `originalNumber`
- Comparacao em `lowercase` para busca case-insensitive e parcial.

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- `npm run build` executado com sucesso.
- Sem erros de lint em `index.html`.

## Observacoes de seguranca

- Alteracao somente no filtro de busca local da UI.
- Nenhum segredo/chave envolvido.

## Palavras-chave

- instancias-search
- filtro-nome-telefone-instancia
- busca-parcial-instancias
