# LOG — Aquecedor: equidade entre instâncias no ciclo

**Data:** 2026-06-26  
**Marker:** `DEPLOY-2026-06-26-aquecedor-equidade-ciclo-pares`

## Pedido

Instâncias novas e maduras devem ter a **mesma oportunidade** de envio/recebimento. Eliminar ciclos dominadores (ex.: só walkup↔soma). O modo Preparando não explica sozinho a baixa frequência pós-6h.

## Causa

1. **`pickAquecedorCombinationAsync`** usava pool **exclusivo** de pares com `owesPairReply` — quando walkup/soma tinham resposta pendente, **nenhum outro par** era considerado.
2. **`scoreCombination`** favorecia histórico: `exchangeCount`, `sendCount` com peso baixo, bônus fraco para instâncias novas — pares maduros dominavam a rotação.

## Correção (`src/index.ts` — `loadAquecedorTurnManager`)

### Seleção
- Removido pool exclusivo `replyDue`; todos os elegíveis competem pelo menor score.
- `owesPairReply` continua com bônus forte (−10M), mas **não monopoliza** o ciclo.

### Score (menor = escolhido)
| Fator | Peso |
|-------|------|
| `sendCount` da origem | +1.000.000 / envio |
| `receiveCount` do destino | +100.000 / recebimento |
| Envios direcionados origem→destino | +50.000 / vez |
| Uso recente (últimos 32) | +500.000 × posição |
| Repetir mesma origem/destino do último global | +300k / +150k |
| Resposta pendente no par | −10.000.000 |

### Mantido
- `canSendDirected`: A→B exige B→A antes de novo A→B; origem bloqueada após envio até receber inbound (anti-spam WhatsApp).

## Validar

1. Deploy + `/health` com marker acima.
2. Reiniciar aquecedor com 4+ instâncias ativas.
3. Em 1–2h, logs de Envios devem mostrar **vários pares** (não só dois números).
4. Contagem de envios por instância tende a **nivelar** ao longo do dia.

## Palavras-chave

`aquecedor`, `equidade`, `scoreCombination`, `pickAquecedorCombination`, `owesPairReply`, `5182006011`, `walkup`, `soma`
