# Device Cloud — lingueta visível ao abrir; remove Início

## Contexto

Produção ainda exibia botão antigo **Aquecer** (cache/bundle anterior). Pedido: remover **Início** do footer e exibir lingueta **Adicionar ao Aquecedor** ao abrir/restaurar dispositivo para teste.

## Solução

- `index.html`: removido botão **Início** (HTML, CSS, handler).
- `ensureDeviceCloudWarmTabVisible()`: lingueta visível em `idle` ao bind/abrir janela (exceto fase `done`).
- `WABA_DEPLOY_MARKER` → `DEPLOY-2026-08-19-device-cloud-lingueta-tab` (força detecção de deploy).

## Validar

1. Ctrl+F5 ou modal de atualização após deploy.
2. Dispositivos → device 6034: sem botão Aquecer no header; lingueta acima do telefone; sem Início no footer.

## Keywords

device-cloud, lingueta, sem-inicio, deploy-marker
