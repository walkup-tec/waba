# LOG — OG wabadisparos DEFINITIVO (código-fonte)

**Data:** 2026-07-07 ~10:55 UTC

## Problema

Compartilhamento da wabadisparos.com.br mostrava **favicon** em vez da imagem.
Causa raiz: `og:image` era injetado só via **patch runtime** no container SSR (`router-*.mjs`).
Todo redeploy/restart do `waba_paginadevendas` apagava o patch → voltava favicon.
Além disso, a imagem `OGwaba.jpg` não estava publicada no domínio (404) → scraper cai no favicon.

## Solução definitiva (no código-fonte da landing)

Repo: `walkup-tec/pv-waba-disparador` (branch `main`) — fonte local `D:\pv-waba-disparador`.
Commit: `854b19d` — "feat: OG share image OGwaba.jpg + meta DRAX WABA (definitivo)".

Mudanças:
1. `public/OGwaba.jpg` (~207 KB, 1200×630 servível) — imagem autocontida.
   TanStack/Nitro serve `public/` na raiz → `https://wabadisparos.com.br/OGwaba.jpg`.
2. `src/routes/__root.tsx` — meta OG/Twitter:
   - og:site_name "DRAX WABA", og:url https://wabadisparos.com.br/
   - og:title / twitter:title "DRAX WABA - Plataforma Oficial de Disparos WhatsApp"
   - og:description / twitter:description (API Oficial e Alternativa)
   - og:image / og:image:secure_url / twitter:image → https://wabadisparos.com.br/OGwaba.jpg
   - og:image:type image/jpeg, width 1200, height 630, alt

## Por que é definitivo

- Imagem e meta agora fazem parte do **build** (Dockerfile `COPY . .` + `npm run build` → `.output/public`).
- Sobrevive a restart e redeploy. Não depende de patch no container nem do waba_disparador.

## Falta fazer (usuário)

1. **Redeploy** do serviço `paginadevendas` no Easypanel (rebuild do commit `854b19d`).
2. Validar:
   - `curl -I https://wabadisparos.com.br/OGwaba.jpg` → 200 image/jpeg
   - `curl -sS https://wabadisparos.com.br/ | grep og:image`
3. Facebook Sharing Debugger → Scrape Again:
   https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwabadisparos.com.br%2F

## Observações

- Após o redeploy, os scripts de patch runtime (`deploy-paginadevendas-og-vps.sh`, `og-wabadisparos-safe-vps.sh`) ficam desnecessários — manter só como emergência.
- `git stash` usado para preservar WIP local (components/landing, waba-api.ts) durante rebase; restaurado com sucesso.
