# LOG — Aquecedor parou após redeploy (investigação 17/07)

**Data:** 2026-07-17 07:35  
**Marker:** `DEPLOY-2026-07-17-aquecedor-desired-sobrevive-redeploy`

## O que o usuário viu

Saiu da tela com aquecedor ligado; de manhã: **Motor: parado** / **Iniciar Aquecedor**.  
Últimos envios: ~20:58 de 16/07 (um **Em Fila** preso).

## Evidência (produção)

| Sinal | Valor |
|-------|--------|
| `serverBootId` `mro66ke4` | **2026-07-16 20:58:25 BRT** (restart do Node) |
| Boot anterior `mro3m43k` | 16/07 19:46:32 BRT |
| `runtime-intent` / envios / command-log `updatedAt` | **20:58:17–18 BRT** (último ciclo, segundos antes do kill) |
| Envios após 20:58 | **nenhum** (arquivo não atualizou de novo) |
| Expediente 5h–23h | Às 20:58 a janela humanizada estava **aberta** — não foi pausa de horário |

## Causa raiz

1. **Redeploy Easypanel** (~20:58) matou o processo no meio do ciclo (mensagem ficou Em Fila).
2. Após o restart o motor **não voltou ligado** para o assinante (`desired=false` → botão Iniciar).
3. Sair da tela / logout **não** chama `/aquecedor/stop`; o problema foi o **restart do container** sem intenção durável confiável.

## Correção (hardening)

- Arquivo dedicado `data/aquecedor-desired-owners.json` — só muda em Iniciar/Pausar.
- No boot: restaura `desired=true` desse arquivo + retoma timers.
- No SIGTERM: flush de desired + runtime-intent antes de sair.
- `/health` → `aquecedorDesiredOwners` (contagem).

## Ação imediata do usuário

Clicar **Iniciar Aquecedor** agora. Após todo Redeploy, conferir se o motor continua **ativo** (ou Iniciar de novo até o fix estar no ar).

## Keywords

`redeploy`, `serverBootId`, `20:58`, `desired`, `aquecedor-desired-owners`, `Em Fila`, `restart`
