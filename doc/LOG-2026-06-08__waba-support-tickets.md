# LOG — Botão de suporte para assinantes

**Data:** 2026-06-08

## Solicitação
Botão de suporte no canto superior esquerdo para assinantes. Modal com descrição do problema, anexos (áudio, vídeo, texto) e ID de chamado discreto e somente leitura.

## Alterações

### Backend (`src/support/`)
- `waba-support-ticket.repository.ts` — persistência JSON `waba-support-tickets.json` + pasta `support-tickets/`
- `waba-support-ticket.service.ts` — abertura de rascunho (`CHM-YYMMDD-XXXXXX`) e envio com anexos
- `waba-support.routes.ts`
  - `POST /support/tickets/open`
  - `POST /support/tickets/:ticketId/submit` (multipart)
- Registro em `src/index.ts`
- `WABA_DEPLOY_MARKER` → `DEPLOY-2026-06-08-waba-support-tickets`

### Frontend (`index.html`)
- Botão fixo `#waba-support-btn` (visível só para `role === subscriber`)
- Modal `#waba-support-overlay` com textarea, anexos e ID do chamado
- Fluxo: abrir modal → cria rascunho e exibe ID → enviar com anexos

## Validação
- `npm run build` OK

## Pendências
- Reiniciar `npm run dev:v02` e testar login como assinante
- Deploy Easypanel se solicitado
- Tela admin para listar chamados (não solicitada)
