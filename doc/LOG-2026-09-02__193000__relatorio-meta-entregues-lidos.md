# LOG — Relatório Meta com Entregues e Lidos zerados

## Contexto do pedido

Campanha Jandira finalizou em 100% com «relatório gerado com dados da Meta»: 1.990 leads, 1.156 enviados, 0 entregues, 0 lidos, 2 falhados, 1.154 pendentes.

## Causa raiz

A Graph devolve 200 só como **aceite**. Entregue e lido vêm do webhook `statuses` (`id` = wamid). Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ e https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/

No disparo, cada lead regrava `meta-whatsapp-broadcasts.json` com o objeto em memória (`metaStatus=accepted`). Isso **apagava** delivered/read que o webhook já tinha gravado. O fechamento usava `updatedAt` e fechava 15 min após o envio, sem exigir entregue/lido. O snapshot do relatório não era mais atualizado.

## Solução implementada

1. `saveBroadcastCampaign` faz merge e preserva o maior status da Meta já persistido.
2. Webhook casa por wamid ou `recipient_id`.
3. Janela quieta de 15 min só depois de algum entregue/lido; sem isso espera o teto de 2 h.
4. Relatório `meta_lab` já finalizado é atualizado se chegar webhook novo (sem mexer em bônus).

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-report.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-lab-report.test.ts`

## Como validar

```bash
npm run test:meta-lab-report
```

Campanha nova: Entregues deve subir com o webhook `delivered`. Jandira só corrige se o JSON do disparo ou um webhook novo ainda trouxer delivered/read; o evento antigo processado sem match não é reenviado pela Meta.

## Segurança

Sem segredos. Fórmulas do relatório Alternativa/não-Lab não mudam.

## Palavras-chave

relatorio, entregues, lidos, webhook, statuses, wamid, jandira, meta_lab
