# LOG — Card fantasma ao adicionar número

## Contexto

Ao clicar + para adicionar número em um portfólio, aparecia um card **Portfólio empresarial** sem ID, Página e WABA.

## Causa

`exchangeCodeAndStore` grava `pending_token` com Business/WABA nulos para não sobrescrever o portfólio já `connected`. A listagem incluía essa linha; a UI caía no título genérico.

## Correção

- Listagem só mostra card com Business, WABA, página ou número.
- `pending_token` sem IDs não consulta a Graph.
- Depois do claim no BM existente, o pending vazio é desconectado.
- O front filtra o mesmo caso.

## Como validar

```bash
npm run test:meta-portfolio
npm run test:meta-phase3
```

Após Redeploy: + em um portfólio real não cria o card vazio. O número novo continua no portfólio escolhido.

Marker: `DEPLOY-2026-09-02-114300-portfolio-fantasma`

## Palavras-chave

portfólio empresarial, pending_token, adicionar número, card fantasma, ghost
