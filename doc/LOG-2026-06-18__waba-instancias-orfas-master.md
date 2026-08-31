# LOG — Instâncias órfãs visíveis para master

**Data:** 2026-06-18

## Problema
Produção: instâncias conectadas na Evolution não apareciam em Instâncias após login obrigatório.

## Causa
Filtro por `data/instance-owners.json` — instâncias legadas sem `ownerEmail` ficam ocultas para todos.

## Correção
`reconcileOrphanInstancesForMaster`: ao listar `GET /instancias`, master vincula órfãs ao próprio e-mail (sem sobrescrever donos existentes).

## Marker
`DEPLOY-2026-06-18-waba-instancias-orfas-master`

## Validar
Login master → Instâncias → lista preenchida. Assinantes: só instâncias já vinculadas ao e-mail deles.
