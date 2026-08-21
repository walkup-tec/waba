# LOG — boas-vindas failover após 3 ACK ERROR

## Contexto

Após reconexão do 7770, implementar regra: após 3 ACK ERROR no número eleito, failover para secundário/terciário nas boas-vindas.

## Regra implementada

1. Boas-vindas continuam **priorizando 51981077770** (ignora pausa humana/Preparando).
2. Failover **imediato** se eleito **desconectado**.
3. **Novo:** após **3 ACK ERROR** no eleito → secundário → terciário (mesma fila padrão).
4. Contador persiste nos **retries em background** (reenvio admin).
5. Env var opcional: `WABA_WELCOME_ACK_FAILOVER_AFTER` (padrão 3).

## Arquivos

- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `scripts/verify-welcome-routing-rules.cjs`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-14-welcome-ack-failover-3`

## Validar

```bash
npm run build
npm run verify:welcome-routing
```

Redeploy EasyPanel + reenviar boas-vindas; após 3 ERROR no 7770 deve usar walkup (462102).

Nota pós-reconnect: instância Evolution do 7770 aparece como **`drax`** (open), não mais `drax-oficial`.

Palavras-chave: welcome, ack-failover, 7770, boas-vindas
