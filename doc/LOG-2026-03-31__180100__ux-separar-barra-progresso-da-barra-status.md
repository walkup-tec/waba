# LOG — ux-separar-barra-progresso-da-barra-status

## Contexto do pedido

Mesmo com ajuste da etapa "aguardando intervalo", a percepcao visual ainda indicava barra verde, gerando confusao entre progresso e status.

## Acoes executadas

- Separado visualmente o papel das barras no card de campanha.
- Barra de progresso (processados/total) deixou de usar verde.
- Barra de etapa runtime manteve a semantica de cores por fase.

## Solucao implementada (passo a passo)

1. Alterada a barra de progresso geral da campanha para gradiente azul.
2. Mantida a barra de etapa runtime como barra de status operacional:
   - verde somente em `sending`;
   - amarelo em `waiting_interval`;
   - demais cores conforme fase.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Como validar

1. Em campanha com "aguardando intervalo":
   - barra de progresso aparece azul;
   - barra de etapa aparece amarela.
2. Em campanha "enviando agora":
   - barra de etapa aparece verde.

## Observacoes de seguranca

- Alteracao exclusivamente visual.
- Sem impacto em dados, credenciais ou regras de negocio.

## Itens para evitar duplicacao futura (palavras-chave)

- `separar-progresso-status-campanha`
- `barra-progresso-azul`
- `barra-etapa-semantica`
