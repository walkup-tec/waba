# Estado Atual

Não usar como histórico de desenvolvimento.

## Funcionalidades concluídas

- Sistema de mensageria WhatsApp (oficial + alternativa) em produção (`https://waba.draxsistemas.com.br/`)
- Ambientes locais V02 e V03
- Infra/monitor VPS documentado em `AGENTS.md` e `scripts/infra/`
- Knowledge Base em `.cursor/knowledge/`
- Memória do projeto em `.cursor/project-memory/`
- Reenvio de boas-vindas sem pedir senha (fonte + `dist/` em `master`)
- Exclusão de owners internos das métricas Admin / Financeiro / Disparos (`2ca2404`)
- Verificação de entrega do aquecedor com ACK de aparelho anti-`@lid` (`2556946`)

## Funcionalidades em andamento

- Operação contínua em produção; locais V02/V03 para desenvolvimento

## Pendências relevantes

- Após cada mudança de UI/runtime: garantir `dist/` atualizado no `master` antes do Redeploy EasyPanel
- Validar em produção (após redeploy) ciclo teste aquecedor com destino `@lid` (ex.: 1261 → 2477) e marker `DEPLOY-2026-08-03-aquecedor-delivery-ack-lid`
