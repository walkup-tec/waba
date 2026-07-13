# LOG — V02 paridade com produção (2026-07-13)

**Pedido:** Subir tudo de produção para V02; testar no V02; produção só à noite.

## Código
- Branch `v02` alinhada a `origin/master` (`fe46ddc` + marker V02)
- Marker: `DEPLOY-2026-07-13-v02-paridade-prod-logs-handoff`
- Push: `origin/v02`

## Ações do usuário
1. Easypanel → Redeploy `waba_disparador_v02` (branch **v02**)
2. VPS (root) — copiar dados prod→V02 + Traefik `/version-02`:

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/v02/scripts/sync-v02-paridade-producao-vps.sh" -o /tmp/sync-v02.sh
sed -i 's/\r$//' /tmp/sync-v02.sh && chmod +x /tmp/sync-v02.sh
/tmp/sync-v02.sh run
```

3. Local (opcional): `npm run build:h` + `npm run dev:v02` → http://localhost:3012/version-02/

## Validar
```bash
curl -sS https://waba.draxsistemas.com.br/version-02/health
# deployMarker = DEPLOY-2026-07-13-v02-paridade-prod-logs-handoff
# wabaEnv = v02, basePath = /version-02
```

## Keywords
`v02`, `paridade`, `master`, `waba_disparador_v02`, `sync-v02`
