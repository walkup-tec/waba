## Contexto do pedido

Adicionar no relatório de campanha do Disparador o indicador de conversão baseado em clique no link:
- conversão = (quem clicou no link) / (quem recebeu mensagem)

## Ações executadas

1. Ajustei o fluxo de composição/envio para capturar e guardar o link curto usado por lead enviado.
2. Adicionei consulta de cliques ao EncurtadorPro por link curto no momento do relatório.
3. Calculei e expus no backend:
   - `clicaramNoLink`
   - `conversaoPercent`
   - `conversaoTexto`
4. Atualizei o modal de relatório na UI para mostrar:
   - card "Conversão (cliques)"
   - observação de cobertura da checagem de cliques quando há limite aplicado.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `doc/LOG-2026-03-26__145157__relatorio-campanha-conversao-cliques.md`
- `doc/memoria.md`

## Como validar

1. Reiniciar o servidor para carregar alterações.
2. Rodar uma campanha com envio de mensagens contendo link curto.
3. Abrir `Relatório` da campanha e validar:
   - "Conversão (cliques)" aparece no resumo
   - valor segue formato `% (clicaram/enviadosComSucesso)`
4. Confirmar que `GET /disparos/campanhas/:id/relatorio` retorna os novos campos.

## Observações técnicas

- A checagem de cliques por relatório usa limite de até 25 links por execução para respeitar rate limit da API externa.
- Conversão usa como base apenas contatos com `status = sent`.

## Segurança

- Sem exposição de credenciais em código/log.
- Chamada ao EncurtadorPro usa chave em variável de ambiente.

## Palavras-chave

- relatorio-conversao
- cliques-encurtadorpro
- disparos-campanhas-relatorio
