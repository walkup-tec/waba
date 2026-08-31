# LOG — Fix Gerar Campanha API Oficial (multipart + express.json)

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-campanha-intake-multipart-parser-fix`

## Contexto

Ao clicar em **Gerar Campanha** no wizard (API Oficial), o frontend exibia:

> Falha de conexão com o servidor ao enviar a campanha. Recarregue a página e tente de novo.

O `fetch` falhava com `Failed to fetch` no `POST /disparos/campanhas/intake` (multipart: imagem + planilha Excel).

## Causa raiz

O middleware global `express.json()` só ignorava multipart em `POST /disparos/campanhas` (rota legada).  
O intake usa `POST /disparos/campanhas/intake` e recebia `parseJsonDefault`, que tentava ler o body multipart como JSON — corrompendo o stream antes do multer.

## Solução

1. **`src/index.ts`** — função `shouldSkipBodyParserForMultipart()` que pula `express.json` para multipart em:
   - `/disparos/campanhas`
   - `/disparos/campanhas/intake`
2. **`src/deploy-marker.ts`** — novo marker de deploy.
3. **`index.html`** — mensagem de erro de rede ligeiramente mais clara.

## Arquivos alterados

- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html`

## Como validar

1. `npm run build`
2. Login → Disparos → Nova campanha (API Oficial)
3. Preencher wizard, enviar imagem 1080² + planilha `.xlsx`
4. **Gerar Campanha** deve retornar JSON de sucesso (ou erro de validação legível), não `Failed to fetch`
5. Em produção: `GET /health` deve mostrar marker `DEPLOY-2026-06-25-campanha-intake-multipart-parser-fix` após redeploy do Node

## Segurança

Sem alteração de auth; intake continua exigindo sessão válida.

## Palavras-chave

`campanha-intake`, `multipart`, `express.json`, `multer`, `Failed to fetch`, `disparos/campanhas/intake`, `wizard API Oficial`
