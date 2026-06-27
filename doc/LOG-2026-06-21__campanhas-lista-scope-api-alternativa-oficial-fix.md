# Campanhas — lista isolada por API (Alternativa vs Oficial)

**Data:** 2026-06-21  
**Tipo:** fix UX  
**Marker:** `DEPLOY-2026-06-21-campanhas-lista-scope-api-alternativa-oficial`

## Problema

No menu **API Alternativa**, a listagem exibia campanhas da **API Oficial** por vários segundos até a requisição `/disparos/campanhas` concluir. Causa confusão (etiqueta «API Oficial» em ambiente Alternativa).

## Causa raiz

- Um único `disparosCampaignItemsCache` compartilhado entre intake (Oficial) e motor EVO (Alternativa).
- Ao trocar de aba, o DOM mantinha a lista anterior até o fetch terminar (~15s).
- `refreshDisparosCampaignsAndResumo()` rodava antes de `syncDisparoEvoMode()` em alguns fluxos.

## Solução

1. **Cache por escopo** — `oficial-intake` e `alternativa-evo` (memória + localStorage 30 min por e-mail).
2. **`prepareDisparosCampaignListScopeChange()`** — ao mudar API/aba: cancela fetch anterior, limpa lista errada, mostra skeleton ou hidrata cache do escopo correto.
3. **`syncDisparoEvoMode()`** chama prepare antes de atualizar layout.
4. **`setActiveTab`** — `syncDisparoEvoMode()` antes de `refreshDisparosCampaignsAndResumo()` nas abas Disparos.
5. Loaders validam escopo antes de renderizar; falha só reutiliza cache do escopo ativo.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Validar

1. Abrir API Oficial → ver campanhas intake (tag API Oficial).
2. Ir para API Alternativa → **não** ver campanhas Oficial; skeleton ou lista Alternativa imediata.
3. Voltar para Oficial → mesma regra inversa.
4. Segunda visita (< 30 min) → lista correta hidratada do localStorage.

## Palavras-chave

campanhas lista scope, api alternativa, api oficial, cache isolado, disparosCampaignItemsCache
