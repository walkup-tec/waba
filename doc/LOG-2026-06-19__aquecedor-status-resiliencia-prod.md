# LOG — Aquecedor status/diagnóstico resilientes (produção)

**Data:** 2026-06-19  
**Marker:** `DEPLOY-2026-06-19-aquecedor-status-resiliencia`

## Sintoma

Motor ligado → UI passa a **Aquecedor parado** + `Motor: erro ao consultar status`.  
Diagnóstico: `[HH:MM:SS] Diagnóstico: erro ao consultar.`

## Causas

1. Poll `/aquecedor/status` falha (timeout, 502, sessão) → UI **zerava cache** e mostrava parado mesmo com motor persistido ligado.
2. `/aquecedor/diagnostico` demorava >10s (EVO 8s + turn manager Supabase) → timeout no browser → catch genérico.
3. Diagnóstico/fila-localizar sem `credentials: "same-origin"` explícito.

## Correção

**API:** status sempre 200 com snapshot; reload disco debounced 2s; diagnóstico mais rápido (EVO 5s, pick combinação max 4s); lease worker 90s.

**UI:** stale-while-revalidate — se último estado era ativo, mantém UI em "ativo | atualizando status…"; diagnóstico timeout 25s; mensagens 401/timeout claras.
