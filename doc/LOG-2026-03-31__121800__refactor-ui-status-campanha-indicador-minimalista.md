# LOG — refactor-ui-status-campanha-indicador-minimalista

## Contexto do pedido

Após o primeiro ajuste visual dos status de campanha, foi solicitado refino de UX para remover aspecto "pesado" do sinal e deixar o componente mais limpo.

## Acoes executadas

- Reestilizado o indicador de status ao lado do nome da campanha para um visual minimalista.
- Mantido o mesmo mapeamento funcional de estados e cores previamente definido.
- Ajustado o estado `finished` para check azul mais discreto e integrado a paleta.

## Solucao implementada (passo a passo)

1. `draft`, `running` e `paused`:
   - trocar badge com icone por ponto solido pequeno;
   - manter cinza, verde e amarelo respectivamente;
   - adicionar halo sutil com `box-shadow` para legibilidade.
2. `finished`:
   - manter check azul;
   - reduzir peso visual do container;
   - preservar destaque sem competir com o nome da campanha.
3. Render:
   - remover simbolo `●` do HTML para os estados de ponto;
   - manter `✓` apenas em `finished`.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Como validar

1. Abrir Disparos > lista de campanhas.
2. Verificar ao lado do nome:
   - `draft`: ponto cinza
   - `running`: ponto verde
   - `paused`: ponto amarelo
   - `finished`: check azul
3. Confirmar visual mais discreto e consistente com os cards existentes.

## Observacoes de seguranca

- Mudanca somente de interface (CSS/renderizacao).
- Nenhuma alteracao em credenciais, dados sensiveis ou fluxo de negocio.

## Itens para evitar duplicacao futura (palavras-chave)

- `ui-minimalista-status-campanha`
- `disparos-campaign-status-dot`
- `check-azul-finalizada-refino`
