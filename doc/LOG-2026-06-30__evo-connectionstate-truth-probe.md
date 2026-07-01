# LOG — EVO connectionState vs fetchInstances (envio teste / aquecedor)

**Data:** 2026-06-30  
**Sintoma:** Envio teste `digital-corban-2477 → soma` falha; aquecedor HTTP 0 timeout; campanhas Alternativa em risco.

## Diagnóstico com prova (sem achismo)

Probe executado: `node scripts/run-evo-integration-probe.cjs` (EVO pública Easypanel).

| Métrica | Valor |
|---------|-------|
| fetchInstances `open` | **7** |
| connectionState `open` (live) | **0** |
| sendText test | **não executado** (precisa ≥2 live-open) |

Instâncias com **fetch=open** mas **live=connecting**: `7943`, `digital-corban-2477`, `soma`, `walkup`, `drax-oficial`, `final-1267`, `6841`.

`POST /message/sendText/*` → socket hang up / HTTP 0 (Evolution Baileys não envia enquanto `connecting`).

Produção WABA ainda em marker antigo (`DEPLOY-2026-06-21-exclusao-instancia-tombstone-fix`) — fixes anteriores não deployados.

## Causa raiz

1. **Evolution:** sessões WhatsApp presas em `connecting` (desync com `fetchInstances.connectionStatus=open`).
2. **WABA (bug):** motor/aquecedor/disparos confiavam só em `fetchInstances` → tentavam enviar para instâncias não prontas → timeout HTTP 0.

## Correção implementada (local, **sem commit** — aguardando probe OK)

- `src/instances/evo-connection-state.service.ts` — fonte de verdade `connectionState`
- `src/services/evo-integration-probe.service.ts` — send + findMessages end-to-end
- `GET /service/evo-integration-probe` — diagnóstico operacional
- Aquecedor/disparos filtram só instâncias `connectionState=open`
- Envio teste aborta com mensagem clara (não timeout genérico)
- `scripts/run-evo-integration-probe.cjs`

Marker: `DEPLOY-2026-06-30-evo-connectionstate-truth-probe`

## Ação infra (obrigatória para envio voltar)

1. **Easypanel/VPS:** reiniciar serviço **`walkup_evo-walkup-api`** (Evolution).
2. Reconectar QR nas instâncias que permanecerem `connecting` (ex.: `soma`, `digital-corban-2477`).
3. Validar: `node scripts/run-evo-integration-probe.cjs` → `ok: true`, `liveOpenCount >= 2`.
4. Só então: commit + push + deploy WABA.

## Comandos

```bash
npm run build
EVO_API_URL=https://walkup-evo-walkup-api.achpyp.easypanel.host EVO_TLS_INSECURE=1 node scripts/run-evo-integration-probe.cjs
curl https://waba.draxsistemas.com.br/service/evo-integration-probe
```

## Palavras-chave

connectionState, fetchInstances, ghost open, sendText, aquecedor envio teste, digital-corban-2477, soma, Evolution connecting
