# LOG - fix-instancias-avatar-refresh-cache-bust

## Contexto do pedido

Usuario reportou que, ao trocar a foto de perfil no WhatsApp, a tela de `Instancias` nao atualizava mesmo clicando em `Atualizar`.

## Acoes executadas

- Investigado o fluxo de avatar:
  - UI montava `src` com `profilePicUrl + ?v=avatarVersion`.
  - `avatarVersion` dependia de `updatedAt` vindo da API externa.
- Identificada causa raiz:
  - Em alguns casos, `updatedAt` nao muda junto da foto, mantendo a mesma URL e permitindo cache antigo no navegador/CDN.
- Correcao aplicada no frontend (`index.html`):
  - Criada variavel global `avatarRefreshNonce`.
  - Atualizada a URL da imagem para incluir nonce adicional `&r=<timestamp>`.
  - Em cada execucao de `carregar()`, nonce e renovado com `Date.now()`.
- Resultado:
  - Cada clique em `Atualizar` (ou recarga da lista) gera URL unica para o avatar, forcando novo fetch da imagem.

## Arquivos alterados

- `index.html`
- `dist/index.html` (build)

## Validacao

- Comando executado:
  - `npm run build`
- Resultado:
  - build concluido com sucesso
  - sem erros de lint no arquivo alterado

## Observacoes de seguranca

- Nenhum segredo exposto.
- Alteracao somente de cache-busting em URL de imagem no frontend.

## Palavras-chave para evitar duplicacao futura

- instancias-avatar-refresh
- profile-pic-cache-bust
- avatarRefreshNonce
- atualizacao-foto-whatsapp
