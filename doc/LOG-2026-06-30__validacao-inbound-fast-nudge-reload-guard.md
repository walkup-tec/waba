# LOG — Validação CONFIRMAR: nudge, detecção e bloqueio de reload

## Contexto

Wizard passo 3 ficava muito tempo aguardando CONFIRMAR. O overlay «ATUALIZANDO O SISTEMA» (deploy resilience) reiniciava a página no meio da validação e perdia o estado em memória.

## Solução

### Detecção (`instance-inbound-validation.service.ts`)

- `GET .../validacao-inbound/:id?nudge=1` → `refreshInboundValidation` força `findMessages` na Evolution.
- Keyword flexível; fallback `fromMe` relaxado; webhook unwrap `data`/`messages`.
- Poll backend 1s; reply 1s.

### Deploy overlay (`index.html` head)

- `isRegisterWizardBlockingDeploy()` via `sessionStorage waba.registerWizardActive`.
- Não inicia recovery nem reload enquanto wizard aberto; `waba.deployReloadPending` após concluir.

### UI

- Poll validação 800ms com `?nudge=1`.
- Lock wizard em `openRegisterModal`; flush reload em `close`/`finish`.

## Marker

`DEPLOY-2026-06-30-validacao-inbound-fast-nudge`

## Validar

1. Redeploy Easypanel.
2. Integrar → passo 3 → CONFIRMAR de outro WhatsApp → OK em ~1–3s.
3. Overlay de deploy não interrompe durante o modal.
