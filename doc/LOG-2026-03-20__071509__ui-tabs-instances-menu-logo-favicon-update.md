# LOG - UI tabs: Dashboard / Instâncias (mobile menu + DRAX branding)

## Contexto
Você pediu uma reestruturação do layout do `DisparadorN8n`:
- Adicionar uma segunda aba: `Instâncias`
- Ter duas abas no total: `Dashboard` e `Instâncias`
- Incluir logo e favicon da DRAX (mesmo do site `draxsistemas.com.br`) e manter paleta compatível com o visual atual
- Fazer o layout mobile-first com menu expansivo no celular

## Comandos executados / ações
- Alteração do backend para suportar a aba `Instâncias`:
  - `GET /instancias` passou a retornar `items` (top 100) com `name` e `connectionStatus`
- Alteração do frontend:
  - Novo UI com tabs `Dashboard`/`Instâncias` e menu expansivo mobile
  - Criação do painel `Instâncias` com lista do status (top 100) e cards de resumo
  - Ajuste do carregamento do backend:
    - Quando a aba ativa é `Instâncias`, evita buscar `/dados` (reduz carga e evita estados incoerentes)
- Build/publicação:
  - `npm run build` (inclui cópia de `index.html` para `dist/index.html`)

## Solução implementada (passo a passo)
1. Backend (`src/index.ts`)
   - Ajustei a rota `GET /instancias` para retornar:
     - `total`, `ativas`, `desconectadas`
     - `items`: lista curta (top 100) com campos normalizados (`name`, `connectionStatus`)

2. Frontend (`index.html`)
   - Adicionei `favicon` e `theme-color` no `<head>` usando o favicon da DRAX.
   - Substituí o ícone do título por uma marca (usando o favicon como logo compacto).
   - Criei abas:
     - `#tab-dashboard` (visível por padrão)
     - `#tab-instancias` (oculta por padrão e exibida via tabs)
   - Menu mobile expansivo:
     - Hamburger que abre um drawer com as duas opções de aba.
   - Lista de instâncias:
     - `renderInstancesList()` renderiza `instancesData.items` em um container dedicado.
   - Atualização do fluxo de carregamento:
     - `carregar()` agora só chama `/dados` quando `activeTab === "dashboard"`.
     - Quando em `Instâncias`, mantém cartões/lista atualizados sem depender de eventos.

## Arquivos criados/alterados
- Alterados:
  - `src/index.ts`
  - `index.html`
  - `dist/index.html` (via build)
  - `dist/index.js` (via build)
- Criados:
  - `doc/LOG-2026-03-20__071509__ui-tabs-instances-menu-logo-favicon-update.md`

## Como validar
- Backend:
  - `curl http://localhost:3000/instancias`
    - Deve retornar JSON com `items`
- Frontend:
  - Validar sintaxe do JS inline:
    - `node -e "... new Function(script) ..."` (executado)
- Abas:
  - Ao alternar para `Instâncias`, a lista deve atualizar com base em `instancesData.items`.

## Observações de segurança
- Não expus segredos no frontend.
- No backend, ao montar `items`, normalizei apenas campos úteis (`name`, `connectionStatus`), reduzindo risco de exposição do payload completo.

## Itens para evitar duplicação no futuro (keywords)
- `instancias` `items` `connectionStatus`
- `tabs` `mobile-first` `drawer`
- `renderInstancesList`
- `carregar()` `skip-dados-when-instancias`

