# Fix: cadastro assinante 400 — telefone vazio

## Sintoma
POST `/admin/subscribers` retornava 400:
`Informe um telefone válido com DDD (ex.: (11) 3333-4444 ou (11) 99999-9999).`

## Causa
`WabaSubscriberService.register` chamava `formatBrazilPhoneDigits("")` quando o painel admin não envia `phone` (só WhatsApp).

## Solução
Se `phone` vier vazio, usar o WhatsApp já validado como fallback.

## Arquivos
- `src/subscribers/waba-subscriber.service.ts`
- Máscaras CPF/CNPJ e WhatsApp no formulário admin (`index.html`)

## Validar
Admin · Assinantes → criar com WhatsApp `(51) 99966-6841` e CPF válido → 201.
