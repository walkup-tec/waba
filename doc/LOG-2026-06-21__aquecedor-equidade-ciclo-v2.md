# LOG — Aquecedor: equidade de ciclo v2 (composição e execução)

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-equidade-ciclo-v2`

## Problema

Após deploy de equidade (2026-06-26), par **5182006011 ↔ digital-corban-2477** concentrou ~83% dos envios; **soma** e **walkup** ficaram com ~10% e ~6%. Meta do usuário: distribuição equilibrada (~25% por “faixa” de participação entre as 4 instâncias ativas).

## Causa raiz

`owesPairReply` aplicava bônus **−10.000.000** no score — sempre vencia sobre qualquer par com menos histórico. O par dominante alternava A→B / B→A e monopolizava o ciclo mesmo com instâncias periféricas elegíveis.

## Nova composição do ciclo (`src/index.ts`)

### 1. Score de equidade (`scoreEquityCombination`)

Menor score = escolhido. Prioridade:

| Fator | Peso |
|-------|------|
| Envios na aresta origem→destino vs mínimo entre elegíveis | × 10¹² |
| Envios totais da origem vs mínimo entre elegíveis | × 10⁹ |
| Recebimentos do destino vs mínimo entre elegíveis | × 10⁶ |
| Uso recente (últimos 32) | +10k × posição |
| Resposta pendente no par | **−500** (só desempate, não monopoliza) |
| Rotação `ciclo_global` | +0,001 × índice |

### 2. Filtro de saturação de par

- Com histórico ≥ N instâncias, pares não direcionais acima de **max(50%, 2/N)** do total são **excluídos** se existir alternativa elegível.
- Ex.: 4 instâncias → teto ~50% por par; par com 83% deixa de ser escolhido quando soma/walkup podem enviar.

### 3. Mantido (regras WhatsApp)

- `canSendDirected`: alternância A→B / B→A por par; origem bloqueada após envio até inbound.
- Cota diária, janela humanizada, verificação de entrega.

## Arquivos

- `src/index.ts` — `loadAquecedorTurnManager`, `pickAquecedorCombinationAsync`
- `src/deploy-marker.ts`

## Validar (mozart.pmo@gmail.com, 4 instâncias ativas)

1. Redeploy + `/health` → marker acima.
2. Reiniciar aquecedor.
3. Após 1–2h, `logs_envios` deve aproximar:
   - ~25% arestas digital-corban ↔ 5182006011 (ida + volta)
   - ~25% envolvendo soma
   - ~25% envolvendo walkup
4. Nenhuma instância ativa com 0 envios/recebidos por longos períodos.

## Palavras-chave

`aquecedor`, `equidade`, `scoreEquityCombination`, `maxUndirectedPairShare`, `pickAquecedorCombinationAsync`, `5182006011`, `digital-corban-2477`, `soma`, `walkup`
