# LOG — Capa JPEG das boas-vindas não enviada

## Contexto

Reenvio de boas-vindas chegou só com texto. A imagem BEM-VINDO não apareceu.

## Causa

O texto usa `sendText` (obrigatório). A capa era `sendMedia` best-effort depois do ACK, com três falhas:

1. O JPEG era lido só de `process.cwd()/media` e `cwd/dist/media`. No container o JS está em `dist/mail`; a logo já usa `__dirname` porque o cwd nem sempre aponta para `/app`.
2. O Dockerfile copiava logos para `/app/media`, mas **não** `compBoasvindasV3.jpg`.
3. Timeout de 20s e uma tentativa, sem fallback de URL — as campanhas usam 60s + URL.

Doc Evolution: `POST /message/sendMedia/{instance}` com `mediatype` + `media` (base64 ou URL).  
https://docs.evolutionfoundation.com.br/en/evolution-api/send-media-message  
https://github.com/EvolutionAPI/evolution-api/blob/cd800f29/src/api/dto/sendMessage.dto.ts

## Solução

- Resolver o ficheiro por `__dirname` (`dist/media` e `/app/media`).
- Copiar `media/compBoasvindasV3.jpg` no Dockerfile.
- `sendMedia` 60s, 2 retries, variantes data-URI / base64 cru / URL pública.

## Arquivos

- `src/mail/waba-welcome-cover.ts`
- `src/monitoring/evo-text-alert.client.ts`
- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `Dockerfile`
- `src/deploy-marker.ts`

## Como validar

```bash
node scripts/test-welcome-whatsapp-layout.cjs
node scripts/verify-welcome-routing-rules.cjs
```

Após deploy: Reenviar no Admin e conferir a bolha de imagem no WhatsApp. Sem sonda `sendText` extra.

## Segurança

Sem log de senha. Base64 só em memória para a Evolution.

## Palavras-chave

boas-vindas, sendMedia, compBoasvindasV3, __dirname, capa JPEG
