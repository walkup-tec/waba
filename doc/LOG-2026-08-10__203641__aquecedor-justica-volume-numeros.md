# LOG — Aquecedor: justiça de volume entre números (Mozart)

## Contexto

Em produção, `mozart.pmo@gmail.com` via coluna Mensagens com diferença grande entre números ativos no aquecedor.

## Evidências (Supabase `logs_envios`)

Instâncias do Mozart (owners locais/prod snapshot):

| Instância | Total (env+recv) |
|-----------|------------------|
| 6019-01 | 55 |
| 7943 | 50 |
| atendimento-8927 | 4 |
| drax-oficial | 3 |
| atendimento-8918 | 0 |
| final-1267 | 0 |

Pares internos: quase só `6019-01|7943` (15 trocas). Outros pares ~1.

## Causa raiz (confiança: Alta)

1. **Algoritmo**: `RelationshipManager` priorizava saldo A↔B e “resposta do turno” (boost ~8e9). Participação por número usava só *hoje* com peso ~1000 — irrelevante frente ao ping-pong.
2. **UI**: coluna Mensagens = histórico vitalício (`logs_envios`), não o dia — gap antigo não se auto-corrige.
3. **Operacional (parcial)**: se só 2 números estiverem elegíveis (open/active), o motor só pode aquecer esse par — isso também explica monopsônio; a correção algorítmica vale quando ≥3 elegíveis.

## Solução

Em `relationship-manager.service.ts`:

- Justiça vitalícia (`sentTotal+receivedTotal`) com peso alto
- Penalidade de origem superaquecida
- Não forçar resposta do turno em par quente se existem números frios
- Soft-filter: com spread alto, priorizar candidatos que tocam número frio

Simulação (12 picks com snapshot Mozart): **12/12** tocaram números frios; nenhum pick em `6019-01|7943`.

## Marker

`DEPLOY-2026-08-10-aquecedor-justica-volume-numeros`

## Validação pós-deploy

1. Redeploy EasyPanel
2. `/health` com marker acima
3. Aquecedor ligado com ≥3 números open/active
4. Ao longo de horas: coluna Mensagens dos números frios sobe; Saúde da rede mostra novos pares
5. `npx ts-node scripts/sim-phone-fairness-pick.ts` (local)

## Limite

Não equaliza o histórico de uma vez — equaliza o **próximo fluxo**. Números offline/preparando continuam sem volume.

## Palavras-chave

aquecedor, justiça volume, relationship-manager, mozart, 6019-01, 7943, phone fairness
