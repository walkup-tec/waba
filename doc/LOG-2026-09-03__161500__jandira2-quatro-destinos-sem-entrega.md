# LOG — Jandira 2: quatro destinos sem mensagem no WhatsApp

## Contexto

O usuário disparou a campanha **Jandira 2** para `51999666841`, `5198335401`, `5181077770` e `5197979224`. Nenhum recebeu no WhatsApp. Pedido: verificar. Sem `sendText`.

## Ações

- Produção `GET /health` → `deployMarker` `DEPLOY-2026-09-03-135600-relatorio-timeline-visual` (HTTPS 200).
- SSH `root@72.60.51.127` recusou chave. `VPS_SSH_PRIVATE_KEY` ausente neste ambiente. GitHub Actions export 403 no PAT.
- Normalização local Cloud (mesma função do Disparo Cloud):

| Colado | Destino E.164 que a Graph receberia |
|---|---|
| 51999666841 | `5551999666841` |
| 5198335401 | `5551998335401` |
| 5181077770 | `5551981077770` |
| 5197979224 | `5551997979224` |

Os quatro passam na validação. Não são recusados como inválidos.

Identidade já documentada no repo: Marcelo Pessoal (`51999666841`), WB-5401 (`5198335401`), WB-7770/drax (`5181077770`), WB-9224 (`5197979224`).

Wizard do assinante exige ≥ 1000 contatos. Quatro linhas sozinhas só entram no **Disparo Cloud** (planilha do Laboratório), não no wizard.

JSON de produção lido no VPS (script no container disparador):

- intake `368d053b-d59b-4eed-a235-fe9e9f32c68c` — Campanha Jandira 2, `in_progress`, 1990 importados
- broadcast `26d33b09-8868-41dd-af78-afd59e7982f2` — template `jandira_quantun_2`, `done`, 1159 sent, 0 failed no POST Graph, `15:11`–`15:59` UTC
- `metaStatus` de **todos** os 1159 leads: `failed`
- Os quatro destinos: `status: sent`, `metaStatus: failed`, `errorCode: 131053`, weblink HTTP 403, `wamid` presente

## Leitura

A Graph aceitou o POST (por isso há `wamid`). O webhook da Meta recusou a mídia do cabeçalho: URL de exemplo lookaside/fbcdn com HTTP 403 (`131053`). Ninguém recebeu no WhatsApp. Correção: `doc/LOG-2026-09-03__163000__fix-header-weblink-403.md`.

## Palavras-chave

`jandira 2`, `5551999666841`, `5551981077770`, `meta-whatsapp-broadcasts`, `131053`, `weblink`
