# LOG — Aquecedor: remoção do teste mesh inicial

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-aquecedor-remove-mesh-test`

## Contexto

Pedido do usuário: remover o teste inicial mesh do aquecedor, pois dispara muitas conversas novas e acelera restrições WhatsApp em números recém-conectados.

## Ações

1. Removido `runAquecedorStartupMeshValidation` e funções auxiliares (plan, send/verify por par, hub-spoke).
2. Removido estado `aquecedorMeshBootstrap` do payload `/aquecedor/status`.
3. Removido bloco no `runAquecedorCycle` que bloqueava/aguardava mesh antes do ciclo.
4. Deletado `src/services/aquecedor-mesh-validation.service.ts` e handler webhook mesh.
5. Removido `shouldSkipAquecedorMeshBootstrap` do lifecycle (não há mais mesh para pular).
6. UI (`index.html`): removidos hero/barra/logs de "Validação inicial", "Teste falhou" e progresso mesh.

## Mantido

- Ciclo normal do aquecedor (pares alternados, volume controlado).
- Lifecycle seguro: Preparando, 6h de espera, limites diários, detecção de restrição.
- `resolveAquecedorInstanceDigits` e verify do ciclo (`verifyAquecedorMessageDelivered`).

## Arquivos alterados

- `src/index.ts`
- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/services/aquecedor-mesh-validation.service.ts` (removido)
- `index.html`
- `src/deploy-marker.ts`

## Validação

```bash
npm run build
```

Build OK.

## Palavras-chave

`aquecedor`, `remove mesh`, `validação inicial`, `restrição WhatsApp`, `lifecycle`
