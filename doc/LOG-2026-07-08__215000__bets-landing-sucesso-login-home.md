# Bets landing — botão login na tela de sucesso

## Pedido
Na landing Bets, após cadastro, exibir botão para **login do sistema** além de **Voltar para a home**.

## Solução (`public-pages/bets.html`)
- Painel de sucesso `#register-success-panel` com título "Cadastro recebido" e texto de contato do time.
- **Acessar login** → `loginUrl` (painel WABA, ex. `/version-02/` no V02).
- **← Voltar para a home** → `#top`.
- Removido redirect automático após cadastro; formulário oculto e painel exibido.

## Validar
`http://localhost:3012/version-02/bets` → cadastrar → ver os dois botões.

## Nota
`bet.waba.info` usa app React `bets_pv` (repo separado). Esta alteração vale para a rota WABA `/bets`.

## Palavras-chave
`bets.html`, `register-success`, `loginUrl`, `cadastro recebido`
