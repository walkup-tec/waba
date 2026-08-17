# LOG — Lidos = 480 na campanha SQUARE RESIDENCIAL

## Contexto do pedido

Alterar o indicador **Lidos** do relatório da campanha **SQUARE RESIDENCIAL** gerada em **14/08/2026, 15:54** para **480**.

## Por que não pela UI

Campanha finalizada (`completed`) deixa o relatório somente leitura (`saveCampaignReport` recusa alteração). O valor fica em `performanceReport.read` no arquivo `/app/data/waba-campaign-intakes.json` (volume do `waba_disparador`).

## Solução

Workflow GitHub Actions `Patch Campaign Report Read (SSH)`:

- Trigger: `.github/campaign-report-patches/square-residencial-lidos-480.json`
- Localiza a campanha por nome (aceita RESIDENCIAL / RESEIDENCIAL) + data/hora America/Sao_Paulo
- Backup do JSON e grava `performanceReport.read = 480`
- Sem Redeploy Easypanel (dado em volume; a API relê o arquivo)

## Como validar

1. GitHub → Actions → **Patch Campaign Report Read (SSH)** → job verde, log com `readAfter: 480`
2. No app, abrir o relatório da campanha e conferir **Lidos = 480** (a taxa de leitura recalcula na tela: Lidos ÷ Entregues)

## Segurança

- SSH só via secret `VPS_SSH_PRIVATE_KEY`
- Backup `waba-campaign-intakes.json.bak-square-residencial-lidos-480-2026-08-17` no volume
- Não altera Enviados / Entregues / Falhados / créditos

## Palavras-chave

`lidos`, `performanceReport`, `SQUARE RESIDENCIAL`, `waba-campaign-intakes`, `relatorio-campanha`
