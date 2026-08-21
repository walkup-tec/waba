# LOG — QR bloqueado por EACCES em instance-owners.json

## Contexto
UI: «Falha ao reservar nome da instância no armazenamento local.» (instância `6035`).

## Doc EVO (confirmado — NÃO é a causa)
- Create: `POST /instance/create` com `qrcode:true`, `integration:WHATSAPP-BAILEYS`
  - https://doc.evolution-api.com/v2/api-reference/instance-controller/create-instance-basic.md
- QR: `GET /instance/connect/{instance}`
  - https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect.md
- Smoke WABA→EVO já OK (create 201 + base64). O wizard morria **antes** de chamar a EVO.

## Causa real
```
EACCES: permission denied, open '/app/data/instance-owners.json'
```
O purge (`docker cp` de volta ao container) deixou o ficheiro **root-owned**; o app roda como `nodejs` (UID 1001).

## Solução
1. `writeJsonFileResilient`: tmp → rename → write → unlink+replace em EACCES/EPERM
2. Ownership `saveStore` usa o helper
3. Purge: `chown -R 1001:1001` após `docker cp`
4. Script: `scripts/heal-waba-data-permissions-vps.sh`

## Teste interno (positivo)
```
node scripts/test-owners-eacces-recovery.mjs
→ direct_write_blocked EPERM
→ {"ok":true,"has6035":true,"owner":"mozart.pmo@gmail.com"}
```

## Marker
`DEPLOY-2026-07-25-owners-eacces-resilient-write`

## Validar em produção (após deploy ou heal chown)
1. claimOnRegister / wizard QR com nome novo
2. `/service/evo-qr-recent-failures` sem EACCES novo

## Palavras-chave
EACCES, instance-owners.json, docker cp root, UID 1001, writeJsonFileResilient, heal-waba-data-permissions
