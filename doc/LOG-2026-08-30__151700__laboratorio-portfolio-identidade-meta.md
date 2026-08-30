# LOG — Identidade do portfólio a partir da Meta

## Contexto do pedido

No Laboratório, os cards de portfólio mostravam o rótulo genérico "Portfólio empresarial", logo da Meta, página "—", e um segundo card com o ID da WABA (`1247508354180311`) no lugar do Business Manager.

O usuário pediu para trazer da Meta: foto de perfil do portfólio, nome do portfólio, ID do portfólio e página principal.

## Ações executadas

- Investigação do GET `/portfolio` e do mapper Graph.
- Hydrate passou a buscar identidade na WABA (`owner_business_info`) e no Business (`primary_page`, `owned_pages`, `picture`), com retry se os campos ricos falharem.
- Dedupe de cards cujo ID é a WABA de outro portfólio.
- Testes em `npm run test:meta-portfolio` (31 ok).
- `npx tsc` só nos ficheiros alterados + `node scripts/copy-index-html.mjs`.

## Solução implementada

1. `GET /{waba-id}?fields=id,name,owner_business_info{...}` para nome e Business ID real.
2. `GET /{business-id}` com `name`, `profile_picture_uri`, `picture`, `primary_page`, `owned_pages`.
3. Se a página ou a foto faltarem: `/{business-id}/owned_pages` e `/{business-id}/picture?redirect=0`.
4. Nunca usar o ID da WABA como Identificação do portfólio.
5. Título genérico da Meta é ignorado; a UI usa o nome da página quando o BM não tem nome próprio.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`
- `index.html` / `dist/index.html`
- `dist/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.js`
- `dist/integrations/meta-whatsapp/meta-whatsapp-connection.service.js`
- `dist/deploy-marker.js`

## Como validar

- `npm run test:meta-portfolio`
- Após Redeploy EasyPanel: `GET /health` deve conter `DEPLOY-2026-08-30-151700-master-laboratorio-portfolio-identidade`
- No Laboratório: card Drax com nome/foto/página da Meta e ID `1041827648719609` (não `1247508354180311`); Walkup como outro card se a conexão existir.

## Observações de segurança

- URL de foto com `access_token` é descartada.
- Token da Meta não vai na resposta JSON.

## Palavras-chave

portfolio, identidade, owner_business_info, owned_pages, profile_picture_uri, WABA, Business Manager, Laboratorio
