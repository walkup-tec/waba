# LOG — 404 POST /version-02/disparos/campanhas/intake

**Data:** 2026-06-08  
**Sintoma:** DevTools mostrava `Cannot POST /version-02/disparos/campanhas/intake` (404). Payload do wizard estava correto.

## Causa
API local rodando **sem reiniciar** após adicionar `registerWabaCampaignIntakeRoutes`. Rota inexistente no processo antigo → 404 (com `originalUrl` ainda exibindo `/version-02/...`).

## Correção
- Reinício `npm run dev:v02` → `/health` com `deployMarker: DEPLOY-2026-06-08-fix-wizard-gerar-campanha-v1`
- POST `/version-02/disparos/campanhas/intake` passa a responder **401** (sem sessão) em vez de 404
- `index.html`: mensagem clara se API retornar 404 no envio

## Validar
1. Ctrl+F5 na UI
2. Campanhas → Gerar Campanha com Excel + imagem 1080×1080
3. Deve retornar 201 e painel «Solicitação enviada»
