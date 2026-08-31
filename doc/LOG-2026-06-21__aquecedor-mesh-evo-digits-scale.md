# LOG — Aquecedor mesh: dígitos EVO + escala hub-spoke

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-mesh-evo-digits-scale`

## Contexto

Teste de comunicação mesh no start do Aquecedor falhava com 3 instâncias conectadas (`drax`, `walkup`, `soma`). UI vermelha já estava OK; a causa raiz era lógica backend:

1. **Normalização errada de números** — `normalizeWhatsAppNumber` forçava prefixo `55` em qualquer número de 10–11 dígitos (ex.: `5181076973` → `555181076973`), corrompendo envio e `findMessages`.
2. **Mesh O(N²) lento** — com muitas instâncias o bootstrap demoraria minutos (N×(N−1) pares + verify sequencial pesado).

## Solução

### 1. Dígitos canônicos EVO (`resolveAquecedorInstanceDigits`)

- Usa prefixo do `ownerJid` sem forçar DDI Brasil.
- Aplicado em: mesh send/verify, ciclo aquecedor, `buildAquecedorRemoteJidCandidates`, gravação `numero_destino`.

### 2. JID candidates ampliados

- Raw EVO + variantes `1`, `55`, sufixo 10 dígitos + legado BR (compat).

### 3. Mesh escalável

| Instâncias | Modo | Pares |
|------------|------|-------|
| 2–6 | `full` (todas↔todas) | N×(N−1) |
| 7+ | `hub-spoke` | 2×(N−1) via hub alfabético |

### 4. Verify mais rápido no bootstrap

- Settle 3,5s (antes 5s); gap envio 700ms; 5 tentativas × 2s; pool verify concorrência 8; última tentativa sem filtro timestamp.

### 5. ETA na API/UI

- `meshBootstrap.estimatedDurationSeconds`, `mode`, `hubInstance` expostos no status; barra/hero mostram tempo estimado.

## Arquivos alterados

- `src/index.ts` — helpers, mesh plan, verify, ciclo
- `src/deploy-marker.ts`
- `index.html` — progresso/hero com ETA
- `dist/` — build local

## Como validar

1. Redeploy Easypanel (`master` após push).
2. `GET /health` → marker `DEPLOY-2026-06-21-aquecedor-mesh-evo-digits-scale`.
3. Pausar e iniciar Aquecedor com 3 instâncias conectadas.
4. Esperar ~20–25s: mensagem verde *"Todas as 3 instâncias estão funcionando…"*.
5. Com 7+ instâncias: modo hub-spoke na UI e ~40–50s estimados (vs minutos no mesh completo).

## Tempo estimado (referência)

| N | Modo | Pares | ~ETA |
|---|------|-------|------|
| 3 | full | 6 | ~22s |
| 5 | full | 20 | ~28s |
| 10 | hub-spoke | 18 | ~35s |
| 20 | hub-spoke | 38 | ~45s |
| 50 | hub-spoke | 98 | ~55s |

## Segurança

- Sem segredos no código; números vêm da EVO live refresh.

## Palavras-chave

`aquecedor`, `mesh`, `resolveAquecedorInstanceDigits`, `hub-spoke`, `findMessages`, `ownerJid`, `estimatedDurationSeconds`
