# LOG — bet 404 = SPA paginadevendas apesar de yaml 30211

## Evidência
- `waba_bets_pv-0` no disco: `http://172.17.0.1:30211/`
- Routers http/https-waba_bets_pv-0 têm `Host(bet.waba.info)`
- Após `docker service update --force`: Traefik 1/1, :443 OK
- Body de bet = mesmo 404 de `wabadisparos.com.br/path-inexistente` (`styles-DY5Uez-n.css`, sem `drax-bets` / `class="dark"`)
- :30211 local serve landing Bets corretamente

## Conclusão
Traefik está entregando bet ao backend **paginadevendas :30210**, não ao service file `waba_bets_pv-0` (ou esse service não é o que o router ativo usa — colisão provider / outro router / yaml regenerado pós-force).

## Próximo
Diagnóstico: listar TODOS os routers com `bet.waba.info` + URL real de `waba_bets_pv-0` + API Traefik; curl do container Traefik → 30211.
