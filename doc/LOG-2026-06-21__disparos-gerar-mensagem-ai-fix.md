# LOG — Fix gerar mensagem teste (IA) — API Alternativa

**Data:** 2026-06-21  
**Contexto:** Botão "Gerar mensagem teste (IA)" na criação/configuração de campanha API Alternativa exibia erro genérico *"Erro ao gerar mensagem com IA."* sem detalhe.

## Causa raiz provável

1. **Timeout frontend (20s)** inferior ao tempo do backend (encurtador com retries + OpenAI até 3×15s).
2. **`POST /disparos/gerar-mensagem-ai`** chamava `generateShortUrlForDisparos` **sem** `publicBaseHintsFromExpressRequest`, diferente de `POST /disparos/shorten` — encurtador podia falhar em produção sem `WABA_PUBLIC_BASE_URL`.
3. **Catch genérico** no frontend mascarava timeout/rede como erro único.
4. **WhatsApp destino** não validado no frontend antes do POST.

## Solução

### Backend (`src/index.ts`)

- `generateShortUrlForDisparos(longUrl, publicBaseHints?)` repassa hints ao `shortenUrlWithProvider`.
- `POST /disparos/gerar-mensagem-ai`:
  - Usa `publicBaseHintsFromExpressRequest(req)`.
  - Se encurtador falhar, **fallback** para URL `wa.me` longa (teste de IA não bloqueia).
  - Resposta inclui `shortenerWarning` quando aplicável.

### Frontend (`index.html`)

- Valida `validateWhatsappTarget(true)` antes de chamar API.
- Timeout aumentado de 20s → **90s**.
- Mensagens específicas: timeout, rede, WhatsApp inválido.
- Exibe aviso amarelo se link não foi encurtado.

### Deploy marker

`DEPLOY-2026-06-21-disparos-gerar-mensagem-ai-fix`

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`
- `dist/` (build)

## Como validar

1. API Alternativa → seção Mensageiro → modo IA.
2. Preencher Encurtador (WhatsApp DDD+9) e campos de briefing.
3. Clicar **Gerar mensagem teste (IA)** — mensagem deve aparecer em ~10–60s.
4. Se encurtador indisponível: mensagem gerada com aviso amarelo (link wa.me longo).
5. `GET /health` → confirmar marker e `shortPublicBase.configured`.

## Produção (Easypanel)

Garantir variáveis:

```
WABA_PUBLIC_BASE_URL=https://waba.draxsistemas.com.br
WABA_SHORT_PUBLIC_BASE=https://waba.draxsistemas.com.br
OPENAI_API_KEY=...
```

## Palavras-chave

`gerar-mensagem-ai`, `testDisparosAiGeneration`, `generateShortUrlForDisparos`, `publicBaseHints`, timeout IA, API Alternativa, encurtador campanha
