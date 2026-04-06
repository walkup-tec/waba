# LOG — UX Meta: status visível de conexão

## Contexto

Após o fluxo de Embedded Signup da Meta, não havia confirmação visual clara para o usuário saber se a conexão concluía com sucesso.

## Solução implementada

1. Adicionado badge ao lado do botão **Conectar com Meta** com ícone de check.
2. Badge exibe `Conectado: <nome>` quando houver nome do perfil/negócio retornado pela Meta.
3. Fallbacks de identificação: `Meta ID <userId>` e `WABA <wabaId>`.
4. Badge é ocultado em falha/reinício do fluxo.
5. Checklist API Meta recebeu etapa inicial **Conexão Meta concluída** (primeira etapa) e contador atualizado para `0/7`.
6. Etapa é marcada automaticamente como concluída no sucesso do exchange/code + aplicação de token/WABA.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Validação

- Clicar em **Conectar com Meta**.
- Concluir fluxo OAuth/Embedded Signup.
- Verificar badge verde com check e nome/identificação ao lado do botão.
- Verificar checklist com etapa **Conexão Meta concluída** marcada como **Concluído**.

## Segurança

- Nenhum segredo novo em frontend.
- Apenas feedback visual de estado da sessão já existente.

## Palavras-chave

`meta-embedded-signup`, `checklist-api-meta`, `status-conectado`, `badge-check`
