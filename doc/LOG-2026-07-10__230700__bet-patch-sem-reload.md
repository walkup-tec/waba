# LOG — bet patch OK, Traefik não recarregou

## Resultado do usuário
- `:30211` = 200 + HTML Bet (`drax-bets`)
- `fix-bet-route-30211` patchou `main.yaml` (routers bets + url `172.17.0.1:30211/`)
- Script saiu com `ERRO: Traefik down` — **falso positivo** (`docker ps -f name=easypanel-traefik` vazio); `:443` continua LISTEN
- HUP foi pulado → file watch provavelmente **não** aplicou o yaml
- Pós-wait: local-bet 404, pub-bet 404, pub-disparos 200

## Causa raiz provável
Traefik ainda serve config antiga do service `waba_bets_pv-0` (URL errada). Sem reload, patch em disco não muda rota.

## Doc
- File provider watch: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
- Em bind-mount Docker, fsnotify pode falhar → precisa remount parent dir ou restart do Traefik

## Próximo
1. Confirmar yaml tem 30211
2. `docker service update --force easypanel-traefik` (reload controlado; bootstrap se :443 morrer)
3. Validar bet 200
