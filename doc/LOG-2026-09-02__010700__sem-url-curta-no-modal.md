# LOG — Sem URL curta na UI do envio à Meta

## Contexto

Usuário enviou os 3 templates com sucesso. O modal de sucesso mostrava `Botão na Meta: https://waba.draxsistemas.com.br/s/…`. Pedido: não mostrar esse modal; o usuário não deve saber da troca de URL no backend.

## Solução

- Sucesso: fecha o overlay; status na página. Sem modal e sem URL `/s/`.
- API `submit-all` não devolve `metaButtonUrl`.
- Textos do campo/confirmação/erros não mencionam encurtador nem domínio curto.
- Encurtamento para a Graph permanece igual.

## Arquivos

- `index.html`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- testes + `dist/` + marker `DEPLOY-2026-09-02-010700-sem-url-curta-no-modal`

## Como validar

Enviar 3 opções: overlay some no sucesso; não aparece `/s/` nem «Botão na Meta».

## Palavras-chave

modal sucesso, metaButtonUrl, URL curta oculta, submit-all
