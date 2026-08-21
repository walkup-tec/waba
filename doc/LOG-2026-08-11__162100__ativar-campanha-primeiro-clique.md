# LOG — Ativar campanha no 1º clique + anti duplo clique

## Contexto do pedido

O botão **Ativar** nas campanhas de disparo não respondia de forma confiável no primeiro clique e permitia risco de duplo clique. Campanhas grandes (ex.: ~2k leads) ao ativar sofriam hydrate pesado no backend (incluindo `message_text`), o que podia estourar o timeout do fetch no browser.

## Ações executadas

- Ajuste backend: `hydrateCampaignFromDbIfNeeded` com `lightLeads` / `skipLeads`; `POST /disparos/campanhas/:id/estado` usa `lightLeads: true`.
- Ajuste frontend: `setDisparosCampaignActive` com timeout 60s, `credentials: "same-origin"`, `resolveWabaPublicPath`.
- Toggle via `pointerdown` (mesmo padrão do Push) para o 1º clique não ser cancelado por blur.
- Lock anti duplo clique: `disparosCampaignToggleInflight`, `toggleBusy`, `disabled` + `pointerEvents: none`, texto «Ativando…», ~800ms pós-sucesso.
- Marker: `DEPLOY-2026-08-11-ativar-campanha-primeiro-clique`.
- `npm run build` em worktree `Waba-prod-prep` (base `origin/master` / `e9e1014`).

## Solução implementada (passo a passo)

1. Hydrate leve no ativar: seleciona leads sem `message_text`/`short_url` para responder rápido.
2. UI dispara no `pointerdown` (capture), não só no `click`.
3. Bloqueio imediato do botão até conclusão da API (+ breve cooldown).
4. Timeout do cliente aumentado para 60s (alinhado a campanhas grandes ainda com hydrate de metadados).

## Arquivos criados/alterados

- `src/index.ts` — hydrate leve no `/estado`
- `index.html` — toggle 1º clique + anti duplo clique
- `src/deploy-marker.ts` — novo marker
- `dist/*` — build gerado
- `doc/LOG-2026-08-11__162100__ativar-campanha-primeiro-clique.md` (este arquivo)
- `doc/memoria.md` — resumo

## Como validar

1. Commit + push `origin/master` (quando autorizado).
2. Redeploy EasyPanel `waba_disparador`.
3. Confirmar `GET /health` com marker `DEPLOY-2026-08-11-ativar-campanha-primeiro-clique`.
4. Em campanha pausada (ex. Vem Card 02): um único clique em **Ativar campanha** → botão vira «Ativando…» e bloqueia; após sucesso vira **Pausar** e dispara começa.
5. Não validar ativando via API sem OK do usuário (envios reais).

## Observações de segurança

- Sem exposição de segredos.
- Não ativar campanha de produção automaticamente nesta tarefa.

## Palavras-chave (evitar duplicação)

ativar, primeiro clique, duplo clique, pointerdown, lightLeads, hydrate, estado campanha, Ativando, toggleBusy
