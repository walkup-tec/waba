# Fix: botão Criar assinante sem ação

## Contexto

Usuário master preenchia o formulário **Novo assinante** em Admin · Assinantes e clicava **Criar assinante** — nada acontecia (sem toast, sem requisição).

## Causa

O botão usava `type="submit"` com validação HTML5 nativa (`required`, `minlength`, `type="email"`). Em tema escuro, o tooltip de validação do browser pode não aparecer; o evento `submit` (e o handler JS) não dispara.

## Solução

- Formulários com `novalidate`
- Botões **Criar assinante** e **Criar cupom** alterados para `type="button"` (padrão do resto do app)
- Handlers de `click` explícitos + `submit` com `preventDefault` (Enter nos campos)
- Mensagens de validação individuais via `showToast`

## Arquivos

- `index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-06-21-fix-criar-assinante-btn`

## Validar

1. Admin · Assinantes → preencher formulário → **Criar assinante**
2. Deve mostrar "Criando…" e toast de sucesso ou erro da API
3. Senha com menos de 6 caracteres deve exibir toast claro
