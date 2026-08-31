# LOG — Fix exclusão instância (tombstone + purge garantido)

**Data:** 2026-06-21  
**Sintoma:** Modal de processamento voltava ao formulário de confirmação; instância permanecia na lista (`teste-6019`, status preparando).

## Causa raiz

1. **Evolution API falhava** (400/403/etc.) → backend retornava **502** sem purge local → frontend mantinha modal aberto.
2. **Master re-vinculava órfãs:** após purge parcial, `reconcileOrphanInstancesForMaster` recolocava instâncias ainda presentes na Evolution em `instance-owners.json`.
3. **Nome na Evolution** podia diferir do nome no painel (alias) → delete na EVO falhava para o nome errado.

## Correção

### Backend
- `deletedInstances` tombstone em `instance-owners.json` — órfãs excluídas não são re-vinculadas.
- `resolveInstanceDeletionKeys()` — aliases + candidatos EVO + lista live.
- `tryDeleteEvoInstance()` — logout + delete em **todos** os candidatos.
- **Sempre** `purgeInstanceLocalState()` após tentativa EVO; resposta **200** (degraded se EVO falhou).
- Lista `/instancias` filtra instâncias tombstonadas antes do reconcile.

### Frontend
- `removeInstanceFromLocalList` remove por nome técnico + alias + label.
- DELETE com `credentials: "same-origin"`.

### Marker
`DEPLOY-2026-06-21-exclusao-instancia-tombstone-fix`

## Arquivos
- `src/instances/waba-instance-ownership.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validar
1. Excluir instância em status preparando → modal fecha, linha some, não volta após refresh.
2. GET `/health` → marker tombstone-fix.
