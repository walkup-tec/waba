# LOG — pergunta contingência Traefik pós-estabilização

## Pedido
Usuário: está tudo ok; temos plano de contingência mais abrangente?

## Resposta (resumo)
Sim, mais abrangente que antes (watchdog 45s + guard + bootstrap 1min + anti-thrash v6 + uptime 5min + doc Always Online). Ainda falta: Cloudflare Always Online (manual), SW nas landings React de produção, alias DNS bets.waba.com.br se desejado.
