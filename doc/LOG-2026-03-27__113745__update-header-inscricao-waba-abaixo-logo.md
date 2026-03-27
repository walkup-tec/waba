# Contexto do pedido

Usuário solicitou incluir uma inscrição logo abaixo da logo no header com o texto:
`WABA - Sistema completo para whatsapp`.

# Comandos e ações executadas

1. Edição do `index.html` para:
   - adicionar bloco de marca com legenda abaixo da logo;
   - incluir estilos de `brand-block` e `brand-caption`.
2. Build do projeto:
   - `npm run build`
3. Validação de lint no arquivo editado:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Criação do container `brand-block` com layout em coluna para agrupar logo e texto.
2. Adição da classe `brand-caption` com estilo discreto e centralizado.
3. Inserção do texto solicitado imediatamente abaixo da logo:
   - `WABA - Sistema completo para whatsapp`
4. Build executado para atualizar `dist/index.html`.

# Arquivos criados/alterados

- `index.html` (alterado)
- `doc/LOG-2026-03-27__113745__update-header-inscricao-waba-abaixo-logo.md` (novo)

# Como validar

1. Rodar o sistema (`npm start`).
2. Verificar no header:
   - logo Drax visível;
   - inscrição abaixo da logo com o texto solicitado.
3. Testar em mobile para confirmar responsividade do bloco.

# Observações de segurança

- Nenhum segredo/chave foi alterado ou exposto.
- Mudança apenas de UI estática no frontend.

# Itens para evitar duplicação no futuro (palavras-chave)

- header-brand-caption
- inscricao-abaixo-logo
- waba-sistema-completo
- responsividade-header
