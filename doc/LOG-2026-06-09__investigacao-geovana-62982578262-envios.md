# LOG — investigação Geovana 62982578262 (só recebeu?)

**Data:** 2026-06-09  
**Hipótese:** Instância `62982578262` (Geovana novo) só recebeu mensagens do aquecedor, sem enviar, desde a integração.

## Resultado

**Hipótese refutada pelos logs de produção.** A Geovana **enviou e recebeu** mensagens do aquecedor de forma equilibrada desde a integração.

## Referências

| Campo | Valor |
|-------|-------|
| Instância EVO | `Geovana novo` |
| Número | `62982578262` |
| Display | Valor Real Geovana Evelin |
| Integração (`createdAt`) | `2026-06-08T17:42:43.634Z` → **08/06/2026 14:42:43** (BRT) |
| Fonte | `GET /instancias`, tabela `logs_envios` / view `logs_envios_br` |

## Contagem pós-integração (08–09/06, todos os 132 ciclos do sistema)

| Instância | Como origem (enviou) | Como destino (recebeu) |
|-----------|---------------------:|-----------------------:|
| Walkup | 46 | 44 |
| **Geovana novo** | **41** | **44** |
| Marcelo Pessoal | 45 | 44 |

- Diferença Geovana: recebeu **3 a mais** que enviou (variação normal do round-robin `ciclo_global % combinações`).
- Participação no envio: **31,1%** dos 132 eventos (esperado ~33% com 3 instâncias).

## Linha do tempo (primeiros eventos)

1. **14:43:59** — Geovana **envia** → Marcelo Pessoal (~1 min após integração; padrão de **ciclo teste** — 2 envios em 4 s)
2. **14:44:03** — Geovana **envia** → Walkup
3. **14:48:53** — Geovana **recebe** ← Marcelo Pessoal (primeiro recebimento registrado, **5 min depois** do 1º envio)
4. **0 recebimentos** registrados antes do primeiro envio da Geovana

Distribuição de pares (Geovana):
- Enviou para: Marcelo 20×, Walkup 21×
- Recebeu de: Marcelo 22×, Walkup 22×

## Por que pode parecer “só recebeu”

1. **WhatsApp no celular** — mensagens de aquecimento vão para chats com Walkup/Marcelo; o usuário pode olhar só a caixa de entrada sem notar os chats de saída.
2. **Contador Evolution** — Geovana `messages: 702` vs Walkup `21559` / Marcelo `18933`: instância nova (1 dia), contador acumulado histórico menor.
3. **UI gráfico** — painel mostra “quem enviou”; recebimentos aparecem na lista de envios como `instanciaDestino`, não no gráfico de barras por origem.
4. **Ciclo teste inicial** — dois envios rápidos logo após integração podem ter sido confundidos com atividade das outras instâncias.

## Comandos usados

```text
GET https://waba.draxsistemas.com.br/dados?rangeStart=2026-06-08&rangeEnd=2026-06-09
GET https://waba.draxsistemas.com.br/aquecedor/envios?limit=200
GET https://waba.draxsistemas.com.br/instancias
```

## Próximo passo (se ainda houver dúvida no aparelho)

- Conferir no WhatsApp da Geovana os chats com Walkup e Marcelo por mensagens **“Mensagem de teste do aquecedor.”** ou textos da fila `aquecedor`.
- Cruzar com Evolution API (`sendText` logs) se suspeitar de HTTP 200 sem entrega real.
