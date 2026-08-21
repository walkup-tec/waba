# LOG — Normalizar 9º dígito móvel BR (5182001261 ↔ 51982001261)

## Contexto
Usuários digitam/lembram o celular com ou sem o **9** após o DDD. Ex.: `5182001261` e `51982001261` são o mesmo número.

## Solução (backend)
Em `evo-instance-phone.service.ts`:
- `expandBrazilWhatsAppNumberVariants` — todas as formas (55 / sem 55 / com 9 / sem 9)
- `canonicalizeBrazilWhatsAppNumber` — chave estável (55+DDD+8) para dedupe
- `brazilWhatsAppNumbersMatch` — equivalência

Aplicado em: lookup aquecedor, resolve por telefone, ownership/delete keys, campanhas, push community, hint de validação inbound.

## Palavras-chave
9 digito, brazil phone, 5182001261, 51982001261, expandBrazilWhatsAppNumberVariants
