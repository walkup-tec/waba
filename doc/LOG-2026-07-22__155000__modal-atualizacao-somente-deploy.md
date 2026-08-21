# LOG — Modal “Atualizando o sistema” só em Deploy/Redeploy

**Data:** 2026-07-22 15:50

## Problema

Modal `ATUALIZANDO O SISTEMA` aparecia fora de Deploy/Redeploy (ex.: 502 Traefik/heal, falhas de rede, streak de `/health` instável).

## Regra (CRÍTICO)

Exibir o modal **somente** quando:
1. Deploy/Redeploy do serviço `waba` / `waba_disparador` (`shuttingDown: true` no `/health` ou `/ready`), **ou**
2. Drift de `deployMarker` após o processo estabilizar.

Fluxo desejado: ambiente acessível → deploy/redeploy → estabiliza → modal → refresh.

## Correção

| Antes | Depois |
|-------|--------|
| 502/504 abriam modal | Ignorados (sem `deploySignal`) |
| Streak de rede/unhealthy abria modal | Sem `deploySignal` |
| `fetchWithTimeout` em qualquer API 502 | Removido |
| Login 502 → `startDeployRecovery` | Só mensagem se `waba.deployReload` pós-deploy |

Gatilhos válidos: `shuttingDown` + `deployMarker` drift.

## Arquivos

- `index.html` / `dist/index.html`

## Validar

1. Uso normal / 502 transitório → **sem** modal.
2. Redeploy Easypanel `waba_disparador` → após estável, modal + refresh.
3. Push com novo `deployMarker` + restart → modal + refresh.

## Palavras-chave

deploy overlay, ATUALIZANDO O SISTEMA, 502 falso, shuttingDown, deployMarker, waba_disparador
