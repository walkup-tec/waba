# LOG — Disparos: destino do link (WhatsApp ou URL) + link único por envio

**Data:** 2026-06-21  
**Tipo:** feat + UX  
**Marker deploy:** `DEPLOY-2026-06-21-disparos-link-destino-url-whatsapp`

## Contexto

O assinante precisa escolher onde receber o retorno da campanha:
- **WhatsApp destino** (wa.me encurtado)
- **Informar URL de resposta** (URL custom http/https encurtada)

Em ambos os casos o encurtador WABA gera **link diferente a cada mensagem enviada** (nonce na URL longa → alias/slug único).

## Solução

### Backend (`src/index.ts`)

- Novos campos em `DisparosConfig`: `linkDestinationMode` (`whatsapp` | `url`), `responseUrl`.
- Helpers: `normalizeDisparosResponseUrl`, `validateDisparosLinkDestination`, `buildDisparosDestinationLongUrl`, `generateUniqueShortUrlForDisparosConfig`.
- Validação global: exige WhatsApp **ou** URL conforme o modo (não mais WhatsApp sempre obrigatório).
- `composeOutboundMessageForConfig`: modo IA e base de mensagens passam a gerar short URL único por lead.
- `/disparos/gerar-mensagem-ai`: aceita modo/URL do formulário ou snapshot salvo.
- Diagnóstico: resume `linkDestinationMode` e URL mascarada.

### Frontend (`index.html`)

- Seção **5) Encurtador URL** redesenhada com abas e copy sobre link exclusivo por envio.
- Validação unificada `validateDisLinkDestination` (WhatsApp ou URL).
- Teste de encurtador e teste de IA usam o modo ativo.
- Salvar etapa valida destino antes de persistir.

## Arquivos alterados

- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html` (+ `dist/index.html` via build)

## Como validar

1. `npm run build`
2. Disparador → etapa Encurtador URL:
   - Alternar abas WhatsApp / URL de resposta
   - Testar encurtador em cada modo
   - Salvar configurações (1 clique)
3. Gerar mensagem teste (IA) com URL custom
4. `GET /health` → marker `DEPLOY-2026-06-21-disparos-link-destino-url-whatsapp`

## Segurança

- URLs normalizadas e limitadas a 2000 chars; apenas http/https.
- Diagnóstico expõe host mascarado, não URL completa com query sensível.

## Palavras-chave

`linkDestinationMode`, `responseUrl`, `encurtador`, `nonce`, `_n8n_link_nonce`, destino link campanha
