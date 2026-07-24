# LOG — Análise: por que o aquecedor “quebrou” esta semana

**Data:** 2026-07-24  
**Objetivo:** ponto de restauração / entender o que mudou

## Hipótese do usuário

Até adicionar instâncias novas, o aquecedor (números antigos) enviava/recebia e obedecia os critérios. Depois passou a falhar.

## Duas camadas (as duas são verdade)

### A) Rede WhatsApp (números novos)

Instâncias recentes nesta semana (ex.: **6011**, **1261**, **6635**, **8918**, **8927**, problemas com **6973**) entram numa malha maior:

- Sessões EVO `open` com entrega **PENDING** / mensagem só na origem (visto em 6635→8918).
- Chats `@lid` dificultam `findMessages` no destino → o motor “acha” que falhou mesmo quando o critério de sucesso ficou mais rígido.
- Números novos aquecendo juntos = mais pares fracos; WhatsApp restringe mais fácil (piorado pela rajada de testes/variantes).

Os números **antigos estáveis** (ex.: soma, walkup, 1321, Final-2477) já tinham histórico e rotas quentes — por isso “funcionava perfeito”.

### B) Mudanças de código (timeline)

| Quando | Commit / tema | Efeito no comportamento |
|--------|----------------|-------------------------|
| **17/07** | `6c5fb81` equidade contínua de pares | Já orientava pares; base do “quem deve responder” |
| **22/07 ~12:30** | `3f913ed` Restrição WA + **Preparando 6h** | Instâncias novas ficam 6h fora do ciclo automático (correto), mas a UI/rede muda |
| **22/07 ~13:50** | `fac9909` turno do par (6011 só recebia) | Corrige assimetria A→B sem B→A; muda quem é escolhido |
| **24/07 ~08:00** | `7466153` motor por pares + rotatividade + saúde da rede | Novo score/grafo; mais “inteligente”, mais sensível a pares ruins |
| **24/07 ~09:21** | `360e8f8` sucesso só com entrega real (tag + origem **e** destino) | Fim do falso «Envio com Sucesso»; **mais falhas aparentes** quando findMessages/@lid falha |
| **24/07 ~10:20** | `e4df49e` **variantes de número + cooldown** | Se destino não confirma, **reenviava** variantes → padrão spam (risco de block) |
| **24/07 ~11:05–11:11** | Probes manuais (diagnóstico) | ~5 sendText em minutos → **block** confirmado no aparelho |

## O que “mudou” na prática

1. **Não foi só código:** a malha deixou de ser só números antigos confiáveis.
2. **O critério de sucesso ficou mais honesto** (09:21) → o painel parou de mentir; apareceu o problema real de entrega/sessão.
3. **O “conserto” das variantes (10:20)** piorou o risco WhatsApp ao insistir no mesmo par/texto.
4. O ponto em que o usuário *percebeu* falha forte (6635↔8918) coincide com **números novos + verify rígido + depois variantes**.

## Pontos de restauração (conceito)

| Objetivo | Restaurar / reverter conceito |
|----------|-------------------------------|
| Comportamento “antigo bom” de escolha | Antes de `7466153` (24/07 08:00), mantendo verify de junho |
| Remover risco de spam do motor | **Obrigatório:** sem reenvio por variante (`e4df49e` parcial) — já cortado no anti-spam local |
| Não voltar ao falso sucesso | **Não** reverter `360e8f8` (mentiria de novo no painel) |
| Operacional | Tirar do ciclo números novos com entrega só-origem / block; deixar Preparando 6h + aquecer aos poucos com **1** envio/ciclo |

## Nota de correção (visão do produto)

Não tratar o modo antigo (sucesso ≈ EVO aceitou) como “sempre mentia”.
Houve **incidente pontual** em 2026-06-20 (soma→drax sem chegar), mas na operação
com números antigos estáveis o usuário confirma: **na prática enviava e recebia**.
O que importa para o aquecedor é a mensagem no WhatsApp — e isso funcionava bem
nessa malha.

O aperto da prova em 24/07 (findMessages origem+destino) pode marcar falha quando
a indexação EVO/@lid falha, mesmo em cenários em que a malha antiga “simplesmente
funcionava”. O problema desta semana combina **números novos frágeis** + **critério
mais rígido** + (temporariamente) **reenvio por variantes** — não “o antigo era fake”.

## Conclusão

O aquecedor “começou a dar problema” porque **(1)** entraram instâncias novas com entrega/sessão frágil e **(2)** na mesma semana a prova de entrega ficou mais rígida (e, por um momento, houve reenvio por variantes) — não porque o modo antigo “só mentia”. Com a malha antiga estável, o comportamento prático (enviar/receber) estava alinhado ao que o usuário via.

## Keywords

restauração, timeline, 8918, 6635, 6011, variantes, delivery-verify, pares, anti-spam
