# LOG — Aquecedor: limite diário bloqueou envios no expediente

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-aquecedor-limite-diario-expediente`

## Contexto

Relato: nenhum envio do Aquecedor durante o dia. Na UI:
- Motor ativo, expediente personalizado **5h–23h**
- Status: `walkup: Limite diário de aquecimento atingido (9/9)`
- Histórico de envios: 9 sucessos entre **01:26** e **02:05** (madrugada), nada após abertura do expediente

## Causa raiz

1. **Cota diária esgotada de madrugada** — a instância `walkup` consumiu 9/9 envios antes do expediente (5h).
2. **Ciclo travava na instância sem cota** — ao atingir limite em `walkup`, o motor parava sem tentar as outras instâncias ativas no ciclo.
3. **Timezone frágil na janela** — `nowInSaoPaulo()` usava `new Date(toLocaleString(...))`, dependente do fuso do servidor; `isAquecedorWindowOpen` também retornava `false` cedo demais quando o primeiro lote de expediente não batia horário (em vez de `continue`).

## Solução

### `src/index.ts`
- `readSaoPauloClock()` com `Intl.DateTimeFormat` + `America/Sao_Paulo` (horário e dia confiáveis).
- `isAquecedorWindowOpen` reescrito: múltiplos lotes de expediente + `continue` em horário fora do lote.
- `pickAquecedorCombinationWithDailyQuota` — escolhe par elegível **com cota diária**; se só houver instâncias no limite, agenda retomada na **meia-noite SP**.
- Guarda extra antes do envio: aborta se saiu do expediente entre seleção e disparo.
- Contador diário só incrementa se ainda dentro da janela (`recordAquecedorInstanceDailySend` condicionado).
- `refreshAquecedorDailyCapsIfNeeded()` no início de cada ciclo.

### `src/services/aquecedor-instance-lifecycle.service.ts`
- `refreshAquecedorDailyCapsIfNeeded()` — zera contadores ao virar o dia (SP) e persiste.
- `canAquecedorInstanceSendToday` persiste rollover de `dailyDate`.

## Arquivos alterados

- `src/index.ts`
- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/deploy-marker.ts`

## Como validar

1. `npm run build` — OK.
2. Com motor ativo e 2+ instâncias: se uma atingir limite, outra deve enviar no expediente.
3. Fora do expediente (ex.: 2h com janela 5–23h): status “Fora da janela humanizada”, sem novos envios.
4. Após meia-noite SP: contadores zerados; envios retomam dentro do expediente.
5. `GET /health` → marker `DEPLOY-2026-06-25-aquecedor-limite-diario-expediente`.

## Observações

- Envios já contabilizados hoje em `walkup` (9/9) permanecem até meia-noite SP; as **outras instâncias** do ciclo devem voltar a enviar após deploy.
- Endpoints `/aquecedor/run-once` e `/aquecedor/criar-mensagem-teste` continuam com bypass de janela (teste manual).

## Palavras-chave

`aquecedor`, `limite-diario`, `expediente`, `walkup`, `timezone`, `America/Sao_Paulo`, `pickAquecedorCombinationWithDailyQuota`, `refreshAquecedorDailyCapsIfNeeded`
