# LOG — IA Utility: memória dos aprovados do tenant

## Contexto

O usuário perguntou se o GPT integrado foi treinado para ficar mais inteligente, e pediu realimentação com os templates **já aprovados como Utilidade**.

## Resposta técnica

Não há fine-tune. O assistente usa o GPT configurado (`OPENAI_API_KEY`) com prompt + pós-processo de léxico. A “memória” é few-shot: a cada geração entram até 8 templates do **mesmo tenant** com `status=APPROVED` e `category=UTILITY`.

## Ações

- `pickApprovedUtilityExamples` lê o catálogo local (Supabase).
- `generateFromAuth` envia `approvedUtilityExamples` no input do GPT.
- Prompt 1.5: imitar estrutura, não copiar texto, sem prometer aprovação.

## Como validar

```bash
npm run test:meta-template-ai
```

Funcional: ter pelo menos um template APPROVED/UTILITY, gerar de novo e conferir no log `approvedExampleCount`.

## Palavras-chave

few-shot, approved, UTILITY, memória, openai, sem fine-tune
