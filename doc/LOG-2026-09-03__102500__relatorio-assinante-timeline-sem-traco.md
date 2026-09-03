# LOG — Relatório do assinante sem marcos vazios

## Contexto

O assinante não deve ver "—" nem horário de fila no lugar do início do disparo.

## Solução

- A API só devolve marcos com instante conhecido.
- Início do disparo só com `sendStartedAt`.
- A UI ignora qualquer linha sem horário e mantém o aviso das 3 horas da Meta.

## Como validar

```bash
npm run test:campaign-report-timeline
```

## Palavras-chave

`timeline`, `sem traço`, `sendStartedAt`
