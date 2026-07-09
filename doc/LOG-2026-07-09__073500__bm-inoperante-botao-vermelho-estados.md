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

## Comportamento confirmado (ajuste 2026-07-09)

- Após **Registrado**, modal **fecha** nos dois cenários (reatribuída ou último da fila).
- **Reatribuída:** campanha some da fila do operacional que registrou (filtro `matchesAssignedOperacional`).
- **Último da fila:** campanha permanece com o operacional; alerta master após **30h** via `processDueReassignments` / `maybeSendMasterOverdueAlert` (regra existente).

`BM inoperante`, `btn-bm-inoperante`, `bmInoperanteRegisteredAt`, `op_jose`, operacional campanhas
