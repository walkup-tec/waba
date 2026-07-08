# LOG — 2026-07-08 09:47 — WABA 500 pós-bootstrap; recuperou sem permanent-all

## Contexto
Após `traefik-easypanel-bootstrap-vps.sh run` (force Traefik 0/1→1/1), usuário viu `Internal Server Error` em `waba.draxsistemas.com.br`. Pediu recover; antes de colar o bloco `permanent-all run`, o sistema voltou sozinho.

## Estado
- WABA de volta (confirmação do usuário)
- Heal overkill continua OFF
- Bootstrap/guard ativos
- Permanent-all NÃO foi executado nesta recuperação

## Lição
`docker service update --force` no Traefik pode causar 500/transient durante rebind :80/:443. Para 0/1, preferir confirmar se :443 já escuta e se health flapping antes de force. Não pedir bootstrap force se Traefik já 1/1 + portas OK.

## Palavras-chave
waba 500, traefik force transient, recuperou sozinho
