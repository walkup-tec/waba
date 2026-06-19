# LOG — Fix isolamento estrito instâncias (sem bypass master)

**Data:** 2026-06-16

## Bug
Instância `Drax Sistemas 5181076973` (mozart.pmo@gmail.com) visível para walkup@walkuptec.com.br.

## Causa
`walkup@walkuptec.com.br` = `WABA_ADMIN_EMAIL` → role **master**. O serviço de ownership tinha bypass `isMasterViewer` que listava **todas** as instâncias da Evolution.

## Correção
- Removido bypass master/operacional em `waba-instance-ownership.service.ts`
- Regra: **cada usuário logado só vê instâncias com `ownerEmail` = seu e-mail** (inclui master)
- `claimOnRegister` no **início** de `POST /instancias/registrar-qrcode`
- Filtro em diagnósticos Disparador/Aquecedor, `GET /disparos/campanhas`, config Disparador

## Legado
Instâncias sem entrada em `data/instance-owners.json` não aparecem para ninguém até:
- novo cadastro pelo dono, ou
- entrada manual no JSON no VPS

Exemplo para Mozart:
```json
"Drax Sistemas 5181076973": {
  "ownerEmail": "mozart.pmo@gmail.com",
  "createdAt": "2026-06-16T12:00:00.000Z"
}
```

## Marker
`DEPLOY-2026-06-16-instancias-estritas-por-usuario-v2`
