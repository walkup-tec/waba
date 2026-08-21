# Fix: Máx. páginas Leads PJ = 1000

## Contexto
Após filtros + Pesquisar OK, o robô deve copiar página a página até o teto do portal (1000).

## Sintoma / causa
- Backend já paginava (`resolvePortalUiMaxPage` = 1000; 20 cards/página).
- UI enviava `maxPages=5` com `max=50` → jobs paravam cedo (~100 CNPJs).

## Alterações
- `index.html`: campo `mlc-max-pages` → min 1, max 1000, default 1000 + texto de ajuda; clamp no collect.
- `waba-leads-cnpj.service.ts`: clamp server-side 0–1000.
- `waba-leads-cnpj.types.ts`: doc do campo.

## Validação headed (etapa 5)
- Script `.tmp-etapa5-paginar.cjs` com `maxPages=3`.
- Portal: 8.069 empresas · 404 páginas disponíveis.
- Resultado: pág.1 +20, pág.2 +20, pág.3 +20 = **60 CNPJs** em ~28s.
- Com `maxPages=1000` (UI default) copia até min(totalPages, 1000).

## Como validar em produção
1. Deploy FTP + Redeploy imagem se necessário.
2. Em Leads PJ, confirmar "Máx. páginas" = 1000.
3. Extrair lista Corbans e acompanhar progresso "Copiando: página X/…".

## Palavras-chave
leads-pj, max-pages, paginacao, casadosdados, 1000, oruga
