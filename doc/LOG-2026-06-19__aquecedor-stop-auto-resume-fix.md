# LOG — Fix Pausar Aquecedor (auto-resume)

**Data:** 2026-06-19  
**Marker:** `DEPLOY-2026-06-19-aquecedor-stop-fix`

## Sintoma

Ao clicar **Pausar Aquecedor**, logs mostravam stop + imediato `Motor retomado automaticamente (sessão anterior)` — motor voltava a ativo.

## Causa

1. `persistAquecedorRuntimeIntent(false)` era `void` (async) — `/aquecedor/status` lia intent antigo (`desired: true`) antes do arquivo gravar.
2. Polling a cada 3s chamava `syncAquecedorRuntimeUi({ autoResume: true })` — relia intent stale e disparava `/aquecedor/start` de novo.

## Correção

**API (`src/index.ts`):**
- Cache em memória do runtime-intent (atualizado antes do disco)
- `await persistAquecedorRuntimeIntent` em start/stop

**UI (`index.html`):**
- Polling usa `autoResume: false`
- Auto-resume só na abertura da aba / boot (`resumeAquecedorRuntimeFromPersistedIntent`)
- Após stop: UI otimista + sync sem auto-resume
