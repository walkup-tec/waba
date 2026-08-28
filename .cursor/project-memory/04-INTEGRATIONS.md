# Integrações

## Visão geral

WhatsApp (API oficial e alternativa via Evolution), Supabase, e-mail transacional (boas-vindas e alertas).

## APIs

| Serviço | Finalidade | Autenticação |
|---------|------------|--------------|
| WhatsApp API oficial | Mensageria | Meta / tokens do app |
| Evolution (API alternativa / outbound) | Boas-vindas, alertas, aquecedor, disparos | `EVO_API_URL` + `EVO_API_KEY` |
| Supabase | Dados / backend-as-a-service | keys no `.env` |

## Webhooks

_A preencher com endpoints e eventos confirmados._

## Serviços externos

- Evolution: sequência padrão de envio WhatsApp do WABA (números/hints configuráveis; primária histórica `51981077770` com fallbacks).
- SMTP / mail: e-mail de boas-vindas e notificações.

## Autenticação

Sessão WABA (cookie) para master/staff/assinante; rotas admin restritas a master.

## Fluxos de comunicação

### Meta WhatsApp Cloud — portfólio (Laboratório)

- Listagem: `GET /integrations/meta/whatsapp/portfolio`
- Identidade do card: `POST /integrations/meta/whatsapp/portfolio/profile` (nome/foto locais; Graph best-effort)
- Foto do card: `GET /integrations/meta/whatsapp/portfolio/photo` (sessão, `Cache-Control: private, no-store`)
- Docs oficiais: Business `profile_picture_uri` é leitura — https://developers.facebook.com/docs/marketing-api/reference/business/

### Boas-vindas assinante

- Cadastro ou `POST /admin/subscribers/:id/resend-welcome` → e-mail + WhatsApp.
- WhatsApp **obrigatório**: fila `51981077770` → `51997462102` → `51981082477`; ausente usa o próximo; se a fila falhar, qualquer EVO `open`.
- Destino = JID canônico (`POST /chat/whatsappNumbers/{instance}`, `exists:true`).
- Reenvio **sem** body de senha.

### Aquecedor — confirmação de entrega

- Após `sendText`: tag única + `findMessages`/`findChats` no destino; fallback `DELIVERY_ACK`/`READ`/`PLAYED` via `findStatusMessage`.
- Helpers: `src/aquecedor/delivery-verify.helpers.ts`.

### Campanha Alternativa — botão URL (Evolution)

- Envio: `POST /message/sendButtons/{instance}` com `title` visível, `description`, `footer: ""`, botão `type: "url"`.
- Texto da campanha **sem URL**; destino só no botão. Sem fallback `ensureMessageContainsLink`.
- Doc: https://docs.evolutionfoundation.com.br/evolution-api/send-buttons
- Payload de referência: commit `4a72c1d` (campanha 11/08). `viewOnce` + `nativeFlow`/`cta_url` é o CTA nativo da Evolution 2.3.x, não falha.

### Dispositivos (Device Cloud) → Aquecedor

- Menu WABA **Dispositivos** abre SSO/launcher para o dispositivo virtual (repo `drax-device-cloud`).
- Fluxo de integração: usuário cadastra número no WhatsApp do dispositivo → lingueta **«Adicionar ao Aquecedor»** → backend WABA cria/liga instância Evolution e registra no aquecedor (sem CONFIRMAR manual).
- UI: estados da lingueta (`idle` / `busy` / `done`); pulso em **Instâncias** após sucesso.
- Copy de usuário sem EVO/Evolution; mensagens usam **dispositivo**.
- Envs: `DEVICE_CLOUD_PUBLIC_URL`, `DEVICE_CLOUD_SSO_SECRET` (gate master em produção).

### Reconexão — purge de sessão antiga

- Ao gerar QR / pairing de um número já conhecido: apagar clones EVO do mesmo JID e a sessão antiga do nome canônico (`logout` + `delete` + `create`).
- Endpoint manual: `POST /instancias/:name/reconnect-purge`.
- Preserva foguinhos e totais de envio. Sem `sendText` de teste.
