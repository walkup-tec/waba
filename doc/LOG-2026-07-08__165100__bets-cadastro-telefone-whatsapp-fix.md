# LOG — Cadastro Bets: validação telefone/WhatsApp

**Data:** 2026-07-08  
**Contexto:** Cadastro em `http://localhost:3012/version-02/bets#cadastro` falhava com *"Informe um celular válido com DDD"* mesmo com telefone válido `(51) 98200-7943`. WhatsApp estava como `(55) 51999-6668` (código do país `55` tratado como DDD).

## Causa raiz

1. Máscara aceitava `55` no início do WhatsApp → dígitos `55519996668` (12) ou após strip parcial `5199966668` (10) — ambos inválidos para celular BR (11 dígitos, 3º = `9`).
2. Backend validava só o campo **WhatsApp** com `formatBrazilMobileForAsaas`, ignorando telefone celular válido no campo **Telefone**.

## Solução

1. **`src/billing/phone.ts`**
   - `stripBrazilCountryCode()` remove `+55` / `55` país quando colado no número.
   - `resolveSubscriberWhatsAppMobile(whatsapp, phone)` — tenta WhatsApp; se falhar, usa telefone quando for celular válido (11 dígitos, 3º = `9`).

2. **`src/subscribers/waba-subscriber.service.ts`**
   - `register()` e `update()` usam `resolveSubscriberWhatsAppMobile`.

3. **`public-pages/bets.html`** e **`public-pages/cadastro.html`**
   - Máscara `stripCountryCode` no front (não formata `55` como DDD).
   - Submit envia só dígitos.
   - Hint no campo WhatsApp da landing Bets.

## Arquivos alterados

- `src/billing/phone.ts`
- `src/subscribers/waba-subscriber.service.ts`
- `public-pages/bets.html`
- `public-pages/cadastro.html`

## Validação

```powershell
# Reiniciar V02 após mudanças em src/
npm run dev:v02

$body = @{
  fullName='Bets User Page Test'
  email='bets-test-phone-fix@example.com'
  password='264500mmS@'
  whatsapp='55519996668'
  phone='51982007943'
  cpfCnpj='72079930000'
  segment='bets'
  signupOrigin='bet-waba'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3012/version-02/subscribers/register' -Method POST -ContentType 'application/json' -Body $body
```

**Resultado:** `ok: true`, `whatsapp: "51982007943"` (fallback do telefone).

## Palavras-chave

`bets-cadastro`, `formatBrazilMobileForAsaas`, `stripBrazilCountryCode`, `resolveSubscriberWhatsAppMobile`, `whatsapp-55-ddd`, `telefone-valido`
