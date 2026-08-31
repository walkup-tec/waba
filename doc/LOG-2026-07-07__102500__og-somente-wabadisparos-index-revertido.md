# LOG — OG apenas em wabadisparos; index waba revertido

**Data:** 2026-07-07 ~10:25 UTC

## Contexto

- Usuário aplicou OG novo no `index.html` do app waba.draxsistemas por engano.
- Correção: reverter `index.html`/`dist/index.html` ao original (compBoasvindasV3, títulos DRAX-WABA).
- Config OG (título/descrição/imagem/1200×630) deve valer **apenas** na landing wabadisparos.com.br (SSR).
- Site wabadisparos voltou do 502 (confirmado no ar).

## Config OG wabadisparos (SSR)

- `og:image` → `https://waba.draxsistemas.com.br/media/OGwaba.jpg`
- `og:image:width/height` → 1200 / 630
- `og:title` / `twitter:title` → "DRAX WABA - Plataforma Oficial de Disparos WhatsApp"
- `og:description` → "Envie mensagens em massa ... gestão de campanhas."
- `twitter:description` → "Envie mensagens em massa ... API Alternativa."

## Arquivos

- `index.html`, `dist/index.html` — REVERTIDOS ao original
- `scripts/wabadisparos-og.config.mjs` — config central (title/desc/image/1200×630)
- `scripts/patch-paginadevendas-router-og.cjs` — patch SSR: og:image + título/descrição (regex seguro; só atualiza se a chave existir)
- `scripts/deploy-paginadevendas-og-vps.sh` — passa OG_TITLE/OG_DESCRIPTION/TW_DESCRIPTION

## Deploy VPS (apenas wabadisparos)

```bash
wget -O /tmp/deploy-pv-og.sh "https://raw.githubusercontent.com/walkup-tec/waba/<SHA>/scripts/deploy-paginadevendas-og-vps.sh"
sed -i 's/\r$//' /tmp/deploy-pv-og.sh && chmod +x /tmp/deploy-pv-og.sh
/tmp/deploy-pv-og.sh
```

Se der 502 novamente: `scripts/recover-wabadisparos-502-vps.sh`.

## Pendências

- Confirmar site wabadisparos 200 estável antes de rodar deploy OG
- Rodar deploy OG + Facebook Sharing Debugger
