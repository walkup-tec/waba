# LOG: Biblioteca de produtos no Mensageiro + reset do painel ao criar campanha

## Contexto (resumo)

- No bloco **6) Mensageiro** (modo IA): após salvar a seção com sucesso, exibir área para **nome do produto** e gravar critérios na **biblioteca** (persistência em arquivo).
- Ao reabrir o Disparador: **select** com produtos salvos + opção **Novo produto**; ao escolher um produto, preencher automaticamente os campos de critérios da IA.
- Ao **criar uma campanha** com sucesso: variáveis do painel esquerdo voltam ao **estado original** (ex.: seleção de números com todos à esquerda, nenhum à direita; delays, limites, expediente e campos do Mensageiro nos padrões; WhatsApp do link vazio).

## Ações executadas

1. Backend (`src/index.ts`): arquivo `data/disparos-messenger-products.json` com fila simples de escrita; tipos e helpers; montagem de `aiBriefing` a partir dos campos quando necessário.
2. Rotas:
   - `GET /disparos/messenger-products` — lista ordenada por nome.
   - `POST /disparos/messenger-products` — upsert por `displayName` (case-insensitive); corpo com `displayName` + campos do Mensageiro.
3. Frontend (`index.html`): select **Biblioteca de produtos**, painel **Salvar na biblioteca**, listeners; `resetDisparosPanelToOriginalAfterCampaignCreate()` chamado após campanha criada + `POST /disparos/config` para persistir o reset.
4. Build: `npm run build` (copia `index.html` para `dist/`).

## Arquivos alterados

- `src/index.ts`
- `index.html` (e `dist/index.html` via script de cópia)

## Como validar

1. Subir o servidor (`npm start`), aba Disparos.
2. Preencher Mensageiro (IA), **Salvar configurações** na seção 6: deve aparecer o bloco para nome + **Salvar na biblioteca**.
3. Salvar um produto; recarregar a página: o select deve listar o produto; ao selecionar, os campos devem preencher.
4. Escolher **Novo produto**: campos voltam ao modelo vazio/padrão de tom/CTA/público.
5. Criar uma campanha com sucesso: conferir números todos em **disponíveis**, nenhum em **selecionados**, e demais valores padrão; opcionalmente recarregar e conferir persistência via API de config.

## Segurança

- Não há exposição de segredos; arquivo JSON em `data/` (pasta ignorada no git no projeto). Conteúdo é texto operacional do usuário — validação por tamanho no servidor.

## Palavras-chave (evitar duplicação)

- `messenger-products`, `disparos-messenger-products.json`, `GET /disparos/messenger-products`, `resetDisparosPanelToOriginalAfterCampaignCreate`, `dis-messenger-product-select`, biblioteca mensageiro
