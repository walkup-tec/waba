# LOG — Transferência atendimento-6019 → walkup@walkuptec.com.br

**Data:** 2026-06-29

## Pedido

Verificar dono do número **51982006019** (Evolution: **555182006019**) e transferir para **walkup@walkuptec.com.br**.

## Descoberta

| Campo | Valor |
|-------|--------|
| Instância Evolution | `atendimento-6019` |
| Número | `555182006019` (match flexível com `51982006019`) |
| Dono anterior (produção) | **mozart.pmo@gmail.com** (assinante) |
| Master destino | **walkup@walkuptec.com.br** |

Mozart via `/instancias?refresh=1` listava 11 instâncias incluindo `atendimento-6019`. Walkup (master) listava apenas 3 (sem a 6019).

## Ação em produção

1. `POST /admin/subscribers/promote-from-v02` com bundle walkup + `instanceOwners.atendimento-6019` → `instanceOwners: 1` (disco `/app/data/instance-owners.json` atualizado).
2. Endpoint novo `GET /admin/instances/lookup` ainda **404** (Easypanel sem redeploy do commit `d3d9e12`).

## Bloqueio operacional

O serviço Node mantém **cache em memória** de `instance-owners.json`. Escrita direta via promote atualiza o disco, mas a UI continua filtrando pelo cache antigo (Mozart ainda “vê” a instância) até **restart do container** no Easypanel.

## Correção de código (local, pendente deploy)

- `waba-instance-ownership.service.ts`: recarrega cache quando `mtime` do arquivo muda.
- `waba-admin-master-promote.service.ts`: `forceInstanceOwnerTransfer` para sobrescrever dono existente.
- `scripts/transfer-instance-owner-prod-via-promote.cjs`: transferência via promote master.

## Validar após restart Easypanel

1. Login **walkup@walkuptec.com.br** → Instâncias → `atendimento-6019` visível.
2. Login **mozart.pmo@gmail.com** → `atendimento-6019` **não** deve aparecer.

```bash
node scripts/transfer-instance-owner-prod-via-promote.cjs --phone 51982006019 walkup@walkuptec.com.br
```

## Palavras-chave

`atendimento-6019`, `51982006019`, `555182006019`, `mozart.pmo@gmail.com`, `walkup@walkuptec.com.br`, `instance-owners.json`, cache ownership, Easypanel restart
