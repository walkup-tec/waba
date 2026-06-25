# LOG — Aquecedor: duplo clique em Iniciar

**Sintoma:** Clicar «Iniciar Aquecedor» às vezes volta ao estado parado; segundo clique funciona.

## Causa

1. **UI:** após `POST /start`, `syncAquecedorRuntimeUi` imediato + poll 3s lia status stale (`running: false`) e revertia botões.
2. **Backend:** `reload` do `runtime-intent.json` podia sobrescrever bundle em memória com disco antigo durante gravação; leadership parava motor se `snapshot.running` false com `desired` true; status `running` exigia flag no snapshot sem considerar lease do worker.

## Correção

**Backend (`src/index.ts`):**
- Persistir intent **antes** de `startAquecedorRuntimeLocal`; resposta com `buildLiveAquecedorStatusPayload`.
- `running` no status = `desired` + (`snapshot.running` ou worker lease válido).
- Leadership só para se `desired !== true` (não exige `snapshot.running`).
- Reload ignora disco mais antigo que última gravação local (`savedAt`).

**Frontend (`index.html`):**
- Pin de UI 15s após start/stop (`aquecedorRuntimeUiPin`).
- Sync após start atrasado 2,5s; poll respeita pin até servidor confirmar.

## Marker

`DEPLOY-2026-06-24-aquecedor-start-double-click-fix`

## Validar

1. Iniciar uma vez → permanece «Pausar Aquecedor» após polls.
2. Refresh com motor ligado → retoma sem segundo clique.

## Palavras-chave

`aquecedor start`, `runtime-intent`, `double click`, `ui pin`, `worker lease`
