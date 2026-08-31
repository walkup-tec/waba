# Log: Mensageiro - teste IA com link curto

## Contexto do pedido
Ao gerar mensagem teste no Mensageiro, retornar mensagem completa contendo tambem link de acesso encurtado.

## Comandos / acoes executadas
- Ajustes no backend em `src/index.ts`
- Ajustes na UI em `index.html`
- `npm run build`

## Solucao implementada (passo a passo)
1. Backend:
   - Incluido `accessLink` no `buildDisparosAiPrompt`.
   - Criada funcao `generateShortUrlForDisparos(longUrl)` para encurtar URL no fluxo de geracao.
   - Criada funcao `ensureMessageContainsLink(message, link, cta)` para garantir que a mensagem final contenha o link, mesmo se a IA omitir.
   - `POST /disparos/gerar-mensagem-ai` agora aceita `accessUrl`, encurta automaticamente e devolve:
     - `message` (mensagem final com link)
     - `shortUrl`
     - `shortenerProvider`
2. Frontend (Mensageiro):
   - Novo campo `URL de acesso (para encurtar no teste)`.
   - Botao de gerar mensagem IA envia `accessUrl` para o backend.
   - Status mostra o link curto retornado.

## Arquivos criados/alterados
- Alterado: `src/index.ts`
- Alterado: `index.html`
- Criado: `doc/LOG-2026-03-24__120553__mensageiro-teste-ia-com-link-curto.md`

## Como validar
1. Reiniciar backend para aplicar build novo.
2. Em Disparos > Mensageiro:
   - preencher `URL de acesso (para encurtar no teste)` com URL valida
   - clicar `Gerar mensagem teste (IA)`
3. Confirmar:
   - campo `Mensagem gerada` com texto completo + link curto
   - status com `Link curto: ...`

## Observacoes de seguranca
- Chaves continuam somente no backend (`.env`).
- Sem exposicao de segredo no frontend.

## Itens para evitar duplicacao no futuro (palavras-chave)
- mensageiro-link-curto
- gerar-mensagem-ai-accessurl
- ensure-message-contains-link
