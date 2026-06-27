# LOG — Overlay deploy: modal antigo no dev local

## Contexto

Modal antigo ("Atualizando serviços", ícone nuvem, dots) aparecia durante trabalho local, embora a regra fosse exibir overlay de deploy **somente em produção** (Easypanel).

## Causas

1. **`npm run dev`** usa `RUNTIME_MODE=production` por padrão e servia **`dist/index.html` desatualizado** (overlay antigo), não o `index.html` raiz já simplificado.
2. **`isDeployResilienceEnabled()`** dependia só do hostname (`*.draxsistemas.com.br`) — insuficiente se hosts/proxy apontasse domínio de produção para local.
3. **Service worker** (`waba-deploy-shell-*`) podia manter shell antiga em cache no browser.

## Solução

1. **`resolveDeployResilienceForClient()`** (`src/base-path.ts`):
   - `false` em `RUNTIME_MODE=development`, `WABA_ENV=v01|v02`, ou servidor ts-node (`*.ts`).
   - `true` só em runtime compilado (`node dist/index.js`) com `RUNTIME_MODE=production`.
   - Override explícito: `WABA_DEPLOY_RESILIENCE=1|0`.

2. **Injeção no HTML:** `window.WABA_DEPLOY_RESILIENCE_ENABLED=true|false` via `injectRuntimeIntoIndexHtml`.

3. **Cliente (`index.html`):**
   - `isDeployResilienceEnabled()` = flag servidor **e** `isProductionDeployHost()`.
   - `purgeDeployServiceWorkerCache()` quando resiliência desabilitada.

4. **Dev local:** `resolveIndexHtmlPath()` / `loadIndexHtmlTemplate()` usam **`index.html` raiz** quando o processo é ts-node (`isTsNodeDevServer()`).

5. **`npm run build`** — sincroniza `dist/index.html` com overlay novo.

## Arquivos alterados

- `src/base-path.ts`
- `src/index.ts`
- `index.html`
- `dist/index.html` (via build)

## Como validar

1. `npm run dev` → abrir `http://localhost:3000` → reiniciar Node → **sem overlay**.
2. Hard refresh (Ctrl+Shift+R) se ainda vir modal antigo (limpar SW/cache).
3. Easypanel em `*.draxsistemas.com.br` durante redeploy → overlay novo + poll até `/health` OK.
4. Resposta HTML deve conter `window.WABA_DEPLOY_RESILIENCE_ENABLED=false` em dev local.

## Palavras-chave

`deploy overlay`, `localhost`, `WABA_DEPLOY_RESILIENCE_ENABLED`, `dist/index.html`, `service worker`, `ts-node`
