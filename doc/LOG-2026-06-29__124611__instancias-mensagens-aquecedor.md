# Coluna Mensagens = total aquecedor (enviadas + recebidas)

## Contexto

Na aba **Instâncias**, a coluna **Mensagens** exibia o contador acumulado da Evolution API (`messages`/`messagesCount`), incluindo todo o histórico WhatsApp — não refletia o uso do aquecedor WABA.

Pedido: mostrar **enviadas + recebidas** pelo aquecedor, somente mensagens confirmadas quando a EVO rodou no ciclo do aquecedor.

## Solução

1. **Serviço** `src/services/aquecedor-instance-message-stats.service.ts`
   - Agrega por instância: `sent` (como `instancia_origem`), `received` (como `instancia_destino`), `total = sent + received`.
   - Fonte primária: Supabase `logs_envios` (paginação até 120k linhas).
   - Fallback sem Supabase: `aquecedor-envios-log.json` (apenas `Envio com Sucesso`).
   - Resolve aliases (`instance-aliases.json`) para nomes canônicos.
   - Cache 45s por dono + lista de instâncias.

2. **API** `src/index.ts`
   - `attachAquecedorMessageStatsToInstanceItems()` enriquece itens com `aquecedorMessagesSent`, `aquecedorMessagesReceived` e substitui `messages` pelo total aquecedor.
   - Integrado em `buildInstancesSnapshotForAuth` (cache) e `GET /instancias?refresh=1`.

3. **UI** `index.html`
   - Tooltip no cabeçalho e na célula: enviadas · recebidas (aquecedor).
   - `buildOrderedInstancesBase` prioriza stats aquecedor quando presentes na API.

## Arquivos alterados

- `src/services/aquecedor-instance-message-stats.service.ts` (novo)
- `src/index.ts`
- `index.html` / `dist/index.html` (via build)

## Como validar

1. `npm run build`
2. Login com instâncias no aquecedor; abrir aba Instâncias.
3. Comparar totais com `logs_envios` no Supabase (origem + destino por instância).
4. Hover na coluna Mensagens deve mostrar enviadas/recebidas separadas.

## Segurança

- Usa `SERVICE_ROLE_KEY` apenas no backend; frontend recebe apenas contadores agregados.

## Palavras-chave

`instancias`, `mensagens`, `aquecedor`, `logs_envios`, `enviadas`, `recebidas`, `coluna-mensagens`
