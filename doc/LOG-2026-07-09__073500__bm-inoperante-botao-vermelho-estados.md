# BM inoperante — botão vermelho e estados Processando/Registrado

**Data:** 2026-07-09

## Pedido

- Botão **BM inoperante** na cor vermelha.
- Sem outro fornecedor na fila: mensagem **"Ok, aguardaremos até que a BM volte"**; botão → **Registrado** (inacessível).
- Com outro fornecedor: botão **Processando** → **Registrado** (inacessível); campanha reatribuída.

## Implementação

### Backend
- Campo `bmInoperanteRegisteredAt` no intake quando fila esgotada.
- `markBmInoperante` retorna `{ reassigned, exhausted, message, campaign }` em vez de erro 400 na fila vazia.
- `canBmInoperante` / `bmInoperanteRegistered` na API operacional.

### Frontend
- Classe `btn-bm-inoperante` (vermelho).
- Estados: BM inoperante → Processando → Registrado (disabled).
- Toast com mensagem do backend.

## Marker

`DEPLOY-2026-07-09-bm-inoperante-botao-vermelho-estados`

## Palavras-chave

`BM inoperante`, `btn-bm-inoperante`, `bmInoperanteRegisteredAt`, `op_jose`, operacional campanhas
