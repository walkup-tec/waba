# LOG — Dispositivos: tela do celular (+30%) e toque funcional

## Contexto do pedido

Remover Voltar/Início/Avançar, DDI, Digitar e o guia de 7 passos. Aumentar a tela em 30%. Fazer o clique funcionar. Usar o Android como um celular: número e código SMS entram no WhatsApp Business.

## Sintoma e causa raiz

- A UI extra no WABA tentava compensar toques que não chegavam ao app.
- `adb shell input tap` saía 0, mas o Redroid estava com display `-touch` e `/dev/input` vazio. Widgets do WhatsApp ignoravam o evento.
- Evidência: PNG/md5 inalterado após `input tap`/`mouse tap`; diálogo de sistema só respondia após uinput; campo `registration_phone` só mudou de foco com `ddc-virt-tap` no `/dev/input/event4`.
- Confiança: alta.

## Solução

1. Worker AWS (`ddc-redroid-test1`, mesmo container): touchscreen virtual I2C DIRECT (`ddc-virt-touch`) + `mknod` no tmpfs do Android. Display passou a `finger`.
2. `AdbClient.tap`/`swipe` passam a usar `ddc-virt-tap`/`ddc-virt-swipe` (sem sudo). `ddc-api` ganhou grupo `input` (drop-in systemd). `NoNewPrivileges` mantido.
3. WABA: só botão Criar Dispositivo + screenshot 329×598 (`253×460` +30%). Mapeamento de toque usa content-box/`object-fit: contain`. Poll de screenshot pausa enquanto o ponteiro está pressionado.

## Arquivos

- WABA: `index.html`, `src/deploy-marker.ts`, `dist/index.html`, `dist/deploy-marker.js`, `media/sw-deploy-resilience.js` (cache v5)
- Worker (não está neste Git): `/opt/device-cloud/packages/virtual-device-provider/src/adb.client.ts`, `/opt/device-cloud/virt-touch/*`, `ddc-api.service.d/input.conf`

## Como validar

- Marker após Redeploy EasyPanel: `DEPLOY-2026-08-14-dispositivos-tela-celular`
- Na aba Dispositivos: tela maior, sem Digitar/Avançar; toque no campo do número foca o WhatsApp; teclado do app aceita o número; SMS no celular real; código digitado na tela.
- Worker já comprovado: `AdbClient.tap(439, 514)` como `ubuntu` focou `registration_phone` (PNG e uiautomator mudaram).

## Segurança

- ADB continua só em `127.0.0.1:5555`. API/web só em localhost + Caddy. Sem segundo Redroid. WhatsApp não reinstado.

## Palavras-chave

device-cloud, redroid, virt-tap, uinput, input tap, Dispositivos, WhatsApp Business, RegisterPhone
