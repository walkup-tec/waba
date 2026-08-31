# LOG — Fix boas-vindas WhatsApp (instância Evolution + reenvio admin)

**Data:** 2026-07-03

## Contexto

Assinante `digitalcorban@gmail.com` criado após deploy `2251b99` não recebeu WhatsApp de boas-vindas.

## Causa provável

- Resolução da instância Evolution era **estática** (nome do push config), sem validar conexão.
- `sendEvoTextAlert` usava timeout de **20s** (sendText costuma precisar de até 90s).
- Falhas só iam para log do servidor; sem reenvio manual.

## Solução

1. **`resolveConnectedEvoOutboundInstance`** exportada do serviço de push — escolhe instância **conectada** (mesma lógica da comunidade).
2. **Boas-vindas WhatsApp** tenta candidatos com fallback e timeout `EVO_SEND_TEXT_TIMEOUT_MS`.
3. **`POST /admin/subscribers/:id/resend-welcome`** — master reenvia e-mail + WhatsApp (senha no body).
4. Botão **Reenviar boas-vindas** no modal do assinante (campo Nova senha).

## Validar

1. Deploy marker `DEPLOY-2026-07-03-boas-vindas-whatsapp-fix`.
2. Admin → Assinante → preencher senha → **Reenviar boas-vindas** para `digitalcorban@gmail.com`.
3. Novo cadastro deve receber WhatsApp automaticamente.

## Palavras-chave

`resolveConnectedEvoOutboundInstance`, `resend-welcome`, `digitalcorban`, boas-vindas WhatsApp
