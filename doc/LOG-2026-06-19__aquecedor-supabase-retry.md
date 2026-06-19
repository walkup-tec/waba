# LOG — Aquecedor Supabase fetch failed

**Data:** 2026-06-19  
**Sintoma:** `Erro ao consultar fila processável: TypeError: fetch failed.`

## Causa

- Falha de **rede** entre o container Easypanel e a API Supabase (não é erro de lógica da fila).
- O fix anterior passou a expor o erro do Supabase em `lastResult` (antes falhava em silêncio).

## Correção

- `ensureAquecedorPendingMessage`: até 3 tentativas com `resetSupabaseClient()` entre elas.
- Mensagem amigável + `nextAllowedAt` 60s em falha transitória.
- Cliente Supabase sem persistência de sessão (`persistSession: false`).

## Marker

`DEPLOY-2026-06-19-aquecedor-supabase-retry`

## Se persistir após deploy

Conferir no Easypanel (`waba_disparador`):

- `SUPABASE_URL` — URL HTTPS do projeto (ex. `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — service role (não anon)
- Saída de rede do container liberada para internet
