# LOG: Página vendas SOMA — pasta local e repositório GitHub

## Contexto
O usuário definiu o repositório oficial da landing de vendas da SOMA como `https://github.com/walkup-tec/Pagina-vendas-soma.git` e a pasta local como `D:\SOMA Promotora\Pagina-Vendas`. O remoto estava vazio e a pasta local estava vazia; o código existia em `D:\SOMA Promotora\soma-credit-sales`.

## Ações executadas
1. Cópia do projeto (excluindo `node_modules`, `.git`, `dist`) de `soma-credit-sales` para `Pagina-Vendas` via `robocopy`.
2. Ajustes no destino:
   - `package.json`: `name` → `pagina-vendas-soma`
   - `README.md`: link para o repositório GitHub
   - `.gitignore`: `!.env.example` para versionar o template (`.env.*` ignorava o exemplo)
3. `git init -b main`, `remote add origin`, commit inicial, `git push -u origin main`.
4. `npm install` e `npm run build` em `Pagina-Vendas` (build OK).

## Arquivos alterados (fora do repo Waba)
- `D:\SOMA Promotora\Pagina-Vendas\` — projeto completo + `.git`

## Arquivos alterados (repo Waba)
- `doc/memoria.md` — caminhos e resumo
- `doc/LOG-2026-03-29__223000__pagina-vendas-soma-repo-local-github.md` — este arquivo

## Como validar
- Abrir `D:\SOMA Promotora\Pagina-Vendas` e rodar `npm run dev` ou `npm run build`.
- Conferir o remoto: `https://github.com/walkup-tec/Pagina-vendas-soma` (branch `main` com código).

## Segurança
- `.env` permanece ignorado; apenas `.env.example` (placeholders) foi commitado.
- Não documentar chaves reais.

## Palavras-chave
pagina-vendas-soma, Pagina-Vendas, walkup-tec, soma-credit-sales, landing SOMA, Vite React
