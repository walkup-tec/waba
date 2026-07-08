# Boas-vindas automática — criar operacional/suporte

**Data:** 2026-07-08  
**Pedido:** Enviar e-mail e WhatsApp de boas-vindas ao criar usuário Operacional ou Suporte em Admin · Usuários.

## Implementação

1. **Templates** (`waba-mail.templates.ts`): `buildStaffWelcomeTemplate` — e-mail com perfil, credenciais e (operacional) tipo de disparos + segmento.
2. **WhatsApp** (`waba-welcome-whatsapp.service.ts`): `buildStaffWelcomeWhatsAppText`, `deliverStaffWelcomeWhatsApp`, helper `deliverWelcomeWhatsAppMessage` compartilhado com assinantes.
3. **Orquestração** (`waba-mail-delivery.ts`): `notifyStaffWelcome` → e-mail + WhatsApp async.
4. **Gatilho** (`waba-system-user.service.ts` `create()`): após persistir, se `role` é `operacional` ou `suporte`, chama `notifyStaffWelcome`. **Master** não recebe.

## Validar

1. `npm run build` + reiniciar `npm run dev:v02`
2. Admin → Usuários → criar Operacional/Suporte com WhatsApp válido
3. Logs: `[mail] boas-vindas equipe ...` e `[whatsapp] boas-vindas equipe ...`
4. V02 local: e-mail via SMTP; WhatsApp pode falhar se Evolution `sendText` cair (mesma regra dos assinantes)

## Palavras-chave

`notifyStaffWelcome`, `buildStaffWelcomeTemplate`, operacional, suporte, boas-vindas equipe
