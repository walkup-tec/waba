# Deploy V02 — paridade total com produção

Objetivo: **https://waba.draxsistemas.com.br/version-02/** idêntico à produção (código + dados + integrações).

## 1. Código (Git)

Branch **`v02`** sincronizada com `master`. Marker: `DEPLOY-2026-07-06-v02-paridade-producao`.

```bash
git checkout v02 && git pull origin v02
# Easypanel waba/waba_disparador_v02 → Redeploy
```

## 2. Easypanel — `waba/waba_disparador_v02`

| Campo | Valor |
|-------|--------|
| Repo | `walkup-tec/waba` |
| Branch | **`v02`** |
| Build | Dockerfile |
| Zero downtime | **OFF** |
| Volume | `/app/data` (separado da produção) |

### Env obrigatória V02

```env
WABA_ENV=v02
WABA_BASE_PATH=/version-02
WABA_UI_PROFILE=production
RUNTIME_MODE=production
ENABLE_BACKGROUND_PROCESSING=true
HOST=0.0.0.0
PORT=80
```

### Env — copiar do `waba_disparador` (produção)

Copie **todas** as variáveis de integração do serviço produção:

- `EVO_API_URL`, `EVO_API_KEY`, `EVO_TLS_INSECURE`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_*`, SMTP, `WABA_SESSION_SECRET`
- `WABA_ADMIN_EMAIL`, `WABA_ADMIN_PASSWORD`
- `WABA_SHORT_PUBLIC_BASE=https://waba.draxsistemas.com.br`
- `WABA_APP_LOGIN_URL=https://waba.draxsistemas.com.br/version-02/`

> **Importante:** use as **mesmas** credenciais de produção para paridade real (EVO, Supabase, Asaas).

## 3. VPS — script único (root)

Após redeploy do serviço V02 no Easypanel:

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/v02/scripts/sync-v02-paridade-producao-vps.sh" -o /tmp/sync-v02.sh
sed -i 's/\r$//' /tmp/sync-v02.sh && chmod +x /tmp/sync-v02.sh
/tmp/sync-v02.sh run
```

O script:
1. Publica porta host **30200** (V02) e valida **30180** (prod)
2. Configura Traefik PathPrefix `/version-02` + stripPrefix
3. **Copia `/app/data` da produção para V02** (assinantes, usuários staff, campanhas, créditos…)
4. Valida `/health` e `/version-02/health`

## 4. Validar

```bash
curl -sS https://waba.draxsistemas.com.br/health | jq .deployMarker,.wabaEnv,.basePath
curl -sS https://waba.draxsistemas.com.br/version-02/health | jq .deployMarker,.wabaEnv,.basePath,.uiProfile
```

Esperado V02:
- `deployMarker`: `DEPLOY-2026-07-06-v02-paridade-producao`
- `wabaEnv`: `v02`
- `basePath`: `/version-02`
- `uiProfile`: `production`

## 5. Fluxo de desenvolvimento (daqui em diante)

1. Commitar na branch **`v02`**
2. Redeploy `waba_disparador_v02`
3. Testar em `/version-02/`
4. Quando validado → merge `v02` → `master` → redeploy produção

Traefik detalhado: [TRAEFIK-WABA-VERSION-PATHS.md](TRAEFIK-WABA-VERSION-PATHS.md)
