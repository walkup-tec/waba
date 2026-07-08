# LOG — V02 menu Bets: Dashboard/Instâncias não pula mais para API Oficial

**Data:** 2026-07-08  
**Contexto:** Assinante Bets no V02 — ao clicar **Dashboard** ou **Instâncias** (menu Aquecedor), o sistema mudava para **API Oficial** em vez de manter o menu/aba escolhida.

## Causa raiz

1. **`enforceBetsSubscriberIntegrationEnv()`** — para todo assinante `segment: bets`, se o ambiente não fosse `oficial`, forçava `setActiveTab` na API Oficial. Impedia navegação no menu Aquecedor.
2. **`syncSubscriberDisparosMenuLayout()`** — sempre abria o grupo lateral `oficial`, mesmo com aba ativa no Aquecedor.

## Solução (`index.html`)

- `enforceBetsSubscriberIntegrationEnv`:
  - Continua bloqueando apenas **API Alternativa** (redireciona para Oficial).
  - Em abas do menu **Aquecedor** (`dashboard`, `instancias`, `aquecedor`), mantém ambiente `nao-oficial` e **não** troca de aba.
  - Sincroniza strip para Oficial só quando a aba ativa é do grupo Disparos/API Oficial.
- `syncSubscriberDisparosMenuLayout`: abre o grupo lateral da **aba ativa** (`resolveMenuGroupForTab(activeTab)`).

## Arquivos

- `index.html` (+ `dist/index.html`)

## Como validar

1. Ctrl+F5 em `http://localhost:3012/version-02/`
2. Login como assinante Bets (`mozart.hotmart@gmail.com` ou `digitalcorban@gmail.com`)
3. Clicar **Dashboard** → permanece no Aquecedor, strip “Aquecedor”, conteúdo Dashboard
4. Clicar **Instâncias** → permanece no Aquecedor
5. Clicar **Dashboard** (menu Disparos) → API Oficial
6. Botão **API Alternativa** continua oculto para Bets

## Palavras-chave

`enforceBetsSubscriberIntegrationEnv`, `bets-segment`, `menu-lateral`, `dashboard`, `instancias`, `api-oficial`, `nao-oficial`
