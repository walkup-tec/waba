# LOG — Aquecedor: fila multi-instância (5 instâncias, só 2 conversando)

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-fila-multi-instancia`

## Contexto / pedido

Produção com **5 instâncias no ciclo**, mas histórico de envios mostrava apenas **soma ↔ drax** alternando. Mensagem `soma → drax` ficava **Em Fila** enquanto o motor aguardava intervalo.

## Causa raiz

1. **`owesPairReply`** usava `lastReceivedFrom === destino` global — após cada envio o receptor “devia” responder para sempre, mantendo ping-pong exclusivo entre o mesmo par.
2. **`pickAquecedorCombinationAsync`** dava pool **exclusivo** a pares com resposta pendente — enquanto soma/drax tinham pendência (lógica errada), **nenhum outro par era elegível**.
3. **`scoreCombination`** penalizava fortemente (-1.5M) quem tinha recebido recentemente do destino, reforçando o mesmo par.

## Solução

**Arquivo:** `src/index.ts` — `loadAquecedorTurnManager`

- **State machine por par** (`pairStates.pendingReplyFrom`):
  - A→B define `pendingReplyFrom = B`
  - B→A (resposta) zera pendência → par **idle**
  - Nova abertura A→B só exige resposta de B de novo
- **`outboundSinceInbound`** por instância: bloqueio global só enquanto enviou sem receber **qualquer** inbound; ao receber, libera envio para outros pares.
- **`owesPairReply`**: true somente quando `pendingReplyFrom === origem` naquele par.
- **`scoreCombination`**: fairness — prioriza instâncias/pares com menos envios; remove viés de `lastReceivedFrom`.

**Arquivo:** `src/deploy-marker.ts`

## Arquivos alterados

- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/` (build local)

## Como validar (produção)

1. Deploy `waba_disparador` (push `master`).
2. `GET https://waba.draxsistemas.com.br/health` → marker `DEPLOY-2026-06-21-aquecedor-fila-multi-instancia`.
3. Reiniciar aquecedor no painel.
4. Com 5 instâncias conectadas, confirmar nos logs envios entre **pares diferentes** (não só soma↔drax).
5. Regra mantida: após A→B, B deve responder antes de novo A→B no mesmo par.

## Comandos

```powershell
Set-Location E:\Waba
npm run build
```

Exit 0.

## Palavras-chave

`aquecedor`, `turn-manager`, `owesPairReply`, `pairStates`, `multi-instancia`, `fila-distribuicao`, `soma-drax`
