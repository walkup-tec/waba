# Campanha API Alternativa — mapeamento inline + Gerar Campanha

**Data:** 2026-06-21  
**Tipo:** fix UX  
**Marker:** `DEPLOY-2026-06-21-campanha-evo-gerar-campanha-inline-map`

## Contexto

Após mapear coluna na etapa 7 (Campanha), um modal abria/fechava e a campanha era gravada antes do usuário salvar a etapa. O fluxo correto: mapear coluna → informar quantidade → **Gerar Campanha** (ação explícita).

## Solução

1. **Mapeamento inline** — select `dis-campaign-inline-map-number` + botão «Confirmar coluna» na própria seção (sem modal).
2. **Confirmar coluna** — apenas persiste mapeamento local e libera quantidade de envios; **não** chama `POST /disparos/campanhas`.
3. **Gerar Campanha** — botão da etapa (`.dis-section-save-btn` na seção Campanha) renomeado; `executeDisparosSectionSave` chama `createCampaignFromMappedSpreadsheet()` só nessa seção.
4. Removido botão duplicado `dis-campaign-save-config-btn`.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Validar

1. Importar planilha → prévia + select de colunas inline.
2. Confirmar coluna → modal **não** abre; campanha **não** é criada.
3. Informar quantidade (Alternativa) → botão «Gerar Campanha» habilita.
4. Clicar «Gerar Campanha» → `POST /disparos/campanhas` e campanha na lateral.

## Palavras-chave

campanha evo, mapear coluna inline, gerar campanha, modal mapeamento
