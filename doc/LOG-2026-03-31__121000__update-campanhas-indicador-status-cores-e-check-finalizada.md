# LOG — update-campanhas-indicador-status-cores-e-check-finalizada

## Contexto do pedido

Ajustar o indicador visual ao lado do nome da campanha na lista de campanhas do Disparador, com mapeamento fixo:

- `draft` (rascunho): cinza
- `running` (enviando): verde
- `paused` (pausada): amarelo
- `finished` (finalizada): icone de check azul alinhado a paleta atual

## Acoes executadas

- Localizado o render da lista de campanhas no frontend.
- Criado indicador de status ao lado do nome da campanha.
- Aplicado estilo por estado com classes CSS dedicadas.
- Mantida a mesma regra funcional de ativar/pausar/finalizar (apenas ajuste visual).

## Solucao implementada (passo a passo)

1. Adicionadas classes CSS para o bloco de titulo e para o badge circular de status:
   - `.disparos-campaign-title`
   - `.disparos-campaign-status`
   - Variantes:
     - `.disparos-campaign-status--draft`
     - `.disparos-campaign-status--running`
     - `.disparos-campaign-status--paused`
     - `.disparos-campaign-status--finished`
2. No loop de render da lista de campanhas, criado `statusUi` a partir de `statusRaw`:
   - `running` => verde com icone `●` e title "Enviando"
   - `paused` => amarelo com icone `●` e title "Pausada"
   - `finished` => azul com icone `✓` e title "Finalizada"
   - fallback (`draft`) => cinza com icone `●` e title "Rascunho"
3. Atualizado HTML do titulo para renderizar o nome da campanha + sinal ao lado com `aria-label` do status.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Como validar

1. Abrir aba Disparos e a lista de campanhas.
2. Conferir o indicador ao lado do nome em cada estado:
   - `draft`: cinza
   - `running`: verde
   - `paused`: amarelo
   - `finished`: check azul
3. Validar tooltip/atributo de acessibilidade ao passar o mouse (title do status).

## Observacoes de seguranca

- Nenhum segredo, token ou credencial foi adicionado/exposto.
- Mudanca restrita a UI (estilo e render), sem impacto em autenticacao ou dados sensiveis.

## Itens para evitar duplicacao futura (palavras-chave)

- `status-campanha-indicador`
- `disparos-campaign-status`
- `draft-running-paused-finished`
- `check-azul-finalizada`
