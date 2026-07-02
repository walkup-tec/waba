# LOG — Aquecedor isolado por usuário (fix cross-tenant)

**Data:** 2026-07-02  
**Contexto:** Pausar/ativar o aquecedor em `walkup@walkuptec.com.br` afetava `mozart.pmo@gmail.com`. Motores devem ser independentes.

## Causa raiz

- Um único motor global (`aquecedorRuntime` + `runtime-intent.json` v2 com um `aquecedorOwnerEmail`).
- `POST /aquecedor/stop` sem escopo de proprietário.
- `GET /aquecedor/status` retornava estado global para qualquer sessão.
- UI fazia auto-resume com base no estado global.

## Solução

1. **`src/services/aquecedor-owner-runtime.registry.ts`**
   - Persistência **v3**: `owners: { [email]: { desired, snapshot } }` (migra v1/v2 automaticamente).
   - Map em memória: um motor (runtime + timer) por e-mail.
   - Motores podem rodar em paralelo (cada um só aquece instâncias do seu escopo).

2. **`src/index.ts`**
   - `runAquecedorCycle(ownerEmail, …)` com contexto por proprietário.
   - `POST /aquecedor/start|stop` vinculados à sessão.
   - `GET /aquecedor/status` retorna só o motor do usuário logado (`motorOwnedByMe`).
   - `stopAllDispatchActivityOnServer(ownerEmail)` para parar só o aquecedor do solicitante.

3. **`index.html`**
   - Auto-resume só quando `motorOwnedByMe !== false`.

4. **Marker:** `DEPLOY-2026-07-02-aquecedor-isolamento-por-usuario`

## Como validar

1. Login walkup → iniciar aquecedor → status ativo.
2. Login mozart (outra sessão/navegador) → status parado (se mozart não iniciou).
3. Mozart inicia/pausa → não altera UI do walkup.
4. `GET /health` → marker novo após deploy.

## Palavras-chave

`aquecedor`, `runtime-intent`, `isolamento`, `multi-tenant`, `ownerEmail`, `motorOwnedByMe`
