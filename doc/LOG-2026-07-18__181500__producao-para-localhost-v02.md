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
1. Preferencial (Hostinger root) — secret SSH do Actions está ausente (falhou run 29655618510):
   ```bash
   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/export-prod-data-hostinger.sh" \
     -o /tmp/export-prod-data-hostinger.sh
   sed -i 's/\r$//' /tmp/export-prod-data-hostinger.sh
   chmod +x /tmp/export-prod-data-hostinger.sh
   /tmp/export-prod-data-hostinger.sh
   ```
   Baixar `/root/waba-prod-data.tgz` e aplicar: `npm run apply:prod-tarball-v02 -- caminho\waba-prod-data.tgz`
2. Alternativa: restaurar secret `VPS_SSH_PRIVATE_KEY` no GitHub e re-disparar Export (push em `.github/export-triggers/`)
3. `npm run dev:v02` → login master → conferir assinantes/instâncias

## Status 2026-07-18 15:20 BRT
- `.env.v02` OK (secrets de `E:\Waba`, aquecedor/background OFF)
- Commit `fb9eb02` no `master`
- Export SSH Actions: **failure** (secret vazio)
- Deploy FTP: **failure** (envio FTP)
- Produção ainda no marker antigo (endpoint snapshot ainda não live)
- `data/v02` local ainda vazio — aguarda tarball do Hostinger

## Segurança
- Não commit de `.env`
- Aquecedor/background desligados no V02 local para não duplicar envios no EVO compartilhado
- Snapshot/export só com master / secret VPS SSH

## Keywords
`producao`, `localhost`, `v02`, `data-snapshot`, `export-triggers`, `/app/data`, `espelho`
