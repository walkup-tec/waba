# LOG — Aquecedor: contagem falsa e pausa após expediente

**Data:** 2026-06-24

## Sintoma

Após previsão de intervalo (~22:59), UI mostrava novo countdown (~206s) mas nenhum envio desde 22:56. Mensagem `walkup → 5182006011` ficou «Em Fila». Status com «tempo esgotado».

## Causa

1. **Expediente segunda 7h–22h** — após 22h o motor não deve enviar; próximo retorno é na janela seguinte (terça ~7h).
2. **UI enganosa** — barra mostrava «Aguardando próximo ciclo: Xs» mesmo quando o motivo real era turno alternado, fila presa ou **fora do expediente**.
3. **Backend** — a cada 30s, enquanto `nextAllowedAt` no futuro, `lastResult` era sobrescrito para «Aguardando intervalo aleatório», apagando o motivo verdadeiro.
4. **Retries curtos** — falhas de turno/par reagendavam +60–180s mesmo fora do expediente, gerando countdowns infinitos sem envio.
5. **PROCESSANDO preso** — mensagem em fila >10min; reduzido para 5min.

## Correção

- `deferAquecedorRetryOrWindow()` — fora do expediente → `nextAllowedAt` na próxima janela real.
- Preservar `lastResult` específico durante espera de intervalo.
- `/aquecedor/status` retorna `windowOpen`, `nextWindowOpenAt`, `nextWindowOpenBr`.
- UI: pausa de expediente e motivos reais no hero + barra de progresso.

## Arquivos

- `src/index.ts`, `index.html`, `src/deploy-marker.ts`

## Validar

1. Após 22h (seg–qua): hero «Aquecedor em pausa (expediente)» + data do próximo retorno.
2. Durante turno bloqueado: texto «Aguardando turno…» com segundos, sem apagar motivo.
3. Mensagem PROCESSANDO >5min volta a PENDENTE.

## Palavras-chave

`aquecedor`, `nextAllowedAt`, `janela humanizada`, `intervalo aleatório`, `Em Fila`
