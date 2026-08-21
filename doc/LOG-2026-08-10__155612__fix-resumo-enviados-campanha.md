# LOG — Resumo Enviados da campanha (API Alternativa)

## Contexto do pedido

No Disparos · API Alternativa, o indicador **Resumo → Enviados** mostrava `0` (“Total de envios finalizados”) mesmo com campanha pausada/em andamento. O esperado é refletir o total enviado da(s) campanha(s) listada(s) (mesmo `sentCount` do card).

## Sintoma / causa raiz

- **Sintoma:** `disparos-resumo-enviados` ficava em `0` para campanhas `paused` / `running`.
- **Causa:** `computeDisparosEnviadosFinalizados` só somava `sentCount` quando `status` era `completed` ou `finished`.
- **Confiança:** Alta (código local + diff vs `HEAD` em produção).

## Solução

1. **UI** (`index.html`): somar `sentCount` de todas as campanhas do escopo, sem filtrar por status finalizado; hint → “Total de envios realizados nas campanhas”.
2. **API** (`src/index.ts`): `countCampaignLeadsSent` — se houver leads em memória, contar `status === "sent"`; senão usar `sent_count`/`sentCount` persistido (lista `GET /disparos/campanhas` mais fiel ao runtime).
3. `dist/index.html` atualizado via `node scripts/copy-index-html.mjs`.

## Arquivos

- `index.html` / `dist/index.html`
- `src/index.ts`
- Espelho deploy: `D:\01A-Drax-Servidor\Waba-master-push\` (mesmas alterações)

## Como validar

1. Campanha Alternativa com `sentCount > 0` e status `paused` ou `running`.
2. Atualizar lista de campanhas.
3. Card: “N enviados”; Resumo → Enviados = soma dos `sentCount` das campanhas do escopo (não só finalizadas).

## Observações

- Se card e Resumo mostram `0`, o backend realmente reporta `sentCount: 0` (ainda não houve envio confirmado ou contador não persistiu).
- Deploy FTP + redeploy Node necessários para produção ver UI e API novas.
- Sem commit/push neste LOG (aguardar pedido do usuário).

## Palavras-chave

`resumo enviados`, `computeDisparosEnviadosFinalizados`, `sentCount`, `API Alternativa`, `campanha pausada`, `disparos-resumo-enviados`
