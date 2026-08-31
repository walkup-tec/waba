# Validação CONFIRMAR — instância nova 7943 / webhook instance objeto

## Contexto

Nova integração **5182007943** (`7943`) demorando para finalizar passo 3 (CONFIRMAR).

## Diagnóstico

| Item | Resultado |
|------|-----------|
| Instância EVO | `7943` — `open`, número `555182007943` |
| Deploy | `lid-findchats` em produção |
| `findChats` | **`[]` vazio** |
| `findMessages` | **0 records** (`_count.Message: 0`) |
| Webhook GET | `enabled=true`, URL WABA OK |

Instância **nova sem histórico** — polling `findMessages`/`findChats` **não encontra nada** até a Evolution indexar. Único caminho rápido: **webhook `MESSAGES_UPSERT`**.

### Bug webhook

Teste local de payloads Evolution v2:

- `instance: "7943"` (string) → **OK**
- `instance: { instanceName: "7943" }` → **FALHAVA** (`String(object)` = `[object Object]`)
- `instance: { name: "7943" }` → **FALHAVA**

Evolution envia `instance` como objeto → validação ignorava o webhook → usuário esperava minutos pelo index no banco.

## Solução

1. `normalizeWebhookInstanceRef` — extrai `instanceName`/`name` de objeto.
2. Webhook HTTP **202 imediato** + processamento async (`setImmediate`).
3. UI poll: `nudge=2` a cada 3 ticks, `nudge=1` nos pares.

Marker: `DEPLOY-2026-07-01-validacao-confirmar-webhook-instance-obj`

## Validar

1. Redeploy Easypanel + `/health` marker novo.
2. Nova conexão `7943` / 5182007943 → enviar CONFIRMAR → recepção em segundos.

## Palavras-chave

`5182007943`, `7943`, `instancia nova`, `webhook`, `instance object`, `findChats vazio`
