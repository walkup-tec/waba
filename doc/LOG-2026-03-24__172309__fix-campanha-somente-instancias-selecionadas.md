# Fix: disparos de campanha só com instâncias selecionadas no snapshot

## Problema

`pickDisparadorInstanceForConfig` tratava lista vazia em `selectedDisparadorInstances` como “usar todas as instâncias elegíveis” (`bySelection = true` quando não havia seleção).

## Comportamento esperado

Apenas instâncias listadas no **snapshot da campanha** (`configSnapshot.selectedDisparadorInstances`) podem enviar mensagens dessa campanha; é obrigatório haver pelo menos uma ao criar a campanha.

## Alterações

1. **`pickDisparadorInstanceForConfig`** (`src/index.ts`): se não houver nomes não vazios em `selectedDisparadorInstances`, retorna `null`. Caso contrário, filtra só instâncias **conectadas**, com **Disparador ativo** no mapa de uso **e** presentes no conjunto selecionado.

2. **POST `/disparos/campanhas`**: validação 400 se o snapshot não tiver ao menos uma instância selecionada.

3. **`createCampaignFromMappedSpreadsheet`** (`index.html`): mesma regra antes do POST (toast).

4. Log de erro no envio ajustado para deixar claro o critério.

## Campanhas antigas

Snapshots já salvos sem instâncias: o envio não escolhe instância (fica em retry silencioso até corrigir config ou recriar campanha).

## Palavras-chave

`pickDisparadorInstanceForConfig`, `selectedDisparadorInstances`, campanha disparador
