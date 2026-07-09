# LOG — Modal campanha: botões inline

**Data:** 2026-07-09  
**Pedido:** Botões do modal de detalhamento da campanha (Admin) todos na mesma linha.

## Alteração

- `index.html`: unificados `admin-campanhas-detail-actions` + `confirm-actions` em um único footer.
- Modal `max-width` 720px → `min(920px, 96vw)`.
- CSS: `flex-wrap: nowrap`, `white-space: nowrap` nos botões; wrap só em telas &lt; 720px.

## Deploy marker

`DEPLOY-2026-07-09-modal-campanha-botoes-inline`

## Validar (V02 local / produção)

Admin → Campanhas → abrir detalhe → BM inoperante, Reportar Erro, Confirmar início e Fechar na mesma linha.

## Palavras-chave

`admin-campanhas-detail-modal`, `botoes inline`, `operacional campanha`
