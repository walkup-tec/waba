# LOG — Push: duplicidade, alertas e imagem

## Problemas reportados

1. E-mail enviado em duplicidade
2. Mensagem na comunidade WhatsApp em duplicidade
3. Alerta in-app não aparecia na tela do usuário
4. Pedido de suporte a imagem no push

## Causas e correções

### Comunidade duplicada
`sendText` enviava `text` + `textMessage` juntos. Passou a respeitar `EVO_SEND_TEXT_V1` (um formato só). Com imagem usa `sendMedia` com legenda.

### E-mail duplicado / indesejado
`resolveEmailRecipients` incluía **todos os assinantes** sempre que `email` estava marcado, mesmo com destino só **Usuários**. Agora e-mail segue os destinos marcados; se só **E-mail** estiver marcado, envia para assinantes + usuários (broadcast).

### Alerta in-app
`refreshPushAlerts()` não era chamado no `unlockWabaApp` após login — só no intervalo de 45s. Adicionado no desbloqueio da sessão + `credentials: "same-origin"`.

### Duplo clique / reenvio
Dedupe server-side 45s (mesmo texto, destinos, roles, imagem e autor).

### Imagem
- `POST /admin/push/upload-image`
- `GET /push/public-media/:id` (Evolution + e-mail + banner)
- UI: selecionar/remover imagem, prévia
- Comunidade: `sendMedia` com URL pública ou base64 fallback

## Validar

1. Push só Usuários → alerta no painel do operacional/suporte/master conforme roles
2. Push comunidade → uma mensagem só
3. Push E-mail + Usuários → um e-mail por destinatário
4. Imagem + texto → banner, e-mail e comunidade com mídia

## Palavras-chave

`push`, `duplicidade`, `EVO_SEND_TEXT_V1`, `refreshPushAlerts`, `push-media`, `upload-image`
