# LOG — Reset owner mozart.pmo@gmail.com (instâncias + EVO)

## Pedido

Commit/push do fix de deadlock + zerar instâncias e resquícios de `mozart.pmo@gmail.com`, inclusive EVO, para começar do zero.

## Deploy deadlock

- Commit: `767ec28`
- Marker: `DEPLOY-2026-07-25-aquecedor-pair-deadlock-unlock`
- Ações: Deploy FTP + Redeploy Node

## Purge Mozart

- Script VPS: `scripts/purge-mozart-owner-reset-vps.sh`
- Workflow: `.github/workflows/purge-mozart-owner-reset.yml`
- Supabase scrub: `scripts/purge-mozart-supabase-remnants.cjs`

### Protegidas (EVO mantida)

- `walkup` — WhatsApp empresa
- `soma-crm` — risco cross-project

Demais instâncias no ownership do Mozart: logout+delete EVO + limpeza `/app/data` + force do serviço WABA.

## Validar

1. Actions → Purge mozart owner reset → run
2. EVO `fetchInstances` sem as purgadas
3. Painel Mozart sem instâncias (exceto protegidas se ainda vinculadas)
4. `/health` marker novo após Redeploy

## Palavras-chave

mozart purge, reset owner, deleteInstance, walkup protect, deadlock unlock
