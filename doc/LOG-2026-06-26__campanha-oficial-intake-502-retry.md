# LOG — Fix criar campanha API Oficial (502 / conexão)

**Data:** 2026-06-26  
**Marker:** `DEPLOY-2026-06-26-campanha-intake-body-parser-skip`

## Contexto

Assinante no wizard API Oficial (passo 5 Leads, 234 envios) ao clicar **Gerar Campanha** recebia:

> Falha de conexão com o servidor ao enviar a campanha…

DevTools mostrava `POST /disparos/campanhas/intake` com **502 Bad Gateway** e também `net::ERR_CONNECTION_*` em `session`, `credits`, `snapshot`, etc.

## Diagnóstico

1. **Produção intermitente:** `GET /health` responde 200, mas em rajadas vários endpoints retornam 502 (Traefik × Node `waba_disparador`).
2. **Rota intake OK:** `POST /disparos/campanhas/intake` sem sessão → **401 JSON** (não 404), local e produção.
3. **Multipart:** smoke test `agent-tools/test-intake-multipart.mjs` confirma parsing correto.
4. **Fragilidade residual:** `shouldSkipBodyParserForMultipart` só ignorava `express.json` quando `Content-Type` continha `multipart/form-data`. Se proxy alterar/remover o header, o body corrompe antes do multer → falha de conexão/`Failed to fetch`.

## Solução

### Backend (`src/index.ts`)

- **Sempre** pular `express.json` em `POST /disparos/campanhas/intake` (independente do `Content-Type`).

### Frontend (`index.html`)

- `fetchDisCampaignWizardIntakeWithRetry()` — até 3 tentativas com backoff em erro de rede ou HTTP 5xx.
- Pausa polling de campanhas durante o envio (menos carga concorrente).
- Mensagens específicas para **502/503/504** e sessão expirada (401).

### Marker

- `src/deploy-marker.ts` → `DEPLOY-2026-06-26-campanha-intake-body-parser-skip`

## Arquivos alterados

- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html`
- `agent-tools/test-intake-multipart.mjs` (smoke test)

## Como validar

1. `npm run build`
2. `node agent-tools/test-intake-multipart.mjs` → status **401**
3. Login → wizard API Oficial → imagem 1080² + planilha `.xlsx` → **Gerar Campanha**
4. Produção: redeploy **Easypanel `waba_disparador`** (Node) + FTP já leva o `index.html`
5. `GET /health` → marker `DEPLOY-2026-06-26-campanha-intake-body-parser-skip`

## Observações

- 502 em massa ainda indica instabilidade Traefik/Node — script VPS: `/root/traefik-permanent-waba-vps.sh run`
- FTP (GitHub Actions) **não** atualiza o serviço Node; redeploy manual no Easypanel é obrigatório para o fix do body parser.

## Palavras-chave

`campanha oficial`, `intake`, `502`, `multipart`, `express.json`, `Gerar Campanha`, `retry`, `waba_disparador`
