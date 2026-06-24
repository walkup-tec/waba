# LOG — Fix reposição offline + UI standby/campanha

**Data:** 2026-06-23

## Problema

Números comprados offline (fora da campanha) não eram substituídos. Causa: `filterDisparadorInstancesReadyForAuth` excluía instâncias da Fazenda ainda não ativadas pelo assinante.

## Correções backend

- `filterFazendaClaimableForAuth` — permite candidatos da pool Fazenda disponíveis para o assinante.
- Tick dedicado a cada 15s (`runFazendaOfflineReplenishmentTick`), independente do disparador.
- Reposição também ao carregar `GET /billing/alternativa-numbers/summary`.
- `replacementScope`: `campaign` | `standby` nas ativações.

## UI cards

- **Substituto na campanha:** verde + ícone circular ↻ + badge «↻ Substituto».
- **Reserva (fora da campanha):** azul + ↻ + badge «↻ Reserva».
- **Bloqueado (antigo offline):** vermelho + ✕.
- Polling da lista a cada 15s na aba Meus números.

## Validar

Reiniciar V02 (`scripts\dev-v02.ps1`). Abrir Meus números — offline fora da campanha devem virar bloqueado + novo azul ↻ em até 15s.
