# LOG - Fix de logo/favIcon (favicon-light asset)

## Contexto
O usuário reportou que a logo não aparecia no frontend.

No nosso `index.html`/`dist/index.html` o logo estava apontando para:
- `https://draxsistemas.com.br/favicon.ico`

Ao validar o recurso, ele retornava `404`, então o `<img>` e o favicon falhavam ao carregar.

## Comandos executados / ações
- Validação do endpoint do favicon:
  - `curl.exe -I https://draxsistemas.com.br/favicon.ico` (retornou `404`)
- Descoberta do asset correto no HTML da DRAX:
  - `assets/media/favicon-light.png`
- Atualização do frontend para usar o asset correto e ajustar tamanho:
  - troca do `<link rel="icon">`
  - troca do `<img src=...>` do header
  - ajuste CSS para `20x20`
- Build para copiar `index.html` -> `dist/index.html`:
  - `npm run build`

## Solução implementada (passo a passo)
1. Substituí `favicon.ico` por `favicon-light.png`:
   - `https://draxsistemas.com.br/assets/media/favicon-light.png`
2. Atualizei o header para usar o mesmo `src` no `<img>`.
3. Confirmei que o HTML servido pelo backend contém `favicon-light`:
   - `Invoke-WebRequest ... | Content.Contains('favicon-light')`

## Arquivos criados/alterados
- Alterado: `index.html`
- Alterado por build: `dist/index.html`
- Criado: `doc/LOG-2026-03-20__072627__ui-logo-favicon-fix.md`

## Como validar
1. Atualizar/recarregar a página no navegador (ideal: *hard refresh* / Ctrl+F5).
2. Verificar Network:
   - `favicon-light.png` deve retornar `200`.

## Observações de segurança
- Nenhuma chave/segredo envolvido.

## Itens para evitar duplicação (keywords)
- `favicon.ico 404`
- `favicon-light.png`
- `brand-logo`

