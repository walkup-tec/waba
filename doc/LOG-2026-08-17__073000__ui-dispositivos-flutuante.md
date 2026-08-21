# LOG — Dispositivos flutuantes na aba, com excluir

## Contexto do pedido

Dispositivos criados devem permanecer na tela Dispositivos. Botão Excluir sobre o aparelho. Arrastar como janela flutuante, limitado à aba Dispositivos — não sobrepor outros menus.

## Solução

- Janela absoluta dentro de `#device-cloud-stage` (não `position:fixed`). A aba usa `display:none` ao sair, então o celular some dos outros menus.
- Posição persistida em `localStorage` (`waba-device-cloud-layout-v1`).
- Ao voltar para Dispositivos, a janela reaparece e o screenshot retoma (sem recriar o Android).
- Excluir tira da tela e marca `hidden` no layout. Não chama `DELETE /devices/:id` no worker — essa rota faz `docker rm -f` no único Redroid e apagaria o WhatsApp.
- Criar Dispositivo reexibe o aparelho existente.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`, `dist/deploy-marker.js`
- `media/sw-deploy-resilience.js` (cache v6)

## Como validar

1. Dispositivos → Criar Dispositivo: janela com barra e Excluir.
2. Arrastar pela barra; a tela do Android continua clicável.
3. Ir para Dashboard: o celular não aparece por cima.
4. Voltar a Dispositivos: o mesmo aparelho está na posição salva.
5. Excluir → some; Criar Dispositivo → volta.

## Segurança

ADB continua localhost. WhatsApp/Redroid não são destruídos no Excluir da UI.

## Palavras-chave

dispositivos, flutuante, drag, excluir, device-cloud, tab-hidden
