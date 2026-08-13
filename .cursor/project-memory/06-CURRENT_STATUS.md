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
- DRAX Device Cloud MVP (repo `drax-device-cloud`) — menu WABA pronto; deploy do API/web + worker KVM pendente

## Pendências relevantes

- Após cada mudança de UI/runtime: garantir `dist/` atualizado no `master` antes do Redeploy EasyPanel
- **Redeploy EasyPanel** para marker `DEPLOY-2026-08-13-device-cloud-tab-show` (fix aba Dispositivos vazia) + `DEVICE_CLOUD_PUBLIC_URL` / `DEVICE_CLOUD_SSO_SECRET`
- Hospedar API/web Device Cloud na URL pública (WABA só abre launcher/SSO)
- Provisionar host Linux+KVM para `REDROID_MODE=docker`
