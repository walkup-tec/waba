# Fix: card Instância ativa alinhado à seleção da UI (Disparos)

## Problema

O card **Instância ativa** chamava `GET /disparos/next-instance`, que usava só `loadDisparosConfigFromDb()`. A lista **Números selecionados para disparo** pode divergir da config salva (ex.: SOMA na base, só DC na tela), exibindo instância fora da seleção atual.

## Solução

1. **`GET /disparos/next-instance`** (`src/index.ts`):
   - Query opcional `instances` (nomes técnicos separados por vírgula). Se presente, o conjunto permitido vem **só** dessa lista (interseção com conectadas + uso Disparador). Se ausente, mantém comportamento anterior (config persistida).
   - Query `preview=1` ou `preview=true`: **não** incrementa `disparosRoundRobinCounter` (adequado ao card/preview sem consumir passo de round-robin).

2. **Cliente** (`index.html`):
   - `disparosNextInstanceQueryFromUiSelection()` monta `?preview=1&instances=...` a partir de `#dis-selected-instances` (quando vazio, só `preview=1` → servidor usa config do banco como antes).
   - `moveDisparadorNumbers` / `moveSingleDisparadorNumberByClick` disparam refresh do card.
   - `syncDisparadorNumberPicker`: na aba Disparos chama `refreshDisparosActiveInstanceFromServer`; nas outras, só `refreshDisparosActiveInstanceCardLabelOnly`.

## Validação

Selecionar só instâncias DC; card deve mostrar apenas uma das DC conectadas, nunca SOMA se SOMA não estiver na lista selecionada. Salvar config continua recomendado para campanhas/BE.

## Palavras-chave

`next-instance`, `instances`, `preview`, `dis-selected-instances`, `disparos-instancia-ativa`
