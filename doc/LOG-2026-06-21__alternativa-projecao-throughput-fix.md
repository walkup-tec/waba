# LOG — Projeção API Alternativa: texto e cálculo de término

## Problema

Na etapa **Quantidade de envios**, 100 envios com capacidade de **1.200/dia** (4 números) exibiam previsão de término distante (ex.: 29/06/2026), incompatível com a capacidade real.

Texto antigo: «Projeção: conclusão em até 1 dia útil…»

## Causas

1. **`estimateDisCampaignCompletionBr`** avançava N **dias úteis inteiros** a partir de amanhã, ignorando que 100 envios cabem em **~1 hora** de throughput (1200 envios / 14h de expediente).
2. Respostas da API podiam usar **`activatedCount`** baixo enquanto a UI mostrava 4 números do Aquecedor — subestimando capacidade no servidor.
3. Possível **race** entre chamadas `/disparos/alternativa/estimate` com quantidades diferentes.

## Solução

1. **`estimateAlternativaCampaignCompletionAt`** (`alternativa-dispatch-rules.ts`) — distribui envios pelas janelas de expediente (startHour/endHour, dias úteis) em **horas**, não dias inteiros.
2. **Novo texto:**
   - `Sua capacidade de envio hoje é de X envios/dia, considerando N número(s).`
   - `Previsão de término: dd/mm/aaaa, hh:mm`
3. **API** usa `max(activatedCount, selectedDisparadorInstances.length)` + expediente do config.
4. **Cliente** espelha algoritmo + `disCampaignProjectionSeq` anti-race.

## Arquivos

- `src/disparos/alternativa-dispatch-rules.ts`
- `src/index.ts`
- `index.html`

## Validar

1. 100 envios, 4 números, expediente 8h–22h → término no **mesmo dia útil** ou no **próximo** (horas, não semanas).
2. 5000 envios → vários dias úteis proporcionais a 1200/dia.
3. Texto sem «Projeção: conclusão em até 1 dia útil».

## Palavras-chave

`plannedSendCount`, `alternativa estimate`, `throughput`, `previsão término`, `1200 envios/dia`
