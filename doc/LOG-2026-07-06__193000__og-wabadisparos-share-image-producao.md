# LOG — 2026-07-06 — OG share image wabadisparos.com.br (produção)

## Pedido
Atualizar imagem de compartilhamento (Open Graph) de https://wabadisparos.com.br/ — só produção, não V02.

## Contexto produção
- Site live = landing React/Vite (serviço Easypanel `waba_paginadevendas`)
- **Antes:** `index.html` sem `og:image` → WhatsApp/Meta sem preview
- URL alvo imagem: `https://wabadisparos.com.br/wabadisparos-og.jpg`

## Alterações (commit master)
- `media/wabadisparos-og.jpg` — 1200×630, ~127 KB (JPEG q82)
- `paginadevendas/public/wabadisparos-og.jpg` — cópia para deploy estático (raw GitHub)
- `scripts/patch-paginadevendas-index-og.mjs` — injeta OG no index React
- `scripts/deploy-wabadisparos-og-vps.sh` — publica imagem + patch no container VPS

## Deploy produção
1. Push `master` concluído
2. **No VPS (obrigatório para efeito imediato):**
   ```bash
   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/deploy-wabadisparos-og-vps.sh" -o /tmp/deploy-wabadisparos-og.sh
   sed -i 's/\r$//' /tmp/deploy-wabadisparos-og.sh && chmod +x /tmp/deploy-wabadisparos-og.sh
   /tmp/deploy-wabadisparos-og.sh
   ```
3. Validar:
   - `curl -I https://wabadisparos.com.br/wabadisparos-og.jpg` → 200
   - `curl -sS https://wabadisparos.com.br/ | grep og:image`
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwabadisparos.com.br%2F) → Scrape Again
## Pendência
- Repositório fonte Vite da landing React não está no repo waba — futuro: adicionar `og:image` no `index.html` do build Vite.
