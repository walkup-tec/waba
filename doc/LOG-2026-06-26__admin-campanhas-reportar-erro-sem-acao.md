# LOG: Admin Campanhas — botão Confirmar erro reportado sem ação

## Contexto

Master/operacional em Admin · Campanhas preenche justificativa e clica **Confirmar erro reportado** — nada visível acontece (modal permanece).

## Causa

Mesmo padrão do bug **Confirmar início** (já corrigido):
- Falhas e validação só em `showToast` (atrás do modal).
- Sem checagem de `payload.ok` / `Content-Type` JSON.
- `!campaignId` retornava silenciosamente.

## Solução

1. **`submitAdminCampanhasErrorReport`** — feedback inline em `#admin-campanhas-detail-action-error`, retry 3x, validação visível, `payload.ok`.
2. **Ao abrir formulário de erro** — oculta **Confirmar início**; reseta label do botão.
3. **`setAdminCampanhasDetailActionError`** — `scrollIntoView` quando há mensagem.
4. **Backend** `POST .../reportar-erro` — distingue 400 vs 500 com log (paridade com `/iniciar`).

Marker: `DEPLOY-2026-06-26-admin-campanhas-reportar-erro-fix`

## Validar

1. Campanha **Aguardando configuração** → Ver detalhes → Reportar Erro → justificativa (8+ chars) → **Confirmar erro reportado**.
2. Modal fecha, toast verde, campanha em **Finalizadas** com status Erro Reportado.
3. Justificativa curta: mensagem vermelha **no modal**.
4. Rede instável: mensagem no modal após retries.
