# betwaba-connect — push cadastro/login paridade V02

## Contexto
Usuário pediu consolidar alterações da landing Bets no repo `betwaba-connect` (bets_pv / bet.waba.info), commit único e push.

## Repo
- https://github.com/walkup-tec/betwaba-connect
- Commit: `fdf6930` — `[f2f30f9] feat: cadastro WABA real, login painel e paridade landing Bets V02`
- Branch: `main`

## O que foi enviado
| Área | Mudança |
|------|---------|
| Cadastro | API real via proxy → WABA `/subscribers/register` (Bets, boas-vindas, redirect) |
| Login | `/login` + Entrar → painel WABA |
| Landing | Preço R$ 0,33; logo +30% |
| Infra | `.env.example`, `DEPLOY-EASYPANEL.md` |

## Deploy bets_pv (Easypanel)
1. Rebuild serviço `waba_bets_pv` a partir de `main`
2. Env: `WABA_API_URL=https://waba.draxsistemas.com.br`, `VITE_WABA_APP_LOGIN_URL=https://waba.draxsistemas.com.br/`
3. Testar: bet.waba.info/cadastro → redirect waba.draxsistemas.com.br

## Palavras-chave
`betwaba-connect`, `bets_pv`, `bet.waba.info`, `cadastro proxy`
