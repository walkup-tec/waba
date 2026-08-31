# LOG — Fix falso positivo CONFIRMAR no histórico

**Data:** 2026-06-08  
**Sintoma:** Passo 3 avançava para etapa 2 (resposta automática) sem o usuário enviar CONFIRMAR.

## Causa

`findMessages` retornava mensagens antigas com texto "Confirmar" no histórico. O sistema aceitava qualquer match no histórico, sem verificar se a mensagem era **nova**.

## Correção

- Só aceita mensagens com `messageTimestamp` **após** o início da validação
- Palavra-chave exata (case-insensitive): `CONFIRMAR`, não substring
- Nova validação substitui validação pendente da mesma instância

**Marker:** `DEPLOY-2026-06-08-validacao-inbound-fresh-only-v1`
