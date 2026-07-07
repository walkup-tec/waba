# LOG — OG wabadisparos imagem-face2

**Data:** 2026-07-07  
**Solicitação:** Meta tags OG no index wabadisparos.com.br com imagem agenciadigitalcorban.

## Meta tags solicitadas

```html
<meta property="og:image" content="http://agenciadigitalcorban.com.br/img/imagem-face2.jpg" />
<meta property="og:image:type" content="image/jpg" />
<meta property="og:image:width" content="800" />
<meta property="og:image:height" content="600" />
<meta property="og:type" content="website" />
```

## Implementação

Produção usa SSR TanStack (`router-aV5ItMUH.mjs`), não index.html estático.

Arquivos:
- `scripts/patch-paginadevendas-router-og.cjs` — patch no bundle SSR
- `scripts/deploy-paginadevendas-og-vps.sh` — deploy VPS (docker restart, sem --force)
- `scripts/patch-paginadevendas-index-og.mjs` — fallback HTML estático atualizado

## Deploy VPS

```bash
wget -O /tmp/deploy-pv-og.sh "https://raw.githubusercontent.com/walkup-tec/waba/<SHA>/scripts/deploy-paginadevendas-og-vps.sh"
chmod +x /tmp/deploy-pv-og.sh
/tmp/deploy-pv-og.sh
```

Validar:
```bash
curl -sS https://wabadisparos.com.br/ | grep -E 'og:image|og:image:type'
```

## Pendências

- Rodar deploy no srv1261237
- Facebook Sharing Debugger após deploy
