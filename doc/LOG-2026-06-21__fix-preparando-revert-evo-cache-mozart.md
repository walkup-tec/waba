# LOG — Fix Preparando revert (5182006011 / Mozart)

## Contexto
Instância `5182006011` voltava a **Preparando** após hotfix ops, mesmo com `force-aquecedor-instance-active.cjs` retornando `ok: true`.

## Causa raiz
1. Cada abertura da aba Instâncias chama `GET /instancias/uso-config` → `registerAquecedorInstancePreparing` + `getAquecedorLifecycleStatusMap`.
2. Ambos executam `reconcileGrandfatheredActiveRow`: se `evo-instances-cache.json` tem `createdAt` recente (refresh EVO), **reverte `active` → `preparing`**.
3. Hotfix anterior só gravava lifecycle; **não corrigia o cache EVO** nem tinha JS definitivo na imagem Docker.
4. Script ops gravava JSON mas o processo Node mantinha cache em memória até `docker restart`.

## Solução implementada
- `manualActiveOverride` + `enforceManualActiveOverride()` — re-promove linha se revertida.
- `registerAquecedorInstancePreparing` / `getAquecedorLifecycleStatusMap` respeitam override.
- `forceAquecedorInstanceActive` + script ops também patcham `evo-instances-cache.json` (`createdAt` 2026-06-01).
- `invalidateAquecedorLifecycleCache()` para scripts externos.
- `POST /admin/aquecedor/force-instance-active` (master).
- Scripts: `scripts/vps-inline-fix-preparing.sh` (sem scp), `scripts/vps-hotfix-instance-preparing.sh`.

## Arquivos alterados
- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/admin/waba-admin.routes.ts`
- `scripts/force-aquecedor-instance-active.cjs`
- `scripts/vps-inline-fix-preparing.sh`
- `scripts/vps-hotfix-instance-preparing.sh`
- `dist/` (build)

## Validar
1. SSH VPS: `bash scripts/vps-inline-fix-preparing.sh` (ou conteúdo inline).
2. Login Mozart → Instâncias → Ctrl+F5 → `5182006011` sem Preparando.
3. Deploy Git/Easypanel para fix permanente na imagem.

## Palavras-chave
preparando, reconcileGrandfatheredActiveRow, evo-instances-cache, manualActiveOverride, mozart, 5182006011
