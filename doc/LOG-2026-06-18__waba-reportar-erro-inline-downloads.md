# LOG — Reportar Erro inline no modal operacional

**Data:** 2026-06-18  
**Solicitação:** Botão "Reportar Erro" ao lado de "Baixar imagem" e "Baixar leads (planilha)" no modal de atendimento da campanha (usuário operacional).

## Alteração

- `index.html`: `admin-campanhas-report-error-btn` movido de `.confirm-actions` para `.admin-campanhas-downloads` (mesma linha flex dos downloads).

## Validação

1. Login operacional → Campanhas → Detalhes de campanha elegível (`canReportError`).
2. Confirmar três botões na mesma linha: Baixar imagem | Baixar leads | Reportar Erro.
3. Ao clicar Reportar Erro, textarea aparece abaixo; "Confirmar erro reportado" permanece no rodapé.

## Pendências

- Deploy produção se necessário (atualizar `index.html` no serviço).
