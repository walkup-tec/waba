# LOG — Master walkup V02 → produção

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-master-v02-promote-walkup`

## Pedido

Migrar **tudo** do usuário master `walkup@walkuptec.com.br` do ambiente **V02** para **produção**, sem alterar dados de assinantes (ex.: mozart).

## Solução

1. **`scripts/migrate-master-v02-full-to-production.cjs`** — export/import/remote do bundle master
2. **`POST /admin/master/promote-from-v02`** — aplica bundle em `/app/data` (somente master logado)
3. **`WabaAdminMasterPromoteService`** — merge escopado por e-mail master

### O que migra (walkup only)

- `waba-system-users.json` — registro master (menus, senha hash, flags)
- `waba-financeiro-split-config.json` — config split
- `waba-financeiro-split-settlements.json` — liquidações (merge por id)
- `waba-master-menu-seen.json` — entrada do master
- `aquecedor-config.json`
- `aquecedor-envios-log.json` — itens com `ownerEmail` walkup
- Créditos/pedidos/campanhas/intakes/instâncias **somente** se `ownerEmail`/`email` = walkup

### O que NÃO migra (proteção assinantes)

- Registros em `waba-subscribers.json` de outros e-mails
- `instance-owners` de mozart/outros assinantes
- Tickets de suporte de assinantes
- Reatribuição de instância já owned por outro e-mail em produção

## Bundle V02 local (D:\Waba\data\v02)

| Item | Qtd |
|------|-----|
| menuPermissions | 13 menus admin/produto |
| aquecedorEnviosLog | 177 |
| financeiroSettlements | 4 |
| financeiroSplitConfig | sim |
| aquecedorConfig | sim |
| instanceOwners walkup | 0 (V02 usa mozart para testes) |

## Executar

### 1) Deploy (commit + push master)

### 2) Remoto (PC com .env.v02)

```powershell
cd E:\Waba
$env:WABA_V02_DATA_DIR='D:\Waba\data\v02'
node scripts/migrate-master-v02-full-to-production.cjs walkup@walkuptec.com.br --remote https://waba.draxsistemas.com.br
```

### 3) Ou shell Easypanel produção

```bash
# Copiar export para /tmp/walkup-master-v02 (bundle.json + campaign-intakes/)
node scripts/migrate-master-v02-full-to-production.cjs walkup@walkuptec.com.br --import-dir /tmp/walkup-master-v02 --apply-data-dir /app/data
```

Reiniciar container Node após aplicar.

## Validar

1. Login master produção — menus admin completos
2. Aba Aquecedor → log de envios (177 entradas walkup)
3. Admin → Financeiro → split config/settlements
4. Assinante mozart inalterado (instâncias e créditos)

## Palavras-chave

master promote v02, walkup@walkuptec.com.br, promote-from-v02, migrate-master, assinantes intocados
