# Memória permanente — Relatório Meta e Disparo Cloud

Data: 2026-09-09

A Base `docs/project-memory/` passou a guardar o estado atual do relatório Lab e do Disparo Cloud, para o próximo agente não depender do chat.

## Onde ler

| Arquivo | O que ficou gravado |
|---|---|
| `docs/project-memory/01-ARCHITECTURE.md` | Fluxo envio → webhook → fechamento do JSON |
| `docs/project-memory/02-BUSINESS_RULES.md` | JSON não fecha só com `accepted`/`sent`; teto 3 h |
| `docs/project-memory/03-DATABASE.md` | Campos do `meta-whatsapp-broadcasts.json` |
| `docs/project-memory/04-INTEGRATIONS.md` | Webhook `statuses` e coleta |
| `docs/project-memory/05-DECISIONS.md` | 02/09 merge+refresh; 09/09 espera status Meta; override Opt in PTX |
| `docs/project-memory/06-CURRENT_STATUS.md` | Marker `204800` no GitHub; Redeploy pendente |
| `docs/project-memory/07-KNOWN_BUGS.md` | Campanha antiga não recupera webhook; mídia sem arquivo local |
| `docs/project-memory/08-DEPLOY.md` | Testes de relatório/Cloud e `blockRedeploy` |
| `docs/project-memory/09-TODO.md` | Validar coleta após Redeploy |

LOG da correção de código: `doc/LOG-2026-09-09__204800__relatorio-nao-fecha-sem-status-meta.md`.
LOG da causa em 02/09: `doc/LOG-2026-09-02__193000__relatorio-meta-entregues-lidos.md`.
Jandira 2 15:51: `doc/LOG-2026-09-03__192700__jandira2-travou-357-apos-redeploy.md`.
