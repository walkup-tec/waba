# LOG — Aquecedor: conversa bilateral + auto-instâncias

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-reply-turn-sync`

## Solicitação

1. Drax enviou para Soma (09:45 e 09:59) sem resposta de Soma — conversa unilateral.
2. Duas novas instâncias integradas não entraram automaticamente no ciclo do aquecedor.

## Causas identificadas

- Turn manager podia bloquear a **resposta obrigatória** (regra global “só envia após receber”) mesmo quando o par exigia B→A.
- Eventos `aquecedor`/`numero_destino` podiam falhar no mapa de números (formato 55 vs sufixo) → turno não via o 1º envio → permitia 2º envio unilateral.
- Probe de integração/inbound com `restrictionSuspected` desligava `use_aquecedor` junto com disparador.
- Instâncias novas sem linha em `instancias_uso_config` dependiam só do default implícito; registro não garantia upsert.

## Alterações

- `owesPairReply` + prioridade exclusiva no `pickAquecedorCombinationAsync` (resposta pendente antes de qualquer outro par).
- `canSendDirected`: resposta no par libera envio mesmo com bloqueio global.
- `resolveAquecedorInstanceByNumber`: match por sufixo (10 dígitos BR).
- `loadAquecedorExchangeEvents`: busca global ENVIADO + filtro por instâncias conectadas.
- `syncAquecedorConnectedInstances` a cada ciclo; `ensureAquecedorInstanceRegistered` no `registrar-qrcode`.
- Probe inbound/integração: mantém `use_aquecedor`, desliga só `use_disparador`.

## Arquivos

- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/` (build local)

## Validação

```bash
cd D:\Waba
npm run build   # OK
```

## Pós-deploy

1. Easypanel redeploy `waba_disparador`.
2. `GET /health` → `deployMarker: DEPLOY-2026-06-20-aquecedor-reply-turn-sync`.
3. Reiniciar aquecedor no painel; confirmar Drax→Soma seguido de Soma→Drax nos logs.

## Pendências

- Commit/push Easypanel (usuário não pediu nesta sessão).
- Instâncias já com `use_aquecedor=false` no Supabase: reativar no painel ou apagar linha em `instancias_uso_config`.
