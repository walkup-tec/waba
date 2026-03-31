# LOG — update-ui-remover-sinais-titulo-manter-barra-etapa

## Contexto do pedido

Foi solicitada a remocao dos sinais ao lado do nome da campanha para manter apenas a barra de etapa como fonte unica de status operacional.

## Acoes executadas

- Removidos os indicadores visuais (ponto/check) do titulo da campanha.
- Mantida a barra de etapa runtime abaixo da barra de progresso.
- Limpeza de CSS e JS associados aos sinais antigos.

## Solucao implementada (passo a passo)

1. Remocao das classes CSS:
   - `.disparos-campaign-title`
   - `.disparos-campaign-status`
   - variantes `--draft`, `--running`, `--paused`, `--finished`
2. Remocao da montagem de `statusUi` no render da lista.
3. Simplificacao do titulo para exibir somente o nome da campanha.
4. Mantida a barra de etapa (`runtimeStage`) como indicador principal.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Como validar

1. Abrir aba Disparos.
2. Confirmar que o nome da campanha nao exibe mais ponto/check ao lado.
3. Confirmar que a barra de etapa continua visivel e atualizando a fase operacional.

## Observacoes de seguranca

- Mudanca apenas visual.
- Sem alteracao de dados sensiveis, credenciais ou regras de negocio.

## Itens para evitar duplicacao futura (palavras-chave)

- `remover-sinais-titulo-campanha`
- `status-via-barra-etapa`
- `runtimeStage-ui-principal`
