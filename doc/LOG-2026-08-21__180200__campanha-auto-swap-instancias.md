# LOG — Troca automática de instância desconectada na campanha

## Contexto do pedido

Com campanha em andamento, números desconectados devem ser substituídos automaticamente por instâncias conectadas e habilitadas para disparos. Proxy desliga no que sai e liga no que entra. «+ Instâncias» só quando não há reserva (o operador conecta outro número e adiciona na campanha).

## Solução

- Tick `running`: se houver desconectado, `tryAutoSwapDisconnectedCampaignInstances` pega chips `open` do dono com `useDisparador` e lifecycle pronto; troca 1:1; `queueDisableProxy` só nos removidos; `queueProxyBrasilPrepare` nos novos.
- Não desliga Proxy nos números que continuam na campanha (mantém a decisão anti-`device_removed` da pausa).
- Pausa por saúde só se, após a tentativa de troca, o mínimo conectado ainda não for atendido.
- GET `/disparos/campanhas` inclui `instanceHealth.spareConnectedForSwap`.
- UI: botão «+ Instâncias» se há desconectado/mínimo e (não há reserva **ou** a campanha está pausada). Textos distinguem troca automática vs ação manual.

## Arquivos

- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html`
- `.cursor/project-memory/02-BUSINESS_RULES.md`
- `.cursor/project-memory/05-DECISIONS.md`
- `.cursor/project-memory/06-CURRENT_STATUS.md`

## Como validar

1. Campanha running com um pill vermelho e outro chip do dono `open` + disparos ligado: em até ~1 tick o vermelho sai, o novo entra, Proxy migra, campanha segue. Sem botão «+ Instâncias».
2. Sem chip livre: botão aparece; clique após conectar um número novo adiciona e transfere Proxy.
3. Pausar por saúde não deve desligar Proxy dos números que permaneceram na seleção.

Validação funcional completa depende do Node no ar (Redeploy) + campanha real. Sem `sendText` de teste.

## Segurança

Sem segredos. Sem probe `sendText`.

## Palavras-chave

auto-swap, + Instâncias, spareConnectedForSwap, useDisparador, Proxy Brasil, campanha running, 9224
