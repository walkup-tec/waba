# LOG: Chrome pedindo salvar senha com dados aleatórios

## Pedido

Ao sair do sistema, o navegador (Chrome) às vezes pede para salvar credenciais com valores aleatórios — ex.: usuário `25/06/2026 até 26/06/2026` (período do dashboard).

## Causa (nosso sistema + heurística do navegador)

1. **Formulário de login permanece no DOM** após autenticação (`#waba-login-form` com `type=password`), e o Chrome continua escaneando a página.
2. **Campos de texto sem `autocomplete`** (ex. `#date-range`) podem ser interpretados como "usuário".
3. **Campos `type=password` de API/tokens/admin** sem `autocomplete="new-password"` são tratados como senha de login.

Não é bug do Chrome sozinho — falta sinalização HTML correta no app.

## Solução

1. **`syncWabaCredentialAutocompleteState`** — ao desbloquear app: login `inert`, `autocomplete=off`, limpa senha, remove `name`; ao bloquear: restaura `username` / `current-password`.
2. **`#date-range`** — `autocomplete=off`, `data-lpignore`, nome não genérico.
3. **Senhas não-login** (Meta, admin usuários) — `autocomplete="new-password"`.
4. **Formulário suporte** — `autocomplete="off"`.

Marker: `DEPLOY-2026-06-26-browser-password-manager-guards`

## Validar

1. Login → usar dashboard (alterar período) → navegar para Admin/Financeiro → sair ou trocar aba: Chrome **não** deve oferecer salvar com data como usuário.
2. Tela de login continua oferecendo salvar credenciais reais após logout.

## Palavras-chave

`password manager`, `autocomplete`, `date-range`, `waba-login-form`, `inert`, Chrome salvar senha
