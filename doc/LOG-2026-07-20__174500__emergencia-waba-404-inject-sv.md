# LOG — Emergência: WABA 404 após inject Traefik Sinal Verde

## O que aconteceu

Patch do heal SV **inseriu** blocos `sinal-verde_acesso-sinalverde-0` **após** `waba_paginadevendas-0` no `main.yaml`, em loop. Isso corrompeu a routing dinâmica do Traefik → **404** em:

- wabadisparos.com.br
- bet.waba.info
- waba.draxsistemas.com.br
- acesso-sinalverde.com

## Correção imediata (VPS)

`scripts/emergency-restore-waba-traefik-from-bak-vps.sh` — restaura bak válido + landings + backends WABA; **desliga** heal SV.

Heal SV reescrito **v10-safe**: sem inject; só URL se service SV já existir; install deixa timer OFF.

## Keywords

emergencia, main.yaml, 404, inject, wabadisparos, bet, draxsistemas
