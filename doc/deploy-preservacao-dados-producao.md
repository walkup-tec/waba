# Preservação de dados em deploy (produção)

Objetivo: **atualizar código** sem apagar o que usuários e operação já registraram.

## Regra de ouro

| O que sobe no deploy | O que NUNCA sobrescrever |
|----------------------|---------------------------|
| `dist/` (código compilado) | Volume **`/app/data`** |
| `scripts/` (utilitários) | Variáveis `.env` do Easypanel |
| Imagem Docker nova | Volume de dados nomeado no painel |

A pasta `data/` está no **`.gitignore`** de propósito — dados de produção **não** entram no Git.

---

## Onde cada tipo de dado fica

### Disco — `/app/data` (volume Easypanel)

| Área do sistema | Arquivo(s) principal(is) |
|-----------------|--------------------------|
| **Assinantes** | `waba-subscribers.json` |
| **Usuários (staff/master)** | `waba-system-users.json` |
| **Créditos** | `waba-billing-orders.json`, `waba-disparos-credit-usage.json`, `waba-disparos-bonus-balances.json` |
| **Financeiro** | `waba-financeiro-split-config.json`, `waba-financeiro-split-settlements.json` |
| **Campanhas (wizard)** | `waba-campaign-intakes.json` + pasta `campaign-intakes/` |
| **Campanhas / fila disparador** | `disparos-local-state.json` |
| **Aquecedor** | `aquecedor-instance-lifecycle.json`, `aquecedor-config.json`, `runtime-intent.json` |
| **Chamados suporte** | `waba-support-tickets.json` |
| **Instâncias por cliente** | `instance-owners.json`, `instance-aliases.json` |
| **Dashboard admin (badges)** | `waba-admin-master-menu-badges.json` |

### Supabase (nuvem)

- Campanhas e leads (`disparos_campaigns`, `disparos_campaign_leads`)
- Config e fila do aquecedor (tabelas `aquecedor_*`)
- Logs de envios (`logs_envios`) — relatórios

Com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` corretos, parte do estado **sobrevive** mesmo se o JSON local falhar — mas o volume `/app/data` continua obrigatório para assinantes, créditos, financeiro e suporte.

---

## Easypanel (Docker) — checklist

1. **Volume montado** em `/app/data` (nome persistente, ex. `waba-data`).
2. **Redeploy** = nova imagem + **mesmo volume** (não marcar “apagar volume” / recreate sem volume).
3. **Dockerfile** não copia `data/` (só `dist/`, `scripts/`, `media/`).
4. **Variáveis de ambiente** ficam no painel Easypanel — deploy Git **não** apaga env vars se você não remover manualmente.

### Antes de cada deploy (recomendado)

No shell do container ou host com acesso ao volume:

```bash
node scripts/backup-production-data.mjs --data-dir /app/data
```

Backups ficam em `/app/data/_backups/backup-YYYY-MM-DDTHH-MM-SS/`.

### Depois do deploy — validar

```bash
curl -sS https://waba.draxsistemas.com.br/health | jq '.dataPersistence'
```

Verifique:

- `dataDirWritable: true`
- Arquivos críticos (`catalog`) com `exists: true` e `sizeBytes` > 0 onde já havia dados

---

## FTP (GitHub Actions)

- O workflow **exclui** `**/data/**` do upload FTP.
- O `npm run bundle:ftp` gera `data/LEIA-ME-NAO-SOBRESCREVER.txt` apenas — **não** copia `data/v02` local.

Se o servidor de produção for **só Easypanel/Docker**, o fluxo FTP pode nem ser usado; o importante é o **volume** no Docker.

---

## O que causa perda de dados (evitar)

| Ação perigosa | Efeito |
|---------------|--------|
| Recriar container **sem** remontar volume `/app/data` | Perda total do JSON local |
| Enviar FTP com pasta `data/` de desenvolvimento | Sobrescreve assinantes/créditos de produção |
| `COPY data/` no Dockerfile com dados locais | Imagem errada (já removido) |
| Apagar volume no Easypanel | Irreversível sem backup |
| Dois ambientes apontando para o **mesmo** volume | Corrupção / mistura de dados |

---

## Scripts úteis

```bash
# Backup manual
node scripts/backup-production-data.mjs --data-dir /app/data

# Verificar bundle/CI antes de publicar
node scripts/verify-production-data-safety.mjs
```

---

## Ambientes locais (não confundir com produção)

| Ambiente | Pasta de dados |
|----------|----------------|
| V01 | `data/v01/` |
| V02 | `data/v02/` |
| Produção | `data/` no volume `/app/data` |

Deploy de `master` **não** deve alterar `data/v02` na sua máquina de dev.

---

## Palavras-chave

`preservacao-dados`, `/app/data`, volume Easypanel, backup-production-data, dataPersistence, deploy seguro
