# LOG — Fix Preparando na integração (contagem + aquecedor)

## Contexto
Instância `5182006011` integrada e já recebia aquecedor sem passar por **Preparando** (6h). O indicador «Instâncias Preparando» também ficava zerado indevidamente.

## Causa
1. `ensureAquecedorInstanceRegistered` rodava **antes** do create na Evolution, sem `createdAt` → `isGrandfatherEligible(null)` marcava **active**.
2. Row `active` antiga (número reutilizado) não era revertida para Preparando quando a integração EVO era nova.
3. Ciclo do aquecedor só exclui fase `preparing`; active indevido entrava no mesh.

## Solução
1. Sem `createdAt` pendente de create: **não** grandfather.
2. Após create/QR novo ou recriação: `forceNewIntegration` → fase **Preparando** com `preparingSince` = integração/now.
3. Reconcile: `active` → Preparando se `createdAt` EVO está na janela de 6h **ou** é mais novo que `activatedAt` (recriação).
4. Contagem UI continua via `aquecedorPhase` / label Preparando (`updateInstancesIndicators`).

## Arquivos
- `src/services/aquecedor-instance-lifecycle.service.ts` (+ dist)
- `src/index.ts` (+ dist)

## Como validar
1. Integrar instância nova → status Preparando + contador + aquecedor **não** envia para ela.
2. Após deploy, abrir Instâncias (uso-config): `6011` com `createdAt` recente deve voltar a Preparando sozinha.
3. Instâncias legadas (pré-2026-06-22) permanecem active.

## Palavras-chave
preparando, integration, forceNewIntegration, grandfather, 5182006011, aquecedor-lifecycle, indicadores
