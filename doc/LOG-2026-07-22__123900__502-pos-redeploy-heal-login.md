# LOG — 502 Bad Gateway pós-Redeploy (waba.draxsistemas)

## Contexto
Após Redeploy Easypanel do `waba_disparador`, `https://waba.draxsistemas.com.br` ficou **Bad Gateway**.

## Causa
Padrão conhecido: Swarm perde publish host **`:30180`** e/ou Traefik deixa de apontar para `172.17.0.1:30180` → 502. Não é falha de senha nem do código do commit FTP.

## Ação
No VPS (root), burst do heal login:

```bash
/root/waba-infra/heal-waba-login-vps.sh burst
# se o script não existir / desatualizado:
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
/tmp/heal-waba-login-vps.sh burst
```

Validar: `curl -sS -o /dev/null -w "%{http_code}\n" --max-time 15 https://waba.draxsistemas.com.br/health` → 200.

## Observação
Deploy FTP já publica o código; **Redeploy** só é necessário para imagem/env — e costuma derrubar `:30180` até o heal.

## Palavras-chave
502, bad-gateway, redeploy, 30180, heal-waba-login, waba.draxsistemas
