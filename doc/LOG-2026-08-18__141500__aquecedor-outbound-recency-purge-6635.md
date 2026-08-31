# Fix: classificador outbound ignora ACK ERROR antigo + purge 6635

## Contexto do pedido

A instância `6635` (número 5181076635) estava `open` na Evolution, mas o aquecedor do Mozart não a usava. O usuário pediu para apagar todo resquício do número/instância, fazer push, e depois do deploy refazer o emparelhamento QR.

## Causa

O pool já tratava `connectionState` vazio como válido (`179e449`). A exclusão real era `filterAquecedorConnectedByOutboundHealth`: as últimas ~17 mensagens `fromMe` da `6635` (13–15/08, destino `walkup`) tinham `MessageUpdate=ERROR`. O classificador olhava as últimas 20 amostras **sem recorte de tempo**, então QR novo não bastava: o histórico ERROR continuava classificando `broken`.

Receber funcionava (1261→6635 chegou no celular). Enviar da sessão antiga falhava (probe 6635→1261: HTTP 201, ACK ERROR, não chegou).

## Solução implementada

1. `evaluateOutboundSamplePayload` / `collectFromMeAckStatusesFromPayload` só contam `fromMe` das últimas 12h (`AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS`). ERROR velho → `unknown` → permanece no pool. ERROR recente (≥3, sem ACK de progresso) continua `broken`. Cache de 10 min após send ERROR permanece.
2. Produção: `DELETE /admin/instances/6635` (EVO 200). Aliases `6035` / `51981076635` já inexistentes na EVO (404). `delete-by-phone` para 5181076635 / 555181076635. Supabase: linhas `controle_instancia` do chip; `uso_config` já vazio; fila `aquecedor` PENDENTE id 4725 removida. `connectionState/6635` = 404. Intactas: `walkup`, `1261`, `9224`.
3. Lifecycle JSON no disco do host (`aquecedor-instance-lifecycle`) não é apagado pelo purge (preserva `activatedAt` se recriar o mesmo nome). Histórico `aquecedor` com status ENVIADO foi mantido.

## Arquivos criados/alterados

- `src/aquecedor/outbound-ack-health.service.ts`
- `dist/aquecedor/outbound-ack-health.service.js`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`
- `scripts/test-aquecedor-outbound-recency.cjs`
- Este LOG e `doc/memoria.md`

## Como validar

- `GET /health` com marker `DEPLOY-2026-08-18-141500-aquecedor-outbound-recency`
- Após o usuário recriar/emparelhar o chip: Mozart `connectedSummary.names` inclui a nova instância
- Próximo ciclo: envio **a partir** dessa instância com ACK `DELIVERY_ACK`/`READ`, não `ERROR`
- `node scripts/test-aquecedor-outbound-recency.cjs` (local)

## Observações de segurança

- Sem novo `sendText`. Credenciais/admin não registradas neste LOG. Scripts `.tmp-purge-6635*.cjs` não vão para o Git.

## Palavras-chave

`6635` `5181076635` `555181076635` `outbound` `ERROR` `recency` `aquecedor` `purge` `emparelhamento`
