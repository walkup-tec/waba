# LOG: Meta Ativos - separar etapas 1, 2 e 3

## Contexto

A etapa "Conectar com Facebook" ainda agrupava os blocos de Token de aplicativo e Token permanente. Solicitado separar cada bloco como etapa propria na sanfona.

## Solucao

1. Etapa 1 mantida apenas com "Conectar com Facebook".
2. Etapa 2 criada para "Token de aplicativo" (App ID/App Secret + gerar token + apps criados).
3. Etapa 3 criada para "Token permanente (System User)".
4. Etapas seguintes mantidas: Integracao API oficial e Integrar numeros WhatsApp.
5. Lógica da sanfona atualizada para 5 etapas com desbloqueio sequencial.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Validacao

1. Abrir `API Meta - Ativos`.
2. Verificar que etapa 1 nao contem os campos de token.
3. Confirmar que etapa 2 e 3 aparecem como etapas separadas e desbloqueiam em ordem.

## Palavras-chave

`meta-ativos`, `sanfona`, `etapas`, `token-aplicativo`, `system-user`
