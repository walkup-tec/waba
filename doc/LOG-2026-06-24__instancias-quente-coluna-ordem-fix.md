# LOG — Fix ordem coluna Quente (Instâncias)

## Contexto

Usuário reportou coluna **Quente** na posição errada na tabela Instâncias (estava após Mensagens; referência V02 coloca como **primeira coluna**).

## Solução

- `index.html`: thead e tbody — **Quente** antes do avatar e Número (paridade com `Waba-master/dist`).
- Marker: `DEPLOY-2026-06-24-instancias-quente-coluna-ordem`

## Validar

Aba Instâncias → ordem: **Quente | avatar | Número | … | Mensagens | Aquecedor | …**
