# LOG — Aquecedor runtime com botões mínimos

## Contexto

Solicitado simplificar o bloco de ações do Aquecedor após iniciar, mantendo apenas:
- `Pausar Aquecedor`
- `Diagnóstico`

## Ações executadas

1. Atualizado `index.html` no bloco de ações do runtime do Aquecedor:
   - removidos botões `Envio teste` e `Criar mensagem teste`;
   - alterado rótulo de `Parar Aquecedor` para `Pausar Aquecedor`.
2. Mantida a lógica de visibilidade:
   - ao iniciar, botão de iniciar sai da tela;
   - com motor ativo, ficam apenas `Pausar Aquecedor` + `Diagnóstico`.
3. Executado `npm run build`.
4. Reiniciados os dois ambientes locais (`3000` e `3010`).

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validação

- Abrir aba Aquecedor.
- Clicar em `Iniciar Aquecedor`.
- Confirmar presença apenas dos botões:
  - `Pausar Aquecedor`
  - `Diagnóstico`

## Segurança

- Sem exposição de segredos.
- Alteração apenas de UI/fluxo de botões.

## Palavras-chave

`aquecedor-runtime`, `pausar-aquecedor`, `diagnostico`, botoes-minimos
