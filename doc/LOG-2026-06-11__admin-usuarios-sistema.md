# LOG — Admin · Usuários do sistema

**Data:** 2026-06-11

## Pedido
Novo menu Admin → **Usuários**: listar usuários do sistema e criar com Nome, E-mail, Senha e tipo (Master, Operacional, Suporte).

## Backend
- `src/users/waba-system-user.repository.ts` — persistência `waba-system-users.json`
- `src/users/waba-system-user.service.ts` — CRUD, hash senha, bootstrap do master via `.env`
- `GET/POST /admin/users` (somente master)
- Login `/auth/login` prioriza usuários do sistema antes do legado env/subscriber
- Papéis de sessão: `master`, `operacional`, `suporte`, `subscriber`
- Bootstrap na subida: se arquivo vazio, cria master de `WABA_ADMIN_EMAIL` / `WABA_ADMIN_PASSWORD`

## Frontend
- Menu **Usuários** (visível só para master)
- Formulário criar + tabela listagem
- Staff (`master`, `operacional`, `suporte`) vê seção Admin; gestão de usuários só master

## Validação
- Listagem: walkup master bootstrap OK
- POST criou `operacional@teste.walkup.com` com role operacional
- Login operacional retorna `role: operacional`

## Deploy marker
`DEPLOY-2026-06-08-admin-usuarios-sistema-v1`
