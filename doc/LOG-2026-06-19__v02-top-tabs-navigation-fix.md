# LOG — V02 abas superiores → telas corretas

**Data:** 2026-06-19  
**Pedido:** Aquecedor / API Oficial / API Alternativa devem abrir a tela correspondente.

## Alterações (`index.html`)

- `resolveTabForIntegrationEnv(env)` — mapeamento central:
  - `nao-oficial` → `aquecedor` (via `resolveAquecedorIntegrationTab`)
  - `oficial` → `disparos` (via `resolveOfficialApiTab`) — API Oficial / campanhas
  - `alternativa` → `disparo-evo` — API Alternativa (UI EVO)
- `resolveDisparosIntegrationEnvFromTab` — `disparos` ↔ oficial, `disparo-evo` ↔ alternativa
- Click handler das abas superiores sempre chama `setActiveTab(targetTab)` + `applyIntegrationEnvironment`

## Validação

- `node -e` parse do bloco `<script>` com funções de navegação: OK

## Teste manual (V02)

1. Abrir http://localhost:3012/version-02/ e Ctrl+F5
2. Clicar **Aquecedor** → painel `#tab-aquecedor`
3. Clicar **API Oficial** → `#tab-disparos` (título "API Oficial", sem modo EVO)
4. Clicar **API Alternativa** → `#tab-disparos` com `body.waba-disparo-evo-mode` (título "API Alternativa")

## Pendências

- Confirmação do usuário após refresh
- Ícone WhatsApp menu lateral (feedback anterior)
