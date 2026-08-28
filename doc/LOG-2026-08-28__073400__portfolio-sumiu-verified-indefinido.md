# Portfólio sumiu no Laboratório (`verified` indefinido)

## Contexto

O card Portfólio e os números não apareciam; as etapas ficavam em Conectar. Esperado: portfólio integrado + chips.

## Causa

Em `metaTpRenderPortfolio` a lista usava a variável `verified` sem declará-la. Com números na resposta, o JS lançava `ReferenceError`, o `catch` de `metaTpLoadPortfolio` escondia de novo `#meta-tp-portfolio`.

## Solução

Restaurar `const verified = metaTpEsc(item.verifiedName || "Sem nome de exibição")`.

## Arquivos

- `index.html`

## Palavras-chave

metaTpRenderPortfolio, verified, ReferenceError, portfolio-hidden
