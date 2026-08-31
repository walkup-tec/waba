# LOG — update-disparos-barra-etapa-runtime-campanhas

## Contexto do pedido

Foi solicitado distinguir melhor o momento operacional de cada campanha (nao apenas `running/paused`) e substituir a leitura por sinais por uma barra adicional, no estilo do indicador do aquecedor.

## Acoes executadas

- Backend: enriquecido `GET /disparos/campanhas` com etapa de runtime por item.
- Frontend: adicionada uma barra de etapa abaixo da barra de progresso atual.
- Mantida compatibilidade com status legado (fallback no cliente).

## Solucao implementada (passo a passo)

1. No endpoint `GET /disparos/campanhas`, adicionado objeto `runtimeStage` por campanha:
   - `phase`: `draft | sending | waiting_interval | outside_window | paused | finished`
   - `label`: texto curto da etapa atual
   - `detail`: detalhe operacional (ex.: segundos restantes, fora do expediente)
   - `fillPercent`: preenchimento da barra da etapa
2. Regras de decisao da etapa:
   - `finished` => finalizada
   - `paused` => pausada (manual ou automatica por saude)
   - `draft` => rascunho
   - `running` + fora da janela => `outside_window`
   - `running` + dentro da janela + cooldown ativo => `waiting_interval`
   - `running` + dentro da janela + elegivel no ciclo => `sending`
3. Na UI da lista de campanhas:
   - mantida a barra de progresso de processamento;
   - adicionada barra de etapa com cor por `phase`;
   - adicionada legenda textual da etapa com detalhe operacional.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.html`

## Como validar

1. Abrir Disparos e observar cada card de campanha.
2. Confirmar barra de etapa abaixo da barra de progresso.
3. Validar cenarios:
   - campanha `running` em cooldown => "Aguardando intervalo"
   - campanha `running` fora da janela => "Fora do expediente"
   - campanha pausada => "Pausada"
   - campanha finalizada => "Finalizada"
4. Ativar/pausar e aguardar ciclos para ver transicao de etapa.

## Observacoes de seguranca

- Sem alteracao de credenciais/secrets.
- Mudanca focada em observabilidade operacional e UI.
- Sem exposicao de dados sensiveis nos novos textos de etapa.

## Itens para evitar duplicacao futura (palavras-chave)

- `runtimeStage-campanhas`
- `barra-etapa-disparos`
- `waiting_interval-outside_window`
- `disparos-campaign-runtime`
