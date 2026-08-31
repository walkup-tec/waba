# Contexto do pedido

Usuário solicitou dois ajustes visuais no header:
1. alinhar a logo à esquerda;
2. aumentar a logo em 15% do tamanho atual.

# Comandos e ações executadas

1. Ajuste de estilos no `index.html`:
   - aumento da altura da logo de `34px` para `39px` (~15%);
   - alinhamento do bloco de marca para esquerda.
2. Build para atualizar `dist`:
   - `npm run build`
3. Validação de lint:
   - `ReadLints` no `index.html` sem erros.

# Solução implementada (passo a passo)

1. Em `.title-icon img.brand-logo`, altura alterada para `39px`.
2. Em `.brand-block`, alinhamento alterado para `align-items: flex-start`.
3. Em `.brand-caption`, alinhamento de texto alterado para `text-align: left`.
4. Build executado para propagar para `dist/index.html`.

# Arquivos criados/alterados

- `index.html` (alterado)
- `doc/LOG-2026-03-27__114050__ajuste-logo-esquerda-e-aumento-15.md` (novo)

# Como validar

1. Abrir a aplicação e verificar no header:
   - logo posicionada à esquerda;
   - logo visualmente maior (15%).
2. Conferir que a inscrição abaixo da logo também está alinhada à esquerda.

# Observações de segurança

- Alteração apenas de UI/CSS.
- Nenhuma credencial, token ou variável sensível foi alterada.

# Itens para evitar duplicação no futuro (palavras-chave)

- logo-left-align
- logo-scale-15
- brand-block-flex-start
- brand-caption-left
