# LOG — decontam OK no disco; HTTPS bets ainda 404 SPA

## Estado
- Bootstrap OK; force OK; :443 up; disparos 200; health 200
- ANTES/DEPOIS: só `http/https-waba_bets_pv-0` com hosts bets → `waba_bets_landing_fix`
- Nenhum LIMPO em paginadevendas (não estava contaminado no extract completo)
- easypanel-bets + bet ainda 404 SPA disparos

## Hipótese forte
Easypanel **reescreve main.yaml no force** do Traefik, ou o container monta/lê cópia diferente. Validar disco vs dentro do container **após** o force.

## Falso positivo anterior
Janela de 800 bytes a partir de `https-waba_paginadevendas-0` alcançava o router bets seguinte no arquivo.
