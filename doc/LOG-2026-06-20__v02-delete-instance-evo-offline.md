# LOG — delete instância V02 com Evolution offline

**Data:** 2026-06-20

## Problema
Ao deletar: modal "Excluindo…", volta ao estado original, instância permanece, modal aberto.

## Causa
`DELETE /instancias/:name` falhava 502 (EVO timeout status 0). Frontend resetava processing no `finally` sem fechar modal.

## Correção
- Backend: se EVO offline (status 0) ou 404 → remove `instance-owners.json` + cache local, retorna 200 `degraded: true`.
- Frontend: fecha modal no sucesso; toast warning se degraded; remove item da lista antes de `carregar()`.

## Teste
`DELETE test-qr-744651` → ok degraded; lista 12→11.
