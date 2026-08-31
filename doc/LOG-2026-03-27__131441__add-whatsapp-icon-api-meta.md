# Contexto do pedido

Usuário solicitou adicionar um ícone do WhatsApp (verde) ao lado da inscrição `API Meta` no seletor de ambiente de integração.

# Comandos e ações executadas

1. Atualização de `index.html`:
   - adição de classes de estilo para botão com ícone (`with-icon`, `wa-icon`);
   - inclusão de ícone SVG do WhatsApp antes do texto `API Meta`.
2. Build:
   - `npm run build`
3. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Criado estilo para botões de ambiente com ícone:
   - alinhamento horizontal e espaçamento entre ícone e texto.
2. Adicionado SVG do WhatsApp com `currentColor` e cor verde (`#22c55e`).
3. Mantido rótulo `API Meta` com o ícone à esquerda.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__131441__add-whatsapp-icon-api-meta.md` (novo)

# Como validar

1. Abrir a aplicação.
2. Verificar em `Ambiente de integração`:
   - botão `API Meta` com ícone do WhatsApp verde ao lado do texto.
3. Confirmar que a alternância entre ambientes continua funcionando.

# Observações de segurança

- Alteração visual apenas (frontend).
- Nenhum segredo/chave/token alterado.

# Itens para evitar duplicação no futuro (palavras-chave)

- whatsapp-icon-api-meta
- integration-env-button
- ui-ambiente-meta
