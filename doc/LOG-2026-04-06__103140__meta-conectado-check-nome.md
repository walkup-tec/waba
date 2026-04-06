# LOG — Meta conectado com check + nome

## Contexto

Necessário exibir confirmação visual explícita após integração Meta concluída com sucesso.

## Solução aplicada

1. Reativado badge ao lado do botão **Conectar com Meta**.
2. Badge mostra ícone de check e texto `Conectado: <nome>` quando disponível.
3. Fallback de identificação: `Meta ID <id>` e `WABA <id>`.
4. Badge oculta em falha/reinício da conexão para evitar estado antigo.
5. Build executado para sincronizar `dist/index.html`.

## Arquivos alterados

- `index.html`
- `dist/index.html`

## Como validar

1. Abrir **API Meta - Ativos**.
2. Concluir Embedded Signup.
3. Verificar badge de sucesso com check + nome/ID ao lado do botão.

## Segurança

- Sem exposição de segredos.
- Mudança apenas de feedback visual no frontend.

## Palavras-chave

`meta-connected-badge`, `embedded-signup`, `check-nome-perfil`
