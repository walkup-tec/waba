# LOG — Disparo Cloud: não enviar weblink de exemplo da Graph (131053 / 403)

## Contexto do pedido

Campanha **Jandira 2** (`jandira_quantun_2`) disparou 1159 destinos. Ninguém recebeu no WhatsApp. Quatro números conferidos no celular:

- `5551999666841`
- `5551998335401`
- `5551981077770`
- `5551997979224`

JSON de produção (SSH no container `waba_waba_disparador`): Graph aceitou (`status: sent`, `wamid` presente) e o webhook marcou **todos** os 1159 leads com `metaStatus: failed`, `errorCode: 131053`, texto `Downloading media from weblink failed with http code 403`.

Intake `368d053b-d59b-4eed-a235-fe9e9f32c68c` (1990 planejados) / broadcast `26d33b09-8868-41dd-af78-afd59e7982f2` (`done`, 1159 sent, 0 failed no POST Graph).

## Causa raiz

`resolveHeaderMedia` enviava `{ link: httpsUrl }` quando o `header_handle` começava com `https://`. Depois de **Atualizar da Meta**, a Graph troca o handle `4::…` por URL lookaside/fbcdn. Essa URL é exemplo; a Meta tenta baixar de novo no envio e recebe HTTP 403.

`wamid` não prova entrega. Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/ (131053). Envio de mídia: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/ — o caminho estável é `POST /{PHONE_NUMBER_ID}/media` e o parâmetro do template com `{ id }`, não `{ link }` de exemplo.

Confiança: **Alta**. Os quatro destinos e o total `meta { failed: 1159 }` batem no mesmo erro.

## Solução

1. Classificar URL lookaside/fbcdn/facebook como **não weblink**.
2. Se houver arquivo local (handle original **ou** id do template), fazer upload Cloud API e enviar `{ id }`.
3. Sem arquivo local e com URL de exemplo: **abortar o disparo** com aviso 403, antes de milhares de POST.
4. Na criação e no sync, copiar o preview local do handle antigo para o id do template e para o handle novo.
5. Relatório operacional: código 131053 vira texto em português (weblink 403), mesmo se a Meta mandou inglês.

Não reenviar a Jandira 2 automaticamente (1159 mensagens). Depois do deploy: novo Disparo Cloud. Se o preview local só existir no handle `4::` antigo, sincronizar o template (passa a alias) ou reenviar a mídia do cabeçalho.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-header.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-header-preview.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-send-issues.ts`

## Como validar

```bash
npm run test:broadcast-header
npm run test:meta-lab-report
npm run build
```

No servidor, depois do Redeploy: um Disparo Cloud de template com cabeçalho de mídia deve recusar weblink lookaside ou enviar `media id`. Não usar `sendText`.

## Palavras-chave

`131053`, `weblink`, `lookaside`, `jandira_quantun_2`, `header_handle`, `media id`
