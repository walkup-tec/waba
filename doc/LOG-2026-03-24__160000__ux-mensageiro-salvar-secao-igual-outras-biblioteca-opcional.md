# LOG: Mensageiro — Salvar seção igual às demais; biblioteca só por botão

## Problema

Após **Salvar configurações** na seção Mensageiro, o painel de nome da biblioteca **reabria sempre**, impedindo o fluxo igual às outras seções (recolher, ✓, **Editar**, abrir próxima seção).

## Solução

- **Salvar configurações** no Mensageiro usa o mesmo fluxo das demais seções (`disparosSectionCollapsedState`, avanço para Campanha quando aplicável).
- Antes disso, se for a seção Mensageiro (`idx === 5`), chama `hideMessengerLibrarySavePanel()` para fechar o painel da biblioteca.
- Novo botão **Adicionar produto à biblioteca** (modo IA) que abre o painel de nome + **Salvar na biblioteca** apenas quando o usuário quiser.
- Textos de ajuda do painel/hint ajustados.

## Arquivo

- `index.html`
