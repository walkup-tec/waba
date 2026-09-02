# LOG — Botão silencioso Bloquear nos templates Meta

## Contexto do pedido

Por padrão, todos os templates enviados à Meta devem incluir um segundo botão no corpo da mensagem, com rótulo **Bloquear**, do tipo Personalizado. O usuário do painel não vê nem configura esse botão. Ele existe só no payload Graph.

Ficam dois botões no envio:

1. O que o usuário configurou no template (hoje: URL).
2. O que o backend acrescenta: `QUICK_REPLY` **Bloquear**.

## Comandos / ações

- Estudo da doc oficial de componentes: agrupamento de `QUICK_REPLY` vs URL/PHONE.
- Injeção no `createFromAuth` após validar o DTO do usuário.
- Ocultação no DTO público, no preview e no few-shot da IA.
- Testes unitários do helper + fase 7 (POST Graph) + few-shot.

## Solução implementada

1. Helper `appendSilentBlockButton`: garante um componente `BUTTONS`, preserva os botões do usuário, acrescenta `{ type: "QUICK_REPLY", text: "Bloquear" }` se ainda não existir, e agrupa não-QR primeiro / QR depois (regra da Meta).
2. `createFromAuth` envia e persiste os componentes já com Bloquear (fonte da verdade = Graph).
3. `toPublicTemplate` remove Bloquear da listagem/GET. Se só restava esse botão, some o componente `BUTTONS`.
4. Preview **Seu modelo** ignora `QUICK_REPLY` Bloquear.
5. Few-shot Utility não usa Bloquear como CTA do exemplo.
6. Prompt da IA continua sem pedir QUICK_REPLY — o botão não entra no formulário.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-template-silent-block-button.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-silent-block-button.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-approved-examples.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phase7.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `index.html` (preview)
- `src/deploy-marker.ts`
- `docs/project-memory/02-BUSINESS_RULES.md`, `04-INTEGRATIONS.md`, `05-DECISIONS.md`, `06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

```bash
node --require ts-node/register --test src/integrations/meta-whatsapp/meta-whatsapp-template-silent-block-button.test.ts
npm run test:meta-phase7
npm run test:meta-template-ai
```

No painel: criar/enviar template → Visualizar mostra só o botão do usuário. Na Graph/WhatsApp Manager o modelo tem URL + Bloquear.

Templates já aprovados na Meta **não** ganham Bloquear sozinhos; só criações novas pelo backend.

## Observações de segurança

- Sem segredos no log.
- Isolamento por tenant inalterado.
- DTO público não expõe o botão silencioso.

## Palavras-chave

bloquear, quick_reply, personalizado, template buttons, grouping URL QR, createFromAuth, silent button
