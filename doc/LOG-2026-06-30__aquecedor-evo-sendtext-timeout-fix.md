# LOG — Aquecedor: HTTP 0 timeout no sendText EVO

**Data:** 2026-06-30  
**Sintoma (mozart.pmo@gmail.com):**  
`Motor: ativo | processamento: sim | Falha no envio via EVO (HTTP 0) (timeout). Mensagem voltou para pendente.`

## Causa raiz

1. **`callEvoSendTextWithRetry`** usava timeout padrão **45s** (`EVO_HTTP_TIMEOUT_MS`) — o endpoint `message/sendText` da Evolution frequentemente demora mais (WhatsApp + fila interna).
2. Retries não tratavam **`status === 0`** de forma explícita e `callEvoAction` rodava só **1 tentativa** por ciclo externo.
3. Instâncias **desconectadas** na Evolution (cache/listagem ainda “open”) geravam hang até timeout em vez de mensagem clara de reconexão.

## Correção

### `src/evo-http.client.ts`
- `defaultEvoSendTextTimeoutMs()` — padrão **90s** (`EVO_SEND_TEXT_TIMEOUT_MS`).

### `src/index.ts`
- `callEvoSendTextWithRetry`: timeout 90s, `retries: 2` por tentativa, `status === 0` + erros de rede como transientes.
- `assertAquecedorInstancesOpenForSend`: checa `connectionState` origem/destino **antes** de marcar fila como PROCESSANDO.
- Retry backoff 180s quando HTTP 0 (rede/timeout).
- Log startup inclui `sendTextTimeoutMs`.

### Deploy marker
`DEPLOY-2026-06-30-aquecedor-evo-sendtext-timeout-fix`

## Arquivos alterados
- `src/evo-http.client.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `.env.example`

## Como validar

1. Deploy Easypanel / FTP com marker acima.
2. Login mozart → Aquecedor → parar/iniciar motor.
3. Se instância desconectada: mensagem deve citar reconexão (não só timeout genérico).
4. Com 2+ instâncias open: envio deve completar ou falhar com detalhe EVO (não HTTP 0 após ~45s).

## Opcional no servidor
```env
EVO_SEND_TEXT_TIMEOUT_MS=120000
```

## Palavras-chave
aquecedor, sendText, HTTP 0, timeout, Evolution, mozart, connectionState, EVO_SEND_TEXT_TIMEOUT_MS
