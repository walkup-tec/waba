# Números do disparo = Ativos do portfólio

## Contexto do pedido

Os números Ativos exibidos em **NÚMEROS DESTE PORTFÓLIO** (aba Portfólios) são os que devem aparecer e ser usados no Disparo Cloud.

## Ações executadas

- Amarrar o select do wizard à mesma lista de números do card do portfólio.
- Recarregar o portfólio ao abrir Templates, em vez de só quando a lista estava vazia.

## Solução implementada

1. `metaTplBroadcastActiveNumbers` lê `portfolio.numbers` do BM escolhido — a mesma fonte dos cards.
2. Continua filtrando `uiStatus === ativo` e `dispatchStatus !== em_disparo`.
3. `wabaLoadMetaTemplatesLab` sempre chama `metaTpLoadPortfolio`.
4. Se a aba Portfólios já tiver um BM selecionado, o wizard começa nesse portfólio.
5. Texto de ajuda: mesmos números Ativos do portfólio.

## Arquivos criados/alterados

- `index.html`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

Na aba Portfólios, anotar os chips **Ativo** + **Disponível**. No Disparo Cloud, escolher o mesmo portfólio: o select deve listar exatamente esses números (ex.: Relacionamento Jandira Feghali · +55 21 92368-3286).

## Observações de segurança

Sem novos segredos.

## Palavras-chave

numeros-ativos, portfolio, disparo-cloud, disponivel, quantum-smart-labs
