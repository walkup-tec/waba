# LOG — Jandira 2 de novo: 27 envios, verificação

## Contexto

O usuário informou que a Campanha Jandira 2 voltou a **Em andamento** no Disparo Cloud, com **27 envios feitos**. Pediu para conferir se esses envios de fato ocorreram. Sem `sendText`.

## O que deu para checar daqui

- Produção `https://waba.draxsistemas.com.br/health` → `ok` e marker `DEPLOY-2026-09-03-171800-oficial-dedupe-ai-edit` (código novo no ar: sem weblink lookaside + void do lote `26d33b09`).
- SSH `root@72.60.51.127` recusou chave. `VPS_SSH_PRIVATE_KEY` ausente neste ambiente.
- Workflow **Export Production Data (SSH)** no GitHub continua falhando (secret vazio). Runs `33739772898` e `29655618510`.
- Sem `meta-whatsapp-broadcasts.json` de produção neste workspace. Não foi possível ler `wamid`, `metaStatus` nem `errorCode` dos 27.

## Hipótese

Os **27** no painel Cloud são `campaign.sent`: POST Graph aceito (`HTTP 200` + `wamid`), `lead.status=sent`, `metaStatus=accepted`. Isso **não** é entrega. No lote anterior da Jandira 2, 1159 aceites viraram webhook `failed` / 131053.

Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status

## Confiança

- Código novo no ar: **Alta**
- 27 = aceite Graph (se o contador do Cloud é esse): **Média** (regra do código; JSON não lido)
- 27 chegaram no WhatsApp: **Baixa** (sem webhook `delivered`/`read`)

## Como fechar a dúvida no VPS

No container do `waba_disparador`, resumir o broadcast **novo** (não o void `26d33b09`) ligado ao intake `368d053b-…` / nome Jandira 2: `sent`, `failed`, breakdown de `metaStatus` e `errorCode`.
