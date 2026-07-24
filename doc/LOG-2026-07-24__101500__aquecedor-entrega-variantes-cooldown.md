# LOG — Aquecedor: entrega efetiva + anti-duplicata/cooldown

## Sintoma

- Par `6635 → 8918` gerava **dois** registros Em Fila
- Mensagem aparecia só na origem; destino não confirmava
- Motor recolocava o **mesmo par** no ciclo e travava os demais envios

## Causas

1. `revertAquecedorPendingAfterFailedSend` zerava `instancia` → `ensure` não achava PENDENTE da origem e **insería nova linha**
2. Após falha de entrega, o pick podia reescolher o mesmo par imediatamente
3. Número destino podia estar em formato BR alternativo (9º dígito/DDI); findMessages no destino falhava com chats `@lid`

## Correção

- Revert mantém `instancia` da origem; ensure **reclama órfãos** (`instancia null`)
- Tentativas de envio com **variantes** do número BR até confirmar origem+destino
- findMessages com fallback recente (sem depender só do JID telefone)
- **Cooldown 45 min** no par direcionado após falha (`delivery-cooldown.service.ts`); pick exclui pares bloqueados
- Marker: `DEPLOY-2026-07-24-aquecedor-entrega-variantes-cooldown`

## Arquivos

- `src/index.ts`
- `src/aquecedor/delivery-cooldown.service.ts`
- `src/aquecedor/delivery-verify.helpers.ts`
- `src/aquecedor/relationship-manager.service.ts`
- `src/aquecedor/pair-orchestrator.service.ts`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Node; `/health` com o marker novo
2. Aquecedor ativo: se um par falhar entrega, próximo ciclo deve ir para **outro** par
3. Lista Em Fila sem duplicar o mesmo A→B por revert
4. Sucesso só com confirmação nos dois lados (origem + destino)

## Keywords

aquecedor, entrega, findMessages, duplicata Em Fila, cooldown, variantes número, 6635, 8918
