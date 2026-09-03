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

JSON de produção (`meta-whatsapp-broadcasts.json` / intake Jandira 2) **não foi lido**.

## Leitura

Sem o JSON não dá para afirmar se a Graph recusou, aceitou sem `delivered`, ou se o disparo nem gravou leads. Os números em si não são o bloqueio da validação.

Hipótese a checar no JSON: `status`/`metaStatus`/`errorCode`/`wamid` de cada `waId` acima. Para `5181077770`, logs antigos da Evolution usaram `555181077770` (sem o 9); o Cloud mandaria `5551981077770`.

## Palavras-chave

`jandira 2`, `5551999666841`, `5551981077770`, `meta-whatsapp-broadcasts`, `131026`
