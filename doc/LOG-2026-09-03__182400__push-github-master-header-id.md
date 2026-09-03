# LOG — Push GitHub master (header local + template aprovado)

## Contexto

Usuário pediu **sobe a correção push** após o fix do 131053 em template aprovado da biblioteca.

## O que este push leva

Tip `796f537` (+ marker):

1. Disparo Cloud só `{ id }` — nunca weblink lookaside.
2. Alias de arquivo local entre templates que compartilham o mesmo lookaside.
3. `POST /templates/:id/header-media` + campo na UI do Disparo Cloud para anexar a mesma foto.
4. Abort 131053 sem entrega (`35400d7`) e voids da Jandira 2.
5. Marker `DEPLOY-2026-09-03-182400-header-id-template-aprovado`.

Não entrou: pasta `C:\Users\Usuario\npm-cache/`.

## Dist no GitHub

O tip anterior tinha `src/` novo e `dist/deploy-marker.js` ainda em `171800`. EasyPanel copia `dist/` da imagem → Redeploy sozinho não bastava.

Corrigido: `npm run build` + push do `dist/` com marker `182400` e rotas `header-media` / never-weblink.

## Palavras-chave

github, master, deploy, 131053, header-media, template aprovado
