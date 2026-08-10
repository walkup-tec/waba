# LOG — Mensageiro abas Mensagem/Imagem + variação 1080×1080

## Contexto

Na etapa Mensageiro (API Alternativa): duas abas (Mensagem = IA atual; Imagem = 4 imagens 1080×1080). Nos disparos, revezar imagens e enviar **imagem → (ACK de entrega) → texto**.

## Solução

1. **UI**: abas Mensagem/Imagem; 4 slots com validação client 1080×1080; upload multipart.
2. **Storage**: `src/disparos/waba-campaign-messenger-images.service.ts` em `data/*/campaign-messenger-images/`.
3. **Config**: `DisparosConfig.messengerImages` (4 metas); validação no save.
4. **Envio**: `sendMedia` (base64 data-URI primeiro, URL pública fallback — lição Push/EVO); round-robin por campanha; espera `DELIVERY_ACK`/`READ` antes do texto.
5. **Auth**: `GET .../messenger-images/:id/file` público para a Evolution baixar.

## Arquivos

- `index.html` / `dist/index.html`
- `src/disparos/waba-campaign-messenger-images.service.ts`
- `src/aquecedor/delivery-verify.helpers.ts` (copiado)
- `src/index.ts`, `src/auth/waba-auth.routes.ts`

## Validação

1. http://localhost:3012/version-02/ → API Alternativa → Mensageiro.
2. Aba Imagem: só aceita 1080×1080; salvar exige 4 imagens.
3. Campanha ativa: logs `[Campanha] ACK imagem` antes do texto.

## Palavras-chave

`mensageiro`, `imagem`, `1080`, `sendMedia`, `base64`, `DELIVERY_ACK`, `round-robin`, `API Alternativa`
