# LOG — Aquecedor mesh webhook + verify global v3

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-mesh-webhook-verify-v3`

## Contexto

Após deploy `aquecedor-mesh-evo-digits-scale`, teste mesh ainda falhava com 3 instâncias conectadas. findMessages filtrado por remoteJid não confirmava entrega (JID alternativo, @lid, timing EVO).

## Solução v3

1. **Service `aquecedor-mesh-validation.service.ts`** — sessão mesh + registro por marker; confirma par via webhook `MESSAGES_UPSERT` no destino.
2. **Webhook** — `handleAquecedorMeshWebhook` em `/webhooks/evolution`.
3. **Envio multi-formato** — `buildAquecedorSendNumberCandidates` tenta dígitos raw, `@s.whatsapp.net`, `1`, `55`.
4. **Verify em camadas** — webhook → busca global findMessages (sem remoteJid fixo, match por dígitos comparáveis + remoteJidAlt) → fallback findMessages filtrado.
5. **EVO cache** — números do cache sem forçar `55`; refresh live com aliases.
6. **Concorrência verify** — 2 paralelos (menos stress EVO); settle 5s.

## Arquivos

- `src/services/aquecedor-mesh-validation.service.ts` (novo)
- `src/index.ts`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Easypanel → marker v3 no `/health`.
2. Pausar → Iniciar Aquecedor (3 inst.).
3. Logs: `[Aquecedor] mesh bootstrap falhou` só se ainda falhar (com detalhe por par).

## Palavras-chave

mesh, webhook, findMessages global, sendNumberCandidates, aquecedor-mesh-validation
