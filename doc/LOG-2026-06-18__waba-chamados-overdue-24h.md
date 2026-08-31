# LOG — ícone atraso chamados 24h

**Data:** 2026-06-18

## Pedido
Relógio ao lado do chamado quando não finalizado em 24h (mesmo padrão visual de campanhas).

## Implementação
- `SUPPORT_TICKET_CLOSE_DEADLINE_MS = 24h` em `waba-admin-support.service.ts`
- Campos API: `isCloseOverdue`, `closeDeadlineAt` (desde `submittedAt`/`createdAt`)
- Coluna com ícone de relógio na lista master; some ao finalizar
- Pendentes atrasados sobem no topo; resumo mostra contagem

## Validar
Master → Suporte → Chamados Pendentes → chamado aberto há +24h exibe relógio vermelho.
