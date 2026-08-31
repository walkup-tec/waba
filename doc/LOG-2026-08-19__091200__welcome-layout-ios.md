# LOG — Layout das boas-vindas WhatsApp no iPhone

## Contexto do pedido

A mensagem de boas-vindas chegou no iPhone, mas o layout estava quebrado: card que parece vídeo (sem play real), imagem BEM-VINDO borrada, dois previews do site e texto cortado na borda direita.

## Ações executadas

- Conferido o template `buildSubscriberWelcomeWhatsAppText` e o envio `sendText` via Evolution.
- Conferidas as meta OG de `https://waba.draxsistemas.com.br/` (`og:type=website`, `og:image=compBoasvindasV3.jpg`, 1200×1200, ~140 KB).
- Doc Evolution: `linkPreview` no `POST /message/sendText/{instance}`.

## Causa raiz

1. O texto usava `━━━━━━━━━━━━━━━━━━` (U+2501). No WhatsApp iOS isso impede wrap e alarga a bolha até cortar o texto.
2. O mesmo `sendText` tinha dois `https` (login + comunidade). A Evolution gera preview OG: miniatura borrada + chrome de vídeo, às vezes dois cards “DRAX - WABA”.

Não era `sendMedia` de vídeo. Era preview automático do link do sistema.

## Solução

1. Separador ASCII `--------------------`.
2. `linkPreview: false` só nas boas-vindas.
3. Após ACK do texto, `sendMedia` do JPEG `compBoasvindasV3.jpg` (best-effort; falha da capa não desfaz o texto).

## Arquivos

- `src/mail/waba-welcome-whatsapp.service.ts`
- `src/mail/waba-welcome-cover.ts`
- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `src/monitoring/evo-text-alert.client.ts`
- `src/deploy-marker.ts`
- `scripts/test-welcome-whatsapp-layout.cjs`
- `scripts/verify-welcome-routing-rules.cjs`

## Como validar

```bash
node scripts/test-welcome-whatsapp-layout.cjs
node scripts/verify-welcome-routing-rules.cjs
```

No iPhone, após deploy + Reenviar: texto inteiro (sem corte), sem card de vídeo, capa nítida numa bolha de imagem, links azuis clicáveis.

Não reenviar sonda `sendText` extra no mesmo número em janela curta.

## Segurança

Sem log de senha/token. Capa lida do disco (`media/` ou `dist/media/`).

## Palavras-chave

boas-vindas, iOS, wrap, U+2501, linkPreview, sendMedia, compBoasvindasV3, OG
