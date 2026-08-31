# LOG — Menus Disparos para assinantes (como V02, todos ambientes)

**Data:** 2026-06-20  
**Pedido:** Assinantes veem Dashboard, Créditos, API Alternativa e API Oficial na seção Disparos (como V02).

## Causa
- Assinantes com créditos entravam em UI «só campanhas»: ocultava Créditos e forçava API Oficial.
- Sem créditos, API Oficial ficava oculta.
- Baseline (V01) escondia `.waba-prod-only` para todos.

## Correção
- **Assinantes:** sempre exibir os 4 menus Disparos (produção e baseline).
- Desativada UI split `shouldUseCampanhasSubscriberUi` para assinantes.
- Classe `waba-subscriber-disparos-menus` libera menus prod no V01 baseline.
- `applyMenuSectionAccess` chama `syncCampanhasMenuVisibility`.
- **Operacional (admin):** padrão Aquecedor + 4 Disparos ao criar usuário (front + back).
- `WABA_SUBSCRIBER_DISPAROS_MENU_IDS` em `waba-menu-registry.ts`.

## Arquivos
- `index.html`, `src/menus/waba-menu-registry.ts`, `src/menus/waba-menu-permissions.service.ts`, `src/deploy-marker.ts`

## Validar
- Login assinante V02/prod: 4 itens em Disparos.
- Login assinante V01: mesmos 4 itens (com classe body).
- Criar usuário operacional: checklists Disparos pré-marcados.
