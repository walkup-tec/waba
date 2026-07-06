# LOG: Operacional — botão Confirmar início da campanha sem ação

## Contexto

Usuário de suporte (`apioficial@draxsistemas.com.br`) em Operacional → Campanhas clica em **Campanha Iniciada** no modal de detalhes e **nada acontece** (modal permanece, status não muda).

## Diagnóstico

- Fluxo: `POST /admin/operacional/campanhas/:id/iniciar` via `markAdminCampanhaStarted()`.
- Problemas de UX/resiliência:
  1. Erros de rede (`Failed to fetch`) só iam para toast no canto — fácil de não ver com modal aberto.
  2. Sem retry nas chamadas operacionais (diferente do fix recente de login/campanhas disparos).
  3. Botão rotulado **"Campanha Iniciada"** (passado) confunde com ação de confirmar início.
  4. `loadAdminCampanhas()` após sucesso podia deixar tabela em "Carregando…" enquanto modal já fechava.
  5. Estado do botão (`disabled`/texto) nem sempre resetado ao reabrir modal.

## Solução

1. **`fetchAdminOperacionalJson`** — `resolveWabaPublicPath` + retry (3x) para listagem, detalhes, iniciar, relatório e reportar erro.
2. **Feedback inline no modal** — `#admin-campanhas-detail-action-error` com mensagem visível em falha.
3. **Botão renomeado** para **"Confirmar início"**; estados Salvando… / reset ao fechar.
4. **Após iniciar** — fecha modal, toast, refresh silencioso + re-render da tabela (sem spinner global).
5. **Validação** — exige `Content-Type: application/json` e `payload.ok` na resposta.
6. **Backend** — `POST .../iniciar` distingue 400 (regra de negócio) vs 500 (falha interna) com log.

Marker: `DEPLOY-2026-06-25-operacional-campanha-iniciar-fix`

## Arquivos alterados

- `index.html`, `dist/index.html`
- `src/admin/waba-operacional-campanhas.routes.ts`, `dist/admin/waba-operacional-campanhas.routes.js`
- `src/deploy-marker.ts`, `dist/deploy-marker.js`

## Como validar

1. Login staff com menu Operacional Campanhas.
2. Campanha status **Aguardando configuração** → Ver detalhes → **Confirmar início**.
3. Modal fecha, toast verde, campanha passa para **Em andamento**.
4. Simular rede instável: mensagem vermelha **no modal** + toast, após retries.

## Palavras-chave

`operacional`, `Campanha Iniciada`, `Confirmar início`, `markAdminCampanhaStarted`, `fetchAdminOperacionalJson`, `admin-campanhas-start-btn`, iniciar
