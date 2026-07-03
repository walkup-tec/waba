# Front — Admin Usuários: WhatsApp e Segmento

## Contexto

Foi solicitado ajustar **apenas o front** da tela `Admin · Usuários`:

- adicionar campo de **WhatsApp**;
- manter o **E-mail** no formulário;
- quando o tipo de usuário for **Operacional**, exibir também o select **Segmento** com opções:
  - `Bets`
  - `Todos`

O backend ficará para a próxima etapa.

## Alterações executadas

### Formulário de criação

- Adicionado campo visual `WhatsApp`
- Mantido `E-mail`
- Mantido `Disparos atendidos` para `operacional`
- Adicionado select `Segmento` para `operacional`

### Modal de edição

- Adicionado campo visual `WhatsApp`
- Adicionado select `Segmento` para `operacional`

### Comportamento de UI

- `Segmento` aparece apenas quando o papel é `operacional`
- Máscara de WhatsApp aplicada no create e no edit
- Reset de valores do create após sucesso

## Arquivos alterados

- `index.html`
- `dist/index.html`
- `doc/memoria.md`

## Comandos executados

- `npm run build`

## Validação rápida

1. Abrir `Admin · Usuários`
2. Confirmar no create:
   - `Nome`, `E-mail`, `WhatsApp`, `Senha`
3. Trocar `Tipo de usuário` para `Operacional`
4. Confirmar que aparecem:
   - `Disparos atendidos`
   - `Segmento` com `Bets` e `Todos`
5. Abrir edição de um usuário operacional
6. Confirmar os mesmos campos no modal

## Observações

- Nesta etapa, a mudança é **somente de front**
- O campo `WhatsApp` e o select `Segmento` foram preparados visualmente e no payload do front, mas a persistência/uso backend ainda depende da próxima fase

## Palavras-chave

`admin-user-whatsapp`, `admin-user-operacional-segment`, `Admin Usuários`, `front only`, `operacional`
