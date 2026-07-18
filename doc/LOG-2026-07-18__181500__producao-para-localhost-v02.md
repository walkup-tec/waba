# LOG — Espelho produção → localhost V02

## Contexto
Pedido: pegar tudo de produção e subir no ambiente localhost V02 (`http://localhost:3012/version-02/`).

## Bloqueios
- Sem chave SSH local para `root@72.60.51.127`
- `H:\...\Waba\.env.v02` estava sem segredos (copiado de `E:\Waba\.env.v02`)
- APIs admin não devolvem `passwordHash` → precisa dos JSON brutos de `/app/data`

## Solução
1. `.env.v02` alinhado a produção (EVO/Supabase/Asaas/admin), com:
   - `ENABLE_AQUECEDOR_PROCESSING=false`
   - `ENABLE_BACKGROUND_PROCESSING=false`
2. Endpoint master `GET /admin/infra/data-snapshot` + `npm run pull:prod-to-v02`
3. Workflow `Export Production Data (SSH)` (trigger por `.github/export-triggers/*.json`) → artifact `waba-prod-data`
4. `npm run apply:prod-tarball-v02 -- path\to\arquivo.tgz` aplica em `data/v02` e zera `aquecedor-desired-owners.json`

## Arquivos
- `src/admin/waba-admin-data-snapshot.service.ts`
- `src/admin/waba-admin.routes.ts`
- `scripts/pull-production-data-to-v02.cjs`
- `scripts/apply-prod-data-tarball-to-v02.cjs`
- `.github/workflows/export-production-data-ssh.yml`
- Marker: `DEPLOY-2026-07-18-data-snapshot-v02`

## Validar
1. Após push: Actions → Export Production Data → baixar artifact
2. `node scripts/apply-prod-data-tarball-to-v02.cjs <tgz>`
3. `npm run dev:v02` → login master → conferir assinantes/instâncias

## Segurança
- Não commit de `.env`
- Aquecedor/background desligados no V02 local para não duplicar envios no EVO compartilhado
- Snapshot/export só com master / secret VPS SSH

## Keywords
`producao`, `localhost`, `v02`, `data-snapshot`, `export-triggers`, `/app/data`, `espelho`
