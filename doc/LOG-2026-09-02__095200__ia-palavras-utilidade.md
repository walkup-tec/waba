# LOG — IA Utility: palavras de confirmação/status

## Contexto

Incluir no assistente âncoras que a Meta tende a ler como Utility: Confirmação, Status Confirmado, Confirmado, aprovado, concluído, atualizado, liberado.

## Solução

- Prompt **1.7**: seção PALAVRAS DE UTILIDADE; uma âncora por opção.
- Shaper: se o BODY não tiver nenhuma, injeta atualizado / status confirmado / concluída e liberada.
- Exemplos do prompt passaram a usar atualizada, status confirmado, concluída e liberada.

## Como validar

```bash
npm run test:meta-template-ai
```

Gerar 3 opções e conferir o fato depois de Informamos que.

## Palavras-chave

utility, confirmação, status confirmado, aprovado, concluído, atualizado, liberado
