# LOG — 502 persiste pós-deploy FTP (heal ainda inativo no VPS)

## Contexto
Após push `538dcc5` (FTP), `waba.draxsistemas.com.br` ainda **Bad Gateway**.

## Causa
Deploy FTP **não** republica `:30180`. O 502 só some com heal no host. Watch/timer provavelmente ainda **inactive** desde a limpeza do Guardião (21/07); o `install` pedido às 12:39/12:45 pode não ter sido executado no VPS. Actions Heal Login depende de `VPS_SSH_PRIVATE_KEY`.

## Ação imediata (root no VPS)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
/tmp/heal-waba-login-vps.sh burst
systemctl is-active waba-login-heal-watch.service
systemctl is-active waba-login-heal.timer
curl -sS -o /dev/null -w "https:%{http_code}\n" --max-time 15 https://waba.draxsistemas.com.br/health
```

Esperado: `active` / `active` / `https:200`.

## Palavras-chave
502, bad-gateway, heal-waba-login install, 30180, pos-ftp
