# LOG — Validação aceita CONFIRMA além de CONFIRMAR

## Contexto
Integração `1261` / número **5182001261** (UI `+55 51 8200-1261`; não confundir com `51982001261`). Passo 3 ficava em «Processando» ao enviar **Confirma**.

## Causa
Match estrito com keyword **CONFIRMAR**. `Confirma` → `confirma` ≠ `confirmar`.

## Correção
- `textMatchesKeyword` aceita aliases `confirma` e `confirmar`
- UI: nota «também aceita CONFIRMA»

## Como validar (agora, sem deploy)
Reenviar do **outro** WhatsApp: `CONFIRMAR` (ou `CONFIRMA`) para **+55 51 8200-1261**.

## Palavras-chave
validacao-inbound, CONFIRMAR, CONFIRMA, 5182001261, 1261
