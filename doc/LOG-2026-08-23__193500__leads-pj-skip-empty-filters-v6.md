# LOG — Leads PJ: pular filtros vazios pós-CNAE

## Contexto

Após `CNAE ok` a UI ficava minutos em “aplicando demais filtros” mesmo sem UF/natureza/etc. (Corban: só CNAE + Ativa + secundária + celular).

## Causa

`applyFilters` ainda percorria dezenas de `fillByLabel`/`setToggleByLabel` e fallbacks Playwright lentos no Xvfb.

## Solução

1. Só preenche campos com valor; só liga switches `true`.
2. Switches ativos num único `evaluate` (`enableTogglesFast`).
3. Removido fallback Playwright lento nos toggles; timeout curto.
4. Situação cadastral: só marca as pedidas (não uncheck ×5).
5. Marker: `DEPLOY-2026-08-23-1935-leads-pj-skip-empty-filters-v6` (+ dist).

## Validar

Redeploy → após CNAE ok, em poucos segundos: `ativando N switch(es)` → `pronto para pesquisar` → Copiar.
