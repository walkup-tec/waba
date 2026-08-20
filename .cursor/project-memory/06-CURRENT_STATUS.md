# Estado Atual

Não usar como histórico de desenvolvimento.

## Funcionalidades concluídas

- Sistema de mensageria WhatsApp (oficial + alternativa) em produção (`https://waba.draxsistemas.com.br/`)
- Ambientes locais V02 e V03
- Infra/monitor VPS documentado em `AGENTS.md` e `scripts/infra/`
- Knowledge Base em `.cursor/knowledge/`
- Memória do projeto em `.cursor/project-memory/`
- Reenvio de boas-vindas sem pedir senha (fonte + `dist/` em `master`)
- Boas-vindas WhatsApp obrigatória: fila completa + JID canônico + retry até ACK de aparelho
- Boas-vindas WhatsApp: texto sem `━`, sem card OG; capa JPEG via sendMedia após ACK
- Exclusão de owners internos das métricas Admin / Financeiro / Disparos (`2ca2404`)
- Verificação de entrega do aquecedor com ACK de aparelho anti-`@lid` (`2556946`)
- Campanhas de bônus de envio excluídas do split de pagamento (creditFunding + settle skip + backfill da fila)
- Operacional com múltiplos tipos de disparo + fornecedor duplicável por plano no Financeiro
- Dispositivos (Device Cloud): lingueta **«Adicionar ao Aquecedor»** após cadastro de número no WhatsApp do dispositivo virtual
- Integração aquecedor via lingueta (sem botão **Aquecer** na barra nem etapa CONFIRMAR); estados `idle` / `busy` / `done`
- Conclusão da integração: lingueta **«Integração Finalizada»** + pulso no menu **Instâncias** até o usuário abrir a aba
- Copy do fluxo Dispositivos sem menções visíveis a EVO/Evolution; **device** → **dispositivo** nas mensagens ao usuário
- Botão **Início** removido do footer do dispositivo virtual
- Campanha API Alternativa: imagem → texto sem URL → botão nativo (`DEPLOY-2026-08-20-alternativa-button-restore`, payload da campanha 11/08)

## Funcionalidades em andamento

- Operação contínua em produção; locais V02/V03 para desenvolvimento
- DRAX Device Cloud MVP (repo `drax-device-cloud`) — menu WABA pronto; deploy do API/web + worker KVM pendente

## Pendências relevantes

- **Redeploy EasyPanel** `waba_disparador` para marker `DEPLOY-2026-08-19-device-cloud-lingueta-tab` (código e `dist/` já em `master`; produção ainda pode servir marker antigo até redeploy)
- Após redeploy: validar `/health`, lingueta visível, ausência de `device-cloud-warm-btn` / **Início** / **Aquecer** no HTML servido
- Após cada mudança de UI/runtime: `npm run build` + commit `dist/` antes do push (FTP sozinho **não** atualiza `waba.draxsistemas.com.br`)
- Após deploy `DEPLOY-2026-08-19-125000-welcome-cover-sendmedia`: reenviar boas-vindas e confirmar JPEG nítido no WhatsApp
- Hospedar API/web Device Cloud na URL pública (WABA só abre launcher/SSO)
- Provisionar host Linux+KVM para `REDROID_MODE=docker`
