# LOG — Device Cloud: cliques na tela viravam swipe

## Contexto do pedido

Na tela Selecionar horários, cliques em Voltar (topo), Voltar do sistema, sábado, campo de hora, switch e “+ Adicionar horários” não respondiam.

## Evidências

- Os mesmos alvos respondem via `adb input tap` / `keyevent 4` no Redroid.
- A imagem remota tem ~329 px de largura. O código tratava deslocamento >= 24 px CSS como swipe.
- 24 px nessa escala é jitter normal de mouse; o Compose interpreta swipe como scroll da lista e ignora o clique.

## Solução

- Clique curto continua tap; swipe só se mover >= 20% da largura (mín. 64 px) e durar >= 280 ms.
- Botões **Voltar** e **Início** na barra (keyevent), independentes do toque na imagem.
- Marker `DEPLOY-2026-08-18-device-cloud-tap-not-swipe`
- Inclui o fix anterior: Abrir não envia HOME.

## Arquivos

- `.tmp-master-financeiro/index.html`
- `.tmp-master-financeiro/src/deploy-marker.ts`
- `.tmp-master-financeiro/dist/deploy-marker.js`

## Como validar

Após Redeploy `waba_disparador`: health com o marker novo; clique no switch de sábado deve ligar o dia; botão Voltar da barra deve voltar a tela.

## Palavras-chave

device-cloud, swipe, tap slop, Compose, Selecionar horários, Voltar
