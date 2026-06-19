# LOG — Aquecedor mensagens aleatórias do banco

**Data:** 2026-06-17  
**Marker:** `DEPLOY-2026-06-17-aquecedor-random-messages`

## Problema

Usuário reportou que o aquecedor só envia: *"Olá! Tudo bem? Mensagem automática do aquecedor."*

## Causa

`ensureAquecedorPendingMessage()` (adicionada em 2026-06-08) enfileirava **sempre** esse texto fixo quando a fila `aquecedor` ficava sem `PENDENTE` processável.

No Supabase DEV: 4 linhas `ENVIADO` com o mesmo texto; `disparos_message_templates` vazio; sem tabela de banco.

Em produção (histórico): ~38k linhas `PENDENTE` na própria fila `aquecedor` (cada uma com texto diferente). Ao esgotar a fila, o fallback fixo passou a repetir.

## Correção

- `pickAquecedorMessageText()` sorteia do banco, evitando as últimas 50 mensagens `ENVIADO`.
- Ordem do banco: `aquecedor_message_templates` → `mensagens` (legado) → `disparos_message_templates` → histórico `ENVIADO` distinto.
- Fallback só se o banco estiver vazio.
- Diagnóstico: `supabase.messageBankCount`.
- SQL: `doc/SQL-2026-06-17__create-aquecedor-message-templates.sql`

## Pendências operacionais

1. Executar SQL no Supabase (DEV e produção).
2. Importar mensagens para `aquecedor_message_templates` (ou migrar `distinct mensagem` da fila antiga).
3. Redeploy / reiniciar `dev:v02`.
