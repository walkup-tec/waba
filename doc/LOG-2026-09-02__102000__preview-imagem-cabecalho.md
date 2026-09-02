# LOG — Preview do template mostra a imagem do cabeçalho

## Contexto

O modal Visualizar mostrava o placeholder «Cabeçalho de imagem» em vez da imagem que o usuário enviou.

A Meta só guarda `header_handle` no template, não uma URL pública. Por isso o preview não tinha o arquivo.

## Solução

- No upload da mídia, o backend grava uma cópia local em `/app/data/meta-whatsapp/template-headers/` (isolada por tenant).
- GET autenticado `/integrations/meta/whatsapp/templates/:id/header` devolve essa cópia.
- O DTO público inclui `headerPreviewUrl` (arquivo local ou HTTPS que a Graph devolver no sync).
- O preview usa `<img>` / `<video>`. Se ainda não houver arquivo gravado, tenta o arquivo ainda selecionado no formulário.

Templates já enviados antes desta gravação só mostram a imagem se a Graph tiver URL HTTPS no handle ou se o arquivo ainda estiver no campo de mídia.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-header-preview.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `index.html`

## Como validar

Enviar template com imagem → Visualizar: o bubble deve mostrar a foto, não o texto «Cabeçalho de imagem».

## Palavras-chave

preview, cabeçalho, imagem, header_handle, Visualizar
