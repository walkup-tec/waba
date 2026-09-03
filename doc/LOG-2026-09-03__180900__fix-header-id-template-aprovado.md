# LOG — Disparo Cloud: arquivo local + `{ id }` em template aprovado

## Contexto do pedido

O operacional usa a biblioteca de templates já aprovados. A mesma imagem foi para 3 templates. Um disparo novo em outro template repetiu 131053. Hipótese do usuário: a Meta recusa porque reconhece o mesmo byte/id.

## Causa real

Não. A Meta aceita a mesma foto em vários templates. O webhook é 131053 *Downloading media from weblink failed with http code 403*.

Depois de Atualizar da Meta, o `header_handle` vira URL lookaside. Templates com a mesma amostra passam a apontar para **o mesmo link de exemplo**. Esse link não é arquivo. Enviar `{ link }` falha. O segundo template “novo” caía no mesmo weblink.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/ e https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/

## Solução

1. Classificar cabeçalho só como `upload` (bytes locais) ou `missing`. Sem weblink.
2. Guardar o arquivo com aliases: handle, id local, meta id, `nome::idioma`. Se outro template já tiver o lookaside no disco, reusa.
3. `POST /integrations/meta/whatsapp/templates/:templateId/header-media` grava a mesma foto num template já aprovado (não recria o modelo).
4. Disparo Cloud: se faltar arquivo, a tela pede “Enviar a mesma foto” e bloqueia o início.
5. Preview público não usa mais URL lookaside como se fosse mídia válida.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-header-preview.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-header.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/index.ts`
- `index.html`

## Como validar

```bash
npm run test:broadcast-header
npm run test:meta-phase7
```

No Disparo Cloud, template aprovado com mídia: ou o arquivo já está no servidor, ou aparece o campo para enviar a mesma foto. Não iniciar lote sem isso.

## Palavras-chave

131053, lookaside, template aprovado, mesma imagem, header-media, media id
