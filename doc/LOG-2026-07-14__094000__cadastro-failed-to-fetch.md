# LOG — Failed to fetch no cadastro wabadisparos

## Sintoma
Formulário no ar; submit mostra **"Failed to fetch"**.

## Diagnóstico
- `GET /api/health` OK com marker cadastro-form
- `POST /api/subscribers/register` via proxy **funciona** (400 validação / 201 sucesso)
- Browser TypeError Failed to fetch = rede/timeout/CORS, não validação Zod

## Causas prováveis
1. **Register WABA aguardava SMTP+WhatsApp** antes do 201 → timeout no browser
2. Proxy flapping / CORS se fallback direto
3. E-mail já cadastrado (após tentativas) — deve retornar mensagem, não Failed to fetch

## Fix
- WABA: `notifySubscriberWelcomeEmail` async (marker `DEPLOY-2026-07-14-register-async-welcome`)
- CORS defaults incluem wabadisparos + bet
- PV: fallback fetch WABA direto + timeout 45s (marker `DEPLOY-2026-07-14-cadastro-failed-to-fetch-fix`)

## Redeploy
1. `waba_disparador`
2. `waba_paginadevendas`

## Conta teste e-mail da imagem
Se `mozart.hotmart@gmail.com` já existir: usar **Esqueci a senha** no painel.
