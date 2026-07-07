# LOG — OG wabadisparos (imagem OGwaba, domínio DRAX)

**Data:** 2026-07-07  
**Solicitação:** Imagem de compartilhamento (OG) de wabadisparos.com.br usando link no domínio DRAX.

## Imagem

- Origem: `D:\Waba\media\OGwaba.png` (1556×1011, ~1.5 MB PNG)
- Otimizada: `media/OGwaba.jpg` + `dist/media/OGwaba.jpg` (JPEG q82, ~207 KB)
- Motivo JPG: PNG pesado não é indexado por WhatsApp/Meta (mesmo caso compBoasvindasV3).

## Link público DRAX (og:image)

```
https://waba.draxsistemas.com.br/media/OGwaba.jpg
```

Servido por `express.static(dist)` no container `waba_disparador` (path `/media/OGwaba.jpg`).

## Passo 1 — Publicar imagem no domínio DRAX (imediato, sem redeploy)

```bash
wget -O /tmp/publish-og-drax.sh "https://raw.githubusercontent.com/walkup-tec/waba/<SHA>/scripts/publish-wabadisparos-og-image-drax-vps.sh"
sed -i 's/\r$//' /tmp/publish-og-drax.sh && chmod +x /tmp/publish-og-drax.sh
/tmp/publish-og-drax.sh
```

Baixa a imagem do raw GitHub e copia para `/app/dist/media/` e `/app/media/` do `waba_disparador`.
Espera: `GET https://waba.draxsistemas.com.br/media/OGwaba.jpg → HTTP 200`.

## Passo 2 — Aplicar og:image na landing wabadisparos (SSR)

```bash
wget -O /tmp/deploy-pv-og.sh "https://raw.githubusercontent.com/walkup-tec/waba/<SHA>/scripts/deploy-paginadevendas-og-vps.sh"
sed -i 's/\r$//' /tmp/deploy-pv-og.sh && chmod +x /tmp/deploy-pv-og.sh
/tmp/deploy-pv-og.sh
```

Meta resultante:
```html
<meta property="og:image" content="https://waba.draxsistemas.com.br/media/OGwaba.jpg" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1556" />
<meta property="og:image:height" content="1011" />
```

## Implementação

Produção wabadisparos = SSR TanStack (`router-aV5ItMUH.mjs`), não index.html estático.

Arquivos:
- `media/OGwaba.jpg`, `dist/media/OGwaba.jpg` — imagem servida no domínio DRAX (permanente após redeploy waba_disparador)
- `scripts/publish-wabadisparos-og-image-drax-vps.sh` — publica imagem no container (imediato)
- `scripts/patch-paginadevendas-router-og.cjs` — patch OG no bundle SSR
- `scripts/deploy-paginadevendas-og-vps.sh` — deploy VPS (docker restart, sem --force)
- `scripts/patch-paginadevendas-index-og.mjs` — fallback HTML estático

## Validar

```bash
curl -I https://waba.draxsistemas.com.br/media/OGwaba.jpg
curl -sS https://wabadisparos.com.br/ | grep -E 'og:image|og:image:type|og:image:width|og:image:height'
```

Preview: https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwabadisparos.com.br%2F (Scrape Again)

## Notas

- `D:\Waba` está na branch `v02` — NÃO deployar. Commit foi feito em `master` via `C:\...\waba-repo`.
- Persistência permanente: `dist/media/OGwaba.jpg` no git → sobrevive a redeploy do waba_disparador.

## Pendências

- Rodar Passo 1 + Passo 2 no srv1261237
- Facebook Sharing Debugger após deploy
