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
- Campanhas de bônus de envio excluídas do split de pagamento (creditFunding + settle skip + backfill da fila)
- Operacional com múltiplos tipos de disparo + fornecedor duplicável por plano no Financeiro

## Funcionalidades em andamento

- Operação contínua em produção; locais V02/V03 para desenvolvimento
- Troca de bloqueados no «+ Instâncias» + tag Proteção ativa (código pronto; aguarda commit/push + Redeploy) — marker `DEPLOY-2026-08-12-swap-blocked-proxy-tag`
- Boas-vindas WhatsApp com bypass de Preparando/pausa humana + retry (mesmo worktree; aguarda commit) — marker anterior `DEPLOY-2026-08-12-welcome-bypass-lifecycle`

## Pendências relevantes

- Após cada mudança de UI/runtime: garantir `dist/` atualizado no `master` antes do Redeploy EasyPanel
- Validar em produção (após redeploy) marker `DEPLOY-2026-08-12-swap-blocked-proxy-tag`: «+ Instâncias» remove vermelho, Proxy no novo, tag Proteção ativa
