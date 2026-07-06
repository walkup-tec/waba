# LOG — V01 Disparador EVO reativado

**Data:** 2026-06-19  
**Pedido:** Disponibilizar novamente o Disparador/Campanhas via Evolution (EVO) **somente no ambiente V01**.

## Alterações

### Código (`src/index.ts`)
- `ENABLE_BACKGROUND_PROCESSING` no V01 usa `WABA_EVO_DISPARADOR` (default `true`), independente do V02/produção.
- Log de startup: `[campanhas] Disparador EVO ativo (ambiente v01 — tick a cada 7s).`

### Config
- `.env.v01` / `.env.v01.example`: `WABA_UI_PROFILE=full`, `WABA_EVO_DISPARADOR=true`, `ENABLE_BACKGROUND_PROCESSING=true`
- `scripts/dev-v01.ps1`: mensagem de boot atualizada

### Dados V01 (gitignored)
- Restaurado `data/v01/disparos-local-state.json` (4 campanhas do backup raiz)
- Copiado `data/v01/instance-aliases.json`

## Validação

- `GET /version-01/health` → `wabaEnv:v01`, `uiProfile:full`, `backgroundProcessing:true`
- Boot: 4 campanhas carregadas de `data/v01/disparos-local-state.json`
- Menu: **Aquecedor → Disparos** (`profile: full`, visível só com UI full)

## Uso

1. `npm run dev:v01`
2. http://localhost:3011/version-01/
3. Configurar EVO no `.env.v01` (`EVO_API_URL`, `EVO_API_KEY`, …)

## Pendências

- EVO local em `127.0.0.1:8081` não está rodando (ECONNREFUSED) — necessário para instâncias/QR/disparo real.
