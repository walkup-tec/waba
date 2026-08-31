# LOG — install VPS watchdog + guard OK; permanent-all falhou curl

## Pedido
Usuário colou saída do install no srv1261237.

## Resultado
1. **Watchdog :443** — instalado, timer 45s active, check OK (`:443` + Traefik 1/1 + HTTPS smoke). Mensagem `outro watchdog em execução — skip` = lock OK (install + timer simultâneos).
2. **Guard v2.2** — instalado; sem `web`/`websecure`; probe bet=200 disparos=200.
3. **permanent-all** — falhou no 1º `curl` (`Recv failure: Connection reset by peer`) ao baixar scripts para `/root`. Não afeta 1–2.

## Próximo
Retry permanent-all com SHA pin + retries; ou só confirmar bootstrap timer 1min se `/root/traefik-easypanel-bootstrap-vps.sh` já existir.
