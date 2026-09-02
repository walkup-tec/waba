# Filtro de categoria no template do Disparo Cloud

## Contexto do pedido

No campo Template aprovado do Disparo Cloud: incluir filtro por categoria (primeira opção `todas`) e exibir no select apenas `nome-categoria`.

## Ações executadas

- Ajustar o HTML/JS do wizard na aba Templates.
- Atualizar o preview local com um template Marketing para o filtro ter mais de uma categoria.

## Solução implementada

1. Select de categoria ao lado do template; primeira opção `todas`.
2. As demais opções vêm das categorias dos templates **APPROVED** do portfólio (Utilidade, Marketing, Autenticação).
3. O select do template mostra só `nome-categoria`.
4. Trocar a categoria refaz a lista e recarrega o mapeamento das colunas.

## Arquivos criados/alterados

- `index.html`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

Abrir o Disparo Cloud, escolher o portfólio e conferir:
- filtro começa em `todas`;
- opções no formato `consulta_margem_atualizacao_1-Utilidade`;
- filtrar Marketing esconde os de Utilidade.

## Observações de segurança

Sem novos segredos. Só UI do Laboratório.

## Palavras-chave

filtro-categoria, template-aprovado, disparo-cloud, nome-categoria
