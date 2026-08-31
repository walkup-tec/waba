# LOG — 2026-07-08 09:42 — Traefik bootstrap recover 0/1 → 1/1

## Contexto
Após apply do disable-overkill, status mostrou `easypanel-traefik` 0/1. Usuário rodou bootstrap.

## Resultado
- Antes do `run` (na mesma sessão): Traefik já apareceu 1/1 + :80/:443 com docker-proxy (recovery espontâneo ou timer).
- `bootstrap run` viu `replicas=0/1` no momento da checagem e aplicou `--force easypanel-traefik`.
- Pós-run: Traefik **1/1**, :80/:443 OK, WABA health **200**.

## Estado stack (atual)
- Heal hiperativo: OFF (timers/watches/cron)
- Bootstrap timer + config-guard: ON
- Traefik: 1/1 estável após force
- Apps negócio: não pausados

## Observação
Load ainda alto (~11–13) — steal/apps ociosos fora do escopo deste recover. Não reativar permanent 20s.

## Palavras-chave
traefik bootstrap force, 0/1 recover, heal overkill off
