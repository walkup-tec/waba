# LOG — API Alternativa layout alinhado à API Oficial

**Data:** 2026-06-20  
**Contexto:** Reorganizar tela API Alternativa (disparo-evo) com mesma disposição da API Oficial.

## Solicitação

- Esquerda: campanhas (UI EVO existente)
- Direita: créditos e consumo (mesmo painel Resumo/Saldos da API Oficial)
- Embaixo: etapas de configuração (disparos-config-legacy)

## Alterações (`index.html`)

- Removido `disparos-saas-only` do painel `.disparos-side-resumo` e do nudge de créditos topo
- CSS evo/baseline: grid igual oficial; oculto `#disparos-evo-baseline-left` (resumo antigo)
- `initDisparoEvoPanelLayout`: move `#disparos-config-legacy` para **abaixo** do `.disparos-layout` (não mais na coluna esquerda)
- `syncDisparosResumoSide`: funciona também em modo EVO
- `loadDisparosEvoCampaigns`: cache, fingerprint, `syncDisparosResumoSide`, `loadDisparosCredits`, polling
- `refreshDisparosCampaignsAndResumo`: EVO carrega campanhas + créditos
- Polling/visibility: inclui aba `disparo-evo`
- `computeDisparosEnviadosFinalizados`: conta status `finished` (campanhas EVO)

## Validação

- `npm run build` OK → `dist/index.html` atualizado

## Pendências

- Validar visualmente em `npm run dev:v02` → API Alternativa
- Commit/deploy quando solicitado
