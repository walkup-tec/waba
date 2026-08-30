# LOG — Ativar número pendente no Laboratório

## Contexto do pedido

O número Walkup `+55 11 95213-7761` aparecia como Pendente, sem campo de PIN nem botão para ativar na Meta.

## Comandos / ações

- Investigação da linha de número (`canActivate`, `registerPhoneFromAuth`, HTML do Laboratório)
- UI de ativação na linha pendente + registro com o token do portfólio correto
- `npm run test:meta-portfolio`
- `node scripts/copy-index-html.mjs`

## Solução implementada

1. Número pendente sempre mostra PIN de 6 dígitos + **Ativar** na mesma linha (telefone, BR Brasil, nome do grupo, status).
2. `canActivate` no fallback local fica verdadeiro quando a conexão ainda não está `connected`.
3. `POST /phone-numbers/register` usa `connectionId` (ou o `phoneNumberId`) para pegar o token do Walkup, não o da primeira conexão (Drax).
4. Não usa o nome da WABA como Página; o nome do grupo na linha do número é o `verifiedName` / título do portfólio.

## Arquivos criados/alterados

- `index.html`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`
- `doc/memoria.md`
- este LOG

## Como validar

- `npm run test:meta-portfolio`
- Após push + Redeploy: no Laboratório, selecione Grupo Walkup, informe o PIN de 6 dígitos e clique em Ativar
- Marker: `DEPLOY-2026-08-30-175000-master-laboratorio-ativar-numero`
- Ativação real depende do PIN do número na Meta (não testável neste PC)

## Observações de segurança

- PIN não é logado. Token Graph permanece no servidor. `connectionId` não é segredo.

## Palavras-chave

`Ativar`, PIN, Pendente, Walkup, `canActivate`, `register`, `+55 11 95213-7761`
