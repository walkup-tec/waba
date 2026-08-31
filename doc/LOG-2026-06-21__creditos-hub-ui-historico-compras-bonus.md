# LOG — Hub de Créditos (UI): saldo por API + histórico + compra

**Data:** 2026-06-21  
**Tipo:** feat / UI-UX

## Contexto

Pedido para transformar a aba **Créditos** em uma tela completa: saldo, histórico de compras, bonificações e contratação — considerando as duas modalidades de API (Oficial e Alternativa).

## Solução

### Backend
- `GET /billing/disparos/bonus-history?limit=20` — lista bonificações por campanha com status `pending` | `applied`.
- `WabaDisparosBonusRepository.listGrantHistory()` — FIFO por plano para marcar bonificações já creditadas em compras.

### Frontend (`index.html`)
- Aba **Créditos** (`tab-disparos-lancamento`) virou hub:
  - Intro + **Seu saldo** (totais + breakdown por API Oficial/Alternativa).
  - **Histórico** inline com abas Compras | Bonificações.
  - **Contratar créditos** (cards Oficial/Alternativa mantidos).
- Cards de contratação exibem saldo atual por API.
- Botão extrato na toolbar de Campanhas abre o hub na aba Compras.
- `goToDisparosAddCredits()` sempre navega para aba Créditos (não mais modal para assinantes).

## Arquivos alterados

- `src/billing/waba-disparos-bonus.repository.ts`
- `src/billing/waba-disparos-bonus.service.ts`
- `src/billing/waba-disparos-credits.service.ts`
- `src/billing/waba-billing.routes.ts`
- `index.html` (+ `dist/index.html` via build)

## Como validar

1. Login como assinante com compras → aba **Créditos**.
2. Ver saldo total + blocos API Oficial / Alternativa (contratados, consumidos, disponíveis, bonificados).
3. Aba **Compras** no histórico lista PIX confirmados com bônus aplicado quando houver.
4. Aba **Bonificações** lista campanhas finalizadas com status Pendente ou Creditado na compra.
5. **Contratar** em cada card abre fluxo PIX existente.
6. Toolbar Campanhas → ícone extrato → scroll para histórico de compras.

## Palavras-chave

`creditos-hub`, `disparos-lancamento`, `bonus-history`, `purchases`, `api-oficial`, `api-alternativa`, `byApi`
