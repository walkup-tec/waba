# LOG — Login Not Found pós-redeploy (2026-07-13)

## Sintoma
Usuário não consegue logar; aviso **Not Found** após Redeploy Easypanel do uptime fix.

## Diagnóstico
1. Logo após redeploy: HTTPS `/health` e `/auth/login` → **502** (Traefik sem backend/`30180`).
2. Minutos depois: `/health` **200**, marker `DEPLOY-2026-07-13-uptime-local-probe-src`, `:30180/health` **200**, `GET /` **200**, `POST /auth/login` responde JSON (401 com credencial inválida de probe = rota OK).

## Causa
Padrão conhecido pós-redeploy: publish host `:30180` / backend Traefik — UI pode mostrar texto tipo Not Found/Bad Gateway até o heal.

## Ação
Se ainda falhar no browser: hard refresh + retry; se persistir, no VPS:
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh && chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh run
```

## Keywords
`login`, `Not Found`, `502`, `30180`, `redeploy`, `heal-waba-login`
