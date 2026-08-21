# LOG — Guardião ATIVO (repair) + caça aos writers concorrentes

- **Data:** 2026-07-21 ~15:00–16:18
- **Contexto:** Após deploy do Sinal Verde, `main.yaml` compartilhado corrompia repetidamente (vírgulas soltas na linha 126) e voltava a corromper segundos após cada restore.

## Investigação (em camadas)

Cada restore era seguido de nova corrupção. Writers encontrados e desligados, em ordem:

1. `sinal-verde-overlay-guard` (timer + watch) e `soma-crm-overlay-guard` (timer + watch)
2. `heal-sinal-verde` (timer + watch), `soma-gestao-heal` (timer + watch), `traefik-permanent-credilix-acessos-watch`, `traefik-permanent-watch`, `waba-login-heal` v2 antiga (chamava `restore-easypanel-traefik-backends` → regex no main.yaml), `waba-traefik-autoheal`
3. **Culpado final:** `sinal-verde-main-yaml.path` — systemd **path unit** que disparava `sinal-verde-main-yaml-strip.service` a cada modificação do `main.yaml`. O strip deixava vírgulas órfãs → JSON inválido.

Evidência: journal 17:58:54 mostra o path trigger executando strip (`stripped=6`) 8 segundos após o restore.

## Correção

1. Todos os writers concorrentes desligados (`systemctl disable --now` + `pkill`).
2. Restore do bak válido (`main.yaml.bak-restore-easypanel-backends-2026-07-10-v2-20260719-234729`).
3. Estabilidade comprovada: JSON válido por 60s, mtime imutável, WABA 200.
4. `guardiao-sistemas-traefik-vps.sh activate`:
   - audit detectou drift (12 chaves SV/Soma duplicadas no main)
   - repair fez strip transacional com probes + sem regressão
   - state final `clean`, digest registrado

## Validação final

| Probe | Código |
|-------|--------|
| waba-login (/health) | 200 |
| wabadisparos.com.br | 200 |
| bet.waba.info | 200 |
| acesso-sinalverde.com | 307 (aceitável) |
| app.somaconecta.com.br/api/health | 200 |

## Estado permanente

- **Único writer:** `guardiao-sistemas-traefik.service` (mode=repair)
- Desligados/não religar: overlay-guards SV/Soma, heal-sinal-verde, soma-gestao-heal, traefik-permanent-*, waba-traefik-autoheal, `sinal-verde-main-yaml.path`, waba-login-heal v2 antiga
- Heals WABA (login/pv/bets) devem ser reinstalados **apenas** nas versões guardian (publish-only) quando necessário

## Palavras-chave

`sinal-verde-main-yaml.path`, path unit strip, vírgulas soltas main.yaml, writers concorrentes, guardiao repair ativo, strip transacional, digest clean
