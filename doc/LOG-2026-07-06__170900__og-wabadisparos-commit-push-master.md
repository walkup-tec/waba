# LOG — 2026-07-06 17:09 — OG wabadisparos commit/push master

## Pedido
Atualizar imagem OG de https://wabadisparos.com.br/ — commit + push produção (não V02).

## Resultado
- Commit `7c3e872` em `master`: `[ee26de9] feat: OG share image wabadisparos.com.br`
- Push: `origin/master` OK

## Arquivos no commit
- `media/wabadisparos-og.jpg`
- `paginadevendas/public/wabadisparos-og.jpg`
- `paginadevendas/Dockerfile`
- `scripts/deploy-wabadisparos-og-vps.sh`
- `scripts/patch-paginadevendas-index-og.mjs`
- `doc/LOG-2026-07-06__193000__og-wabadisparos-share-image-producao.md`
- `doc/memoria.md`

## Próximo passo (VPS — usuário)
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/deploy-wabadisparos-og-vps.sh" -o /tmp/deploy-wabadisparos-og.sh
sed -i 's/\r$//' /tmp/deploy-wabadisparos-og.sh && chmod +x /tmp/deploy-wabadisparos-og.sh
/tmp/deploy-wabadisparos-og.sh
```

## Pendências
- Executar script no VPS para imagem + meta `og:image` no container live
- Facebook Sharing Debugger → Scrape Again
- V02: stash `v02-wip-before-og-master` ainda disponível se necessário
