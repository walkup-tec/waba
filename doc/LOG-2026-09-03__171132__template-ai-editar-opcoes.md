# LOG — Editar as 3 opções geradas pela IA

## Contexto do pedido

Depois de Gerar as 3 opções Utility, o operador precisava ajustar o texto antes de mandar para a Meta. Os cards eram só leitura e o POST usava o corpo original da análise.

## Ações executadas

- Cada card ganhou **Editar** → textarea → **Salvar**.
- `POST /integrations/meta/whatsapp/templates/ai/option` grava o corpo na análise do tenant.
- `submit-all` aceita `optionBodies` e persiste antes de criar na Graph.
- Validação: texto obrigatório, até 1024 caracteres, variáveis `{{n}}` em sequência.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-option-edit.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `index.html`

## Como validar

```bash
npm run test:meta-template-ai
```

No Laboratório: Gerar → Editar opção → Salvar → Enviar para META. O BODY na Graph deve ser o texto salvo.

Preview local: `http://127.0.0.1:43183/?ui-preview=template-ai`

## Segurança

`updateResult` e save filtram `tenant_id` + `connection_id` + `analysis_id`. Sem segredos no log.

## Palavras-chave

template, ia, editar, salvar, opções, utility, submit-all, graph
