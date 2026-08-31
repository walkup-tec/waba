# LOG - fix-instancias-botao-atualizar-online

## Contexto do pedido

Usuario informou que a foto nao atualizava e que o botao `Atualizar` na linha da instancia nao refletia mudanca.

## Causa raiz

O botao `Atualizar` por linha estava desabilitado para instancias conectadas (`open`), entao em grande parte dos casos o clique nao executava acao.

## Acoes executadas

- Em `index.html`:
  - Botao `Atualizar` da linha passou a ficar habilitado tambem para instancias conectadas.
  - Incluido atributo `data-is-open` por linha.
  - Ajustado handler de clique para:
    - se conectado: recarregar lista (`carregar()`) e exibir toast de confirmacao
    - se desconectado: manter fluxo atual de endpoint `/instancias/:name/atualizar`

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- `npm run build` executado com sucesso.
- Sem erros de lint em `index.html`.

## Observacoes de seguranca

- Nenhuma credencial exposta.
- Alteracao somente de comportamento de UI/acao de atualizacao.

## Palavras-chave

- instancias-botao-atualizar
- atualizar-instancia-online
- refresh-avatar-instancias
