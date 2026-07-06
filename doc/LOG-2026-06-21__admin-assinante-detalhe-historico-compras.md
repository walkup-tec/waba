# Admin assinante — detalhe cadastral e histórico de compras

## Contexto
Master precisa clicar num assinante na tabela e ver dados cadastrais, data de cadastro e histórico de compras.

## Solução
- API `GET /admin/subscribers/:subscriberId` (master): perfil, resumo e compras (pagas + pendentes).
- Linhas da tabela clicáveis → modal com cadastro + tabela de compras.
- Produtos: créditos disparos e números alternativa.

## Arquivos
- `src/admin/waba-admin-subscribers.service.ts`
- `src/admin/waba-admin.routes.ts`
- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar
Admin · Assinantes → clicar linha → modal com CPF, WhatsApp, data cadastro e compras.
