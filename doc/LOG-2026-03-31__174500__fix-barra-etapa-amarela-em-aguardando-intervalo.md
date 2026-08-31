# LOG — fix-barra-etapa-amarela-em-aguardando-intervalo

## Contexto do pedido

Foi identificado comportamento inconsistente: campanha com diagnostico indicando "aguardando intervalo" ainda aparecia com barra de etapa verde (como envio ativo).

## Acoes executadas

- Ajustado backend para expor `nextAllowedAt` na listagem de campanhas.
- Ajustado frontend para inferir `waiting_interval` quando houver cooldown ativo.
- Rebuild executado para garantir `dist/index.js` sincronizado.

## Solucao implementada (passo a passo)

1. `GET /disparos/campanhas`:
   - passou a retornar `nextAllowedAt` por campanha (ISO) com base em `campaignNextAllowedSendAt`.
2. UI da lista de campanhas:
   - fallback de etapa agora verifica `nextAllowedAt`;
   - se `status=running` e `nextAllowedAt > agora`, etapa vira `waiting_interval` (barra amarela);
   - legenda tambem muda para "Aguardando intervalo" com segundos restantes.
3. Build:
   - `npm run build` executado com sucesso para atualizar artefatos em `dist/`.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.html`
- `dist/index.js` (gerado pelo build)

## Como validar

1. Ativar campanha e aguardar um envio ocorrer.
2. Durante o cooldown entre envios:
   - a barra de etapa deve ficar amarela;
   - texto deve indicar "Aguardando intervalo".
3. Quando elegivel para disparar no ciclo:
   - barra volta para estado de envio.

## Observacoes de seguranca

- Nenhuma credencial/secreto foi adicionado ou exposto.
- Mudanca focada em observabilidade operacional.

## Itens para evitar duplicacao futura (palavras-chave)

- `waiting_interval-amarelo`
- `nextAllowedAt-campanhas`
- `runtimeStage-fallback-cooldown`
