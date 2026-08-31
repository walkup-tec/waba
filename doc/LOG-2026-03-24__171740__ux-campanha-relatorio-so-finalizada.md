# UX: botão Relatório só com campanha finalizada

## Pedido

Exibir o botão **Relatório** na lista de campanhas apenas quando o status for **concluído** (`finished`).

## Alteração

Em `loadDisparosTemplates` (`index.html`), o botão `.btn-campaign-report` só é anexado a `secondary` quando `isFinished` (`statusRaw === "finished"`).

## Validação

Abrir aba Disparos: campanhas em `running`/`paused` não mostram Relatório; após `finished`, o botão aparece.

## Arquivos

- `index.html` (copiado para `dist/` via `npm run build`)
