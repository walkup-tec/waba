# Fix — botão «Criar assinante» travado (Admin · Assinantes)

## Contexto

Usuário reportou que o botão **Criar assinante** no formulário master não respondia. No print, o campo **CPF ou CNPJ** estava vazio; demais campos preenchidos.

## Causa raiz

1. **Validação silenciosa** — CPF/CNPJ obrigatório gerava apenas toast no canto da tela; fácil de não perceber.
2. **Botão `disabled` preso** — após tentativa anterior com erro de rede/timeout, o botão podia ficar em «Criando…» com `disabled`; cliques não disparam evento (sensação de «sem ação»).
3. **Listener duplicado** — botão `type="button"` com `click` + `submit` no form; padronizado para `type="submit"` e apenas handler de `submit`.

## Solução

- Mensagem de erro **inline** (`#admin-subscriber-create-error`) acima do botão.
- Campo inválido com destaque (`admin-field-invalid`) + `focus` + scroll.
- `resetAdminSubscriberCreateFormState()` ao abrir aba `admin-assinantes`, na inicialização da UI e após sucesso.
- `finally` garante `removeAttribute("disabled")` e texto «Criar assinante».
- Erro de e-mail duplicado destaca o campo e-mail.
- Limpeza de erro ao digitar nos inputs.

## Arquivos alterados

- `index.html` — CSS, HTML do formulário, helpers JS, `createAdminSubscriber`, `initAdminSubscribersUi`, abertura da aba.

## Como validar

1. Admin → Assinantes → preencher tudo **exceto CPF** → clicar **Criar assinante**.
   - Deve aparecer texto vermelho acima do botão e borda no campo CPF.
2. Preencher CPF válido → criar assinante com sucesso → formulário limpo e botão habilitado.
3. Tentar e-mail já cadastrado → mensagem inline + destaque no e-mail.
4. Sair e voltar na aba Assinantes → botão nunca deve ficar em «Criando…».

## Palavras-chave

`admin-subscriber-create-btn`, `createAdminSubscriber`, `resetAdminSubscriberCreateFormState`, `admin-assinantes`, CPF obrigatório
