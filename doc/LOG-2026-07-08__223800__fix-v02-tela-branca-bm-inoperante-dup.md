# Fix V02 tela em branco — duplicate bmInoperanteBtn

## Contexto
`http://localhost:3012/version-02/` carregava fundo escuro sem UI.

## Causa
`SyntaxError: Identifier 'bmInoperanteBtn' has already been declared` em `index.html`, função `closeAdminCampanhasDetailModal()` — duas declarações `const bmInoperanteBtn` no mesmo escopo (linhas ~30233 e ~30243). Erro interrompia todo o JS inline da página.

## Correção
Removida a segunda declaração duplicada; reutiliza a variável já obtida no início da função.

## Validar
1. Hard refresh em `http://localhost:3012/version-02/` (Ctrl+Shift+R)
2. Tela de login DRAX deve aparecer
3. Console do browser sem SyntaxError

## Arquivos
- `index.html`
