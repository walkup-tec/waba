# Card do portfólio sem Página/nome da Meta

## Contexto

O card **Portfólio empresarial** mostrava só ID e WABA. Página vinha `—`,
título genérico e iniciais PE. Exemplo: ID `3887084984861602`,
WABA `405969599269224`.

## Causa

A Graph devolve o Business com o nome padrão «Portfólio empresarial».
O mapper descarta esse nome genérico (correto) e o diretório de
`me/businesses` exigia `name` preenchido — então a Página que vinha no
mesmo payload era jogada fora. O nome da WABA também não era usado.

## Solução

- Usar o nome da WABA quando o Business é genérico.
- Manter o card de `me/businesses` se houver Página, mesmo com nome genérico.
- Resolver o nome da Página pelo ID no hydrate.
- Persistência da última leitura Graph (nome/página/WABA) para não apagar o
  card se a Meta vier vazia. O nome do formulário Editar continua sem cobrir a Graph.
- Fallback `GET` combinado `id,name,profile_picture_uri,primary_page`.

Doc oficial: https://developers.facebook.com/docs/marketing-api/reference/business/

## Validação

```bash
npm run test:meta-portfolio
npm run build
```

No Laboratório: card deve mostrar nome (WABA ou BM), Página e foto.
`GET /health` → `DEPLOY-2026-09-01-164000-portfolio-pagina-nome-meta`

## Segurança

Sem token no front. Foto continua em cache local.

## Palavras-chave

portfolio, primary_page, portfólio empresarial, WABA name, me/businesses
