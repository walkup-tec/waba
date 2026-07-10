# LOG — Criar chamado para todos os usuários

**Data:** 2026-07-10 12:41

## Contexto / solicitação
- Botão no menu **Chamados** para criar chamados.
- **Todos** os usuários podem abrir chamados.
- **Masters:** botão na tela Suporte · Chamados.
- **Demais usuários** (assinantes, operacional, suporte): botão FAB igual ao dos assinantes.
- Fluxo: mesmo modal atual (descrição + anexos + ID).

## Solução

### Backend
- `src/support/waba-support.routes.ts`: `rejectUnlessSubscriber` → `rejectUnlessAuthenticated` (qualquer login).
- `src/auth/waba-auth.routes.ts`: `canOpenSupportTickets = Boolean(session.email)`.
- `src/support/waba-support-ticket.service.ts`: `resolveOwnerName` também busca nome em usuários do sistema.
- Marker: `DEPLOY-2026-07-10-chamados-todos-usuarios`.

### Frontend (`index.html`)
- Toolbar Chamados: botão **Criar chamado** (`#admin-chamados-create-btn`) — visível só para `role === master`.
- FAB `#waba-support-btn`: visível para quem pode abrir chamado **exceto** master.
- Modal título: **Abrir chamado**.
- Coluna/detalhe: **Solicitante** (antes Assinante).
- Após envio pelo master, lista de chamados é atualizada.

### Dist
- `tsc` indisponível no Drive H (binários 0 bytes / sync). `index.html` copiado via `copy-index-html.mjs`; JS em `dist/` alinhado manualmente às mudanças de `src/`.

## Arquivos alterados
- `src/support/waba-support.routes.ts`
- `src/support/waba-support-ticket.service.ts`
- `src/auth/waba-auth.routes.ts`
- `src/deploy-marker.ts`
- `index.html`
- `dist/support/waba-support.routes.js`
- `dist/support/waba-support-ticket.service.js`
- `dist/auth/waba-auth.routes.js`
- `dist/deploy-marker.js`
- `dist/index.html`

## Como validar
1. Reiniciar V02 / app local.
2. Login **assinante** / **operacional** / **suporte** → FAB `?` abre modal e envia chamado.
3. Login **master** → sem FAB; em Suporte · Chamados, **Criar chamado** abre o mesmo modal; após enviar, aparece em Pendentes.
4. `GET /health` → marker `DEPLOY-2026-07-10-chamados-todos-usuarios`.

## Segurança
- Sem exposição de segredos; auth por cookie de sessão; dono do chamado = e-mail da sessão.

## Palavras-chave
`chamados`, `criar chamado`, `canOpenSupportTickets`, `waba-support-fab`, `admin-chamados-create-btn`, `master`, `operacional`, `suporte`, `assinante`
