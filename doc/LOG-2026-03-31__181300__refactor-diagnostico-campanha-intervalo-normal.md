# LOG — refactor-diagnostico-campanha-intervalo-normal

## Contexto do pedido

O diagnostico de campanha em `running` estava sendo interpretado como erro/travamento por exibir repetidamente "aguardando intervalo", mesmo com envios acontecendo.

## Acoes executadas

- Reescrita da mensagem `proximoEnvio` no endpoint de diagnostico.
- Inclusao de semantica explicita de ciclo ativo e normalidade operacional.
- Inclusao de contagem regressiva em segundos para o proximo envio.

## Solucao implementada (passo a passo)

1. Em `GET /disparos/diagnostico`, na montagem de `proximoEnvio`:
   - fora do expediente: prefixo `ciclo em execução` + contexto `(normal)`;
   - dentro do expediente com cooldown: `intervalo operacional (normal)` + `próximo envio em ~Xs`;
   - dentro do expediente elegivel: `pronto para envio no próximo ciclo (~7s)`.
2. Mantida a logica funcional de envio (apenas melhoria de interpretacao do texto operacional).

## Arquivos alterados

- `src/index.ts`
- `dist/index.js` (gerado pelo build)

## Como validar

1. Abrir diagnostico durante campanha `running`.
2. Confirmar mensagens com semantica:
   - "ciclo em execução" quando campanha esta ativa;
   - "intervalo operacional (normal)" durante cooldown;
   - contagem `~Xs` reduzindo ao longo do tempo.

## Observacoes de seguranca

- Sem alteracao de credenciais, segredos ou dados sensiveis.
- Ajuste textual/observabilidade.

## Itens para evitar duplicacao futura (palavras-chave)

- `diagnostico-intervalo-normal`
- `proximoEnvio-contagem-regressiva`
- `ciclo-em-execucao`
