# Admin assinantes — ações inline na tabela

## Contexto

Mover Reenviar boas-vindas, Excluir e Editar cadastro para ícones na linha da tabela; modal de cadastro fica só com Salvar e Fechar.

## Solução

1. Nova coluna de ações com 3 ícones SVG por linha:
   - Reenviar boas-vindas (abre overlay com campo senha)
   - Excluir assinante (abre modal de confirmação existente)
   - Editar cadastro (abre modal de detalhe/edição)
2. Removidos botões «Reenviar boas-vindas» e «Excluir assinante» do modal de cadastro.
3. Linha da tabela deixa de ser clicável inteira — só o ícone de editar abre o modal.
4. Overlay `#admin-subscriber-resend-overlay` para senha no reenvio (mesma API `POST /admin/subscribers/:id/resend-welcome`).

## Arquivos

- `index.html` — CSS, HTML overlay, `buildAdminSubscriberRowHtml`, handlers, funções de modal.

## Validar

- Admin → Assinantes: 3 ícones visíveis em cada linha.
- Editar abre modal com dados e histórico de compras.
- Excluir abre confirmação e remove assinante.
- Reenviar pede senha e dispara e-mail + WhatsApp.

## Palavras-chave

`admin-subscriber-row-icon-btn`, `openAdminSubscriberResendModal`, `openAdminSubscriberDeleteModal`, ações inline
