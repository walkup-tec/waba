# LOG — Relatório automático só se o atendente tem Laboratório

## Contexto do pedido

Os relatórios das campanhas atendidas por quem **não** tem acesso ao Laboratório continuam iguais: o operacional preenche enviados/entregues/lidos/falhados e finaliza. Não há cliques.

Para campanhas atendidas por quem **tem** Laboratório, os indicadores passam a vir da Meta (webhooks Cloud) e o clique no botão URL (`/s/:slug`) entra no relatório. O critério é o **atendente** (`assignedOperacionalEmail`), não o plano oficial/alternativa do assinante.

## Ações executadas

- Predicado compartilhado `campaignAttendedByLaboratorioStaff`.
- Disparo Cloud vincula uma campanha do assinante atendida no Laboratório; o webhook atualiza sent/delivered/read/failed; após janela quieta o relatório fecha sozinho.
- Operacional sem Laboratório: PUT de relatório manual inalterado. Operacional com Laboratório: formulário bloqueado.
- UI: card Cliques + taxa de cliques só quando `source=meta_lab` / campanha do lab.

## Solução

1. Operacional/suporte: menus do Laboratório no cadastro. Master em produção: só Mozart.
2. Sem atribuição, usa `startedByEmail`. Sem os dois: relatório manual.
3. Quiet 15 min após o último evento Meta, teto 2 h após o fim do envio.
4. Cliques só persistem em relatório `source: meta_lab`. Relatório manual não grava cliques.

## Arquivos

- `src/disparos/waba-campaign-laboratorio-attended.ts`
- `src/disparos/waba-campaign-report-finalize.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-report.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook.service.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `index.html` (dashboard + Disparo Cloud)

## Como validar

```bash
npm run test:meta-lab-report
npm run build
```

Funcional: disparo Cloud numa campanha atribuída a operacional com menu do Laboratório → status «Coletando relatório da Meta» → após webhooks, relatório com cliques. Campanha na fila de operacional sem Laboratório → formulário manual, sem cliques.

## Segurança

Sem tokens da Meta em log. Relatório automático não aceita PUT manual.

## Palavras-chave

laboratorio, atendente, assignedOperacionalEmail, meta_lab, cliques, relatório automático, disparo cloud
