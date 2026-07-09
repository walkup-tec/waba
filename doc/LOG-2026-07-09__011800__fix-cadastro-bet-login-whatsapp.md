# Fix cadastro Bet — login inválido + WhatsApp boas-vindas

## Contexto
Assinante `obotmobey@gmail.com` cadastrou na LP Bet, recebeu e-mail de boas-vindas, não recebeu WhatsApp e login retornava "E-mail ou senha inválidos".

## Diagnóstico
- `POST /auth/login` em produção falhou com a senha informada.
- `POST /subscribers/register` com o mesmo e-mail **não** retornou "já existe" — conta **não estava persistida** no `waba-subscribers.json` de produção no momento do teste.
- Hipótese: cadastro da LP não gravou no volume `/app/data` (write não atômico / bets_pv ainda sem proxy WABA no momento do cadastro original).

## Correções
1. **Persistência atômica** — `renameSync` em `waba-subscriber.repository.ts`
2. **Pós-gravação** — `register()` valida `getByEmail` + `verifyPassword` antes de concluir
3. **Boas-vindas síncronas na API** — `POST /subscribers/register` aguarda e-mail + WhatsApp e retorna `notifications`
4. **WhatsApp** — menos bloqueio por `connectionState` em preparação; fallbacks `walkup` e `drax-oficial`
5. **V02 tela branca** — `index.html` remove `bmInoperanteBtn` duplicado
6. **Deploy marker** — `DEPLOY-2026-07-09-bets-cadastro-login-whatsapp-fix`

## Ação para o assinante
Após deploy: **cadastrar novamente** na LP Bet (ou master excluir e-mail em Admin → Assinantes e refazer cadastro).

## Validar
1. Cadastro LP → login imediato com mesma senha
2. WhatsApp boas-vindas recebido (ou `notifications.whatsapp.status` no response)
3. `GET /health` → deploy marker novo

## Palavras-chave
`cadastro bets login`, `boas-vindas whatsapp`, `persistência assinante`, `obotmobey`
