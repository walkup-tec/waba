# Campanha API Alternativa — fluxo preview → mapear → quantidade

## Contexto

Usuário pediu ordem correta na Seção 7 (Campanha): Prévia → Mapear coluna → Quantidade de envios → projeção de término → Salvar configurações (criação).

## Solução

1. **Etapas visuais** — após importar planilha: prévia; botão «Mapear coluna»; quantidade só após mapeamento confirmado; botão «Salvar configurações».
2. **Modal** — «Confirmar mapeamento» (não cria campanha).
3. **Projeção** — ao informar quantidade: ícone ⏱ + resumo + «Previsão de término» (instâncias × 300/dia + dias úteis do expediente); refinada via `/disparos/alternativa/estimate`.
4. **Backend** — `POST /disparos/campanhas` aceita `plannedSendCount` no multipart e limita leads enviados.

## Arquivos

- `index.html`
- `src/index.ts`

## Validar

1. Importar planilha → ver prévia.
2. Mapear coluna → aparece quantidade (Alternativa).
3. Digitar quantidade → projeção com cronômetro.
4. Salvar configurações → campanha criada com limite informado.

## Palavras-chave

campanha, evo, mapear coluna, plannedSendCount, projeção término
