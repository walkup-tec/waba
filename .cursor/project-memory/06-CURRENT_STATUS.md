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
- Campanha API Alternativa: imagem → texto sem URL; pareamento não é derrubado por proxy/set no tick nem ao ativar
- Reconexão de número: apaga clones/sessão antiga na Evolution; preserva foguinhos e totais de envio
- Campanha dispara quando a Evolution está `open`; pausa automática de saúde retoma sozinha
- Campanha em execução: troca automática 1:1 do desconectado por conectado habilitado para disparos (Proxy sai/entra)
- Laboratório: CARD 02 mostra nome e foto do portfólio e dos chips gravados na conta WABA (Meta é best-effort)

## Funcionalidades em andamento

- Operação contínua em produção; locais V02/V03 para desenvolvimento
- DRAX Device Cloud MVP (repo `drax-device-cloud`) — menu WABA pronto; deploy do API/web + worker KVM pendente

## Pendências relevantes

- **Deploy produção:** push `origin/master` + Redeploy EasyPanel `waba_disparador`. Validar `GET /health` = `DEPLOY-2026-08-21-campanha-auto-swap-instancias`
- Após cada mudança de UI/runtime: `npm run build` + commit `dist/` antes do push (FTP sozinho **não** atualiza `waba.draxsistemas.com.br`)
- Após deploy `DEPLOY-2026-08-19-125000-welcome-cover-sendmedia`: reenviar boas-vindas e confirmar JPEG nítido no WhatsApp
- Hospedar API/web Device Cloud na URL pública (WABA só abre launcher/SSO)
- Provisionar host Linux+KVM para `REDROID_MODE=docker`
