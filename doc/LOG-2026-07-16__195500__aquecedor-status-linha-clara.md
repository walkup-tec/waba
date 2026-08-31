# LOG — Aquecedor: linha de status clara

**Data:** 2026-07-16 19:55  
**Marker:** `DEPLOY-2026-07-16-aquecedor-status-linha-clara`

## Contexto

Linha `Motor: ativo | processamento: sim | próximo: 16:02:00 | Aquecedor parado` confundia: hora sem data parecia “amanhã”, e `lastResult` técnico (“Aquecedor parado”) conflitava com motor ativo.

## Alteração (UI)

- `próximo:` → `dd/mm/aaaa - hh:mm:ss` (ou `agora` / `imediato` / `sem agendamento`)
- 4º campo deixa de ser `lastResult` e vira fase:
  - **Aquecedor processando**
  - **Aquecedor em pausa** (expediente/janela ou intervalo até o próximo envio)
  - **Aquecedor parado**
  - **Aquecedor ativo** (motor ligado, janela aberta, sem espera futura)
- Hero usa a mesma fase.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Keywords

`aquecedor`, `status`, `próximo`, `nextAllowedAt`, `Aquecedor em pausa`, `UI`
