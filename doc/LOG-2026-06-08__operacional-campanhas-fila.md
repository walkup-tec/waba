# LOG — Tela operacional Campanhas

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-operacional-campanhas-fila-v1`

## Solicitação

Tela para usuários **Operacional** listarem campanhas de todos os assinantes que precisam de configuração de disparo, com modal de detalhes e downloads (imagem + planilha de leads truncada aos envios contratados).

## Alterações

### Backend
- `src/disparos/waba-campaign-spreadsheet.util.ts` — `trimSpreadsheetBufferToRowCount()`
- `src/disparos/waba-campaign-intake.repository.ts` — `spreadsheetTrimmedPath`, `spreadsheetTrimmedFileName`
- `src/disparos/waba-campaign-intake.routes.ts` — grava planilha truncada no intake
- `src/admin/waba-operacional-campanhas.service.ts` — listagem e detalhe enriquecidos
- `src/admin/waba-operacional-campanhas.routes.ts` — `GET /admin/operacional/campanhas`, `/:id`, `/:id/imagem`, `/:id/planilha`
- `src/auth/waba-staff-menu-auth.ts` — autorização por menu
- `src/menus/waba-menu-registry.ts` — menu `admin-campanhas`
- `src/index.ts` — registro das rotas
- `src/deploy-marker.ts`

### Frontend
- `index.html` — aba Admin · Campanhas, tabela, filtro “aguardando configuração”, modal, downloads

## Validação

- `npm run build` — OK (tsc + copy index.html)

## Pendências

- Habilitar menu `admin-campanhas` para usuários operacionais no Admin · Usuários
- Reiniciar `npm run dev:v02` para carregar rotas novas
- Campanhas antigas sem `spreadsheetTrimmedPath`: download gera truncamento on-the-fly
