# Remover edição individual de template no front

## Contexto do pedido

O usuário pediu para apagar do frontend o bloco **«Opções avançadas de edição individual»** (formulário manual Nome / Idioma / Categoria / Cabeçalho / Corpo / Exemplos / Rodapé + botão **Criar template**). O cadastro de templates passa a ser só pelo assistente de IA (texto base → 3 opções → Enviar para Meta).

## Ações executadas

- Removido o `<details class="meta-tpl-manual-editor">` e o CSS correspondente em `index.html`.
- Removida a função `window.wabaCreateMetaTemplateLab`.
- Geração IA passou a enviar idioma fixo `pt_BR` (o campo de idioma existia só nesse formulário).
- Marker de deploy atualizado para validar no EasyPanel após Redeploy.

## Solução implementada

1. O painel de Templates Cloud permanece com: select de portfólio, workspace IA em duas colunas, lista/sync/filtro, visualizar e teste.
2. `POST /integrations/meta/whatsapp/templates` continua no backend; o front da IA usa `submit-all`.
3. Preview local `?ui-preview=template-ai` não depende mais do formulário removido.

## Arquivos criados/alterados

- `index.html` — HTML, CSS e JS do formulário manual
- `src/deploy-marker.ts` — `DEPLOY-2026-09-01-170000-sem-edicao-individual-template`
- `doc/LOG-2026-09-01__170000__remove-edicao-individual-template.md`
- `doc/memoria.md`

## Como validar

- Preview: `http://127.0.0.1:43123/?ui-preview=template-ai` — o bloco «Opções avançadas de edição individual» não deve aparecer.
- Em produção, após Redeploy `waba_disparador`: `GET /health` → `deployMarker` = `DEPLOY-2026-09-01-170000-sem-edicao-individual-template`.

## Observações de segurança

Nenhuma credencial alterada. Endpoint de criação individual permanece no servidor; só a UI foi retirada.

## Palavras-chave

`meta-tpl-manual-editor`, edição individual, criar template, `wabaCreateMetaTemplateLab`, templates Utility IA
