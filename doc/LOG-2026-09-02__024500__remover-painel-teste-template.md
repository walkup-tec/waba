# LOG — Remover painel Visualizar / usar em teste

## Contexto

O card **Visualizar / usar em teste** (dump, número destino, parâmetros) ficou no laboratório depois que **Visualizar** passou a abrir o modal **Seu modelo**.

## Ações

- Removeu o `<section>` do painel.
- Removeu o botão **Usar em teste** da tabela (só existia por causa desse formulário).
- Tabela fica com **Visualizar** (modal) e **Excluir** (Meta + local).

## Como validar

Abrir o card de templates: não há o painel nem o botão Usar em teste. Visualizar continua abrindo **Seu modelo**.

## Palavras-chave

visualizar, usar em teste, painel legado, template lab
