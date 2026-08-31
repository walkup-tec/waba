# Bets cadastro — fluxo V02 imediato (sem “login em breve”)

## Contexto
Assinante Bet deve: cadastro segmento Bets → e-mail + WhatsApp boas-vindas → **acesso imediato** ao painel WABA (como `/version-02/bets`). Sem fluxo “time entrará em contato” nem login placeholder.

## Alteração
- `public-pages/bets.html`: removido painel “Cadastro recebido / contato do time”; restaurado redirect automático para `loginUrl` após sucesso (1,2s), com mensagem de boas-vindas.

## bet.waba.info `/login`
Tela “O login estará disponível em breve” é do app React **bets_pv** (deploy separado no Easypanel). Este commit cobre a landing/cadastro WABA em `/bets` e backend `/subscribers/register`. Ajuste do `/login` do bets_pv exige deploy desse serviço apontando para o painel WABA.

## Palavras-chave
`bets cadastro`, `login imediato`, `segmento bets`, `bets_pv login`
