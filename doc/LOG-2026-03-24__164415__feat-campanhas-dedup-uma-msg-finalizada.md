# Log: campanhas — deduplicar destinos, 1 mensagem por número, finalização

## Contexto

Garantir que cada número da lista importada receba no máximo **uma** mensagem, **eliminar duplicatas** na importação (planilha e JSON) e considerar a campanha **finalizada** depois que todos os destinos foram processados (envio com sucesso ou falha registrada), sem reativar campanha concluída.

## Implementação

1. **`deduplicateCampaignDestinationPhones`** (`src/index.ts`): normaliza com `normalizeCampaignPhone`, ignora dígitos curtos (&lt;12), mantém ordem da primeira ocorrência, contabiliza `removedDuplicates`.

2. **`extractNumbersFromXlsxBuffer`**: retorna `{ phones, removedDuplicates }` via a função acima (substitui `Set` isolado).

3. **POST `/disparos/campanhas`**: fluxo multipart e JSON passam pela deduplicação; resposta inclui `duplicatesRemoved` e mensagem explicativa quando &gt; 0.

4. **Finalização** (já existente): `processOneCampaignDispatch` sem lead `pending` marca `finished` no Postgres. **Novo:** POST `/disparos/campanhas/:id/estado` com `ativa: true` retorna **409** se a campanha já está `finished`.

5. **Lista GET `/disparos/campanhas`**: `progressPercent` e novo campo **`processedCount`** (enviado + falha, sem pendente) via `countCampaignLeadsProcessed`; barra e cópia na UI refletem conclusão mesmo com falhas parciais.

6. **UI** (`index.html`): texto de criação da campanha menciona números únicos e duplicatas ignoradas; card da campanha mostra `processados · enviados`; campanha `finished` desativa o botão de ativar com legenda "Campanha finalizada".

## Arquivos alterados

- `src/index.ts`
- `index.html`

## Como validar

- Importar planilha com o mesmo telefone em várias linhas → total da campanha = únicos; toast/status mostra duplicatas removidas.
- Rodar campanha até o fim → status `finished`, progresso 100%, botão de ativar desabilitado; tentar reativar via API → 409.
- Verificar um destino na fila: apenas um lead por número normalizado.

## Palavras-chave

`deduplicateCampaignDestinationPhones`, `processedCount`, `progressPercentForCampaignListItem`, `countCampaignLeadsProcessed`, campanha finalizada, duplicatesRemoved
